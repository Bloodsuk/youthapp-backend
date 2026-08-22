import crypto from "crypto";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { RouteError } from "@src/other/classes";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";

const DEFAULT_FORM_URL =
  "https://www.practitioner.youth-revisited.co.uk/application_form";
const TOKEN_TTL_SECONDS = 300;
const DEFAULT_FILES_BASE_URL = "https://prapp.youth-revisited.co.uk";

export const WP_CONTRACT_FILE_FIELDS = [
  "cv_file",
  "hep_b_proof",
  "occupational_health_records",
  "dbs_adults",
  "dbs_children",
  "right_to_work",
  "utr_file",
] as const;

export type WpContractFileField = (typeof WP_CONTRACT_FILE_FIELDS)[number];
export type WpContractReviewStatus = "submitted" | "approved";

export interface IWpContractSubmissionSummary {
  id: number;
  application_id: number;
  status: WpContractReviewStatus;
  status_label: string;
  full_name: string | null;
  personal_email: string | null;
  mobile_number: string | null;
  created_at: string | null;
  documents_uploaded: number;
  has_youth_signature: boolean;
  files: Record<WpContractFileField, string | null>;
}

function applicationFormUrl(): string {
  return (
    process.env.PHLEB_APPLICATION_FORM_URL?.trim() || DEFAULT_FORM_URL
  );
}

function publicFilesBaseUrl(): string {
  return (
    process.env.PUBLIC_FILES_BASE_URL?.trim() || DEFAULT_FILES_BASE_URL
  ).replace(/\/$/, "");
}

function toPublicFileUrl(storedPath: string): string {
  const raw = storedPath.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return `${publicFilesBaseUrl()}${normalized}`;
}

function bypassSecret(): string {
  const secret =
    process.env.PHLEB_APPLICATION_FORM_BYPASS_SECRET?.trim() ||
    process.env.PARTNER_SSO_SECRET?.trim();
  if (!secret) {
    throw new RouteError(
      HttpStatusCodes.SERVICE_UNAVAILABLE,
      "Application form bypass is not configured on the server"
    );
  }
  return secret;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function buildSignedFormUrl(phlebId: number, email: string): string {
  const secret = bypassSecret();
  const ts = Math.floor(Date.now() / 1000);
  const normalizedEmail = (email || "").trim().toLowerCase();
  const payload = `${phlebId}.${ts}.${normalizedEmail}`;
  const sig = signPayload(payload, secret);

  const base = applicationFormUrl().replace(/\/$/, "");
  const params = new URLSearchParams({
    yr_app: "1",
    yr_phleb_id: String(phlebId),
    yr_ts: String(ts),
    yr_email: normalizedEmail,
    yr_sig: sig,
  });

  return `${base}?${params.toString()}`;
}

function fileMapFromRow(
  row: RowDataPacket
): Record<WpContractFileField, string | null> {
  const files = {} as Record<WpContractFileField, string | null>;
  for (const field of WP_CONTRACT_FILE_FIELDS) {
    const value = row[field];
    files[field] =
      value != null && String(value).trim() !== ""
        ? String(value).trim()
        : null;
  }
  return files;
}

function countUploadedDocs(
  files: Record<WpContractFileField, string | null>
): number {
  return WP_CONTRACT_FILE_FIELDS.reduce(
    (n, field) => n + (files[field] ? 1 : 0),
    0
  );
}

function mapSubmissionRow(row: RowDataPacket): IWpContractSubmissionSummary {
  const hasYouthSignature =
    row.youth_signature != null && String(row.youth_signature).trim() !== "";
  const status: WpContractReviewStatus = hasYouthSignature
    ? "approved"
    : "submitted";
  const files = fileMapFromRow(row);

  const fullName =
    (row.full_name != null && String(row.full_name).trim()) ||
    (row.contractor_name != null && String(row.contractor_name).trim()) ||
    null;
  const personalEmail =
    (row.personal_email != null && String(row.personal_email).trim()) ||
    (row.email != null && String(row.email).trim()) ||
    null;
  const mobile =
    (row.mobile_number != null && String(row.mobile_number).trim()) ||
    (row.phone != null && String(row.phone).trim()) ||
    null;

  return {
    id: Number(row.id),
    application_id: Number(row.application_id),
    status,
    status_label: status === "approved" ? "Approved" : "Submitted",
    full_name: fullName,
    personal_email: personalEmail,
    mobile_number: mobile,
    created_at: row.created_at
      ? new Date(row.created_at).toISOString()
      : null,
    documents_uploaded: countUploadedDocs(files),
    has_youth_signature: hasYouthSignature,
    files,
  };
}

async function getWpContractSubmission(
  phlebId: number
): Promise<IWpContractSubmissionSummary | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, application_id, created_at, full_name, contractor_name,
            personal_email, email, mobile_number, phone, youth_signature,
            cv_file, hep_b_proof, occupational_health_records,
            dbs_adults, dbs_children, right_to_work, utr_file
     FROM wp_phleb_contracts
     WHERE application_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [phlebId]
  );
  if (!rows.length) return null;
  return mapSubmissionRow(rows[0]);
}

/**
 * Build application form URL with a short-lived signed bypass token
 * so phlebs from the app skip the page password (YRapplication1).
 *
 * Also reports whether the phleb already has a row in wp_phleb_contracts
 * so the app can show a status screen instead of reopening the form.
 */
export async function getSubmitContractAccess(
  phlebId: number,
  email: string
): Promise<{
  url: string;
  submitted: boolean;
  status: WpContractReviewStatus | null;
  status_label: string | null;
  contract: IWpContractSubmissionSummary | null;
}> {
  if (!Number.isFinite(phlebId) || phlebId <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid phlebotomist");
  }

  const contract = await getWpContractSubmission(phlebId);
  const url = buildSignedFormUrl(phlebId, email);

  return {
    url,
    submitted: contract != null,
    status: contract?.status ?? null,
    status_label: contract?.status_label ?? null,
    contract,
  };
}

/**
 * Attach / replace document files on the existing wp_phleb_contracts row
 * for this phleb (application_id = phlebId). Does not create a new contract.
 */
export async function updateWpContractDocuments(
  phlebId: number,
  files: Partial<Record<WpContractFileField, string>>
): Promise<IWpContractSubmissionSummary> {
  if (!Number.isFinite(phlebId) || phlebId <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid phlebotomist");
  }

  const existing = await getWpContractSubmission(phlebId);
  if (!existing) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      "No submitted contract found to attach documents to"
    );
  }

  const updates: string[] = [];
  const values: Array<string | number> = [];
  for (const field of WP_CONTRACT_FILE_FIELDS) {
    const pathOrUrl = files[field];
    if (!pathOrUrl || !String(pathOrUrl).trim()) continue;
    updates.push(`${field} = ?`);
    values.push(toPublicFileUrl(String(pathOrUrl)));
  }

  if (!updates.length) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Please select at least one document to upload"
    );
  }

  values.push(existing.id);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE wp_phleb_contracts SET ${updates.join(", ")} WHERE id = ?`,
    values
  );
  if (result.affectedRows < 1) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to update contract documents"
    );
  }

  const refreshed = await getWpContractSubmission(phlebId);
  if (!refreshed) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Contract updated but could not be reloaded"
    );
  }
  return refreshed;
}

export function getTokenTtlSeconds(): number {
  return TOKEN_TTL_SECONDS;
}
