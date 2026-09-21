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

const WP_CONTRACT_SELECT = `id, application_id, created_at, full_name, contractor_name,
            personal_email, email, mobile_number, phone, youth_signature,
            cv_file, hep_b_proof, occupational_health_records,
            dbs_adults, dbs_children, right_to_work, utr_file`;

async function resolvePhlebEmail(
  phlebId: number,
  email?: string
): Promise<string> {
  const fromArg = (email || "").trim().toLowerCase();
  if (fromArg) return fromArg;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT email FROM phlebotomy_applications WHERE id = ? LIMIT 1`,
    [phlebId]
  );
  return (rows[0]?.email != null ? String(rows[0].email) : "").trim().toLowerCase();
}

/**
 * Find the WP contract for this phleb.
 * Prefer application_id = phlebId; fall back to email/personal_email when
 * WordPress stored a mismatched/orphan application_id (common re-upload 404).
 */
async function getWpContractSubmission(
  phlebId: number,
  email?: string
): Promise<IWpContractSubmissionSummary | null> {
  const [byAppId] = await pool.query<RowDataPacket[]>(
    `SELECT ${WP_CONTRACT_SELECT}
     FROM wp_phleb_contracts
     WHERE application_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [phlebId]
  );
  if (byAppId.length) return mapSubmissionRow(byAppId[0]);

  const normalizedEmail = await resolvePhlebEmail(phlebId, email);
  if (!normalizedEmail) return null;

  const [byEmail] = await pool.query<RowDataPacket[]>(
    `SELECT ${WP_CONTRACT_SELECT}
     FROM wp_phleb_contracts
     WHERE LOWER(TRIM(IFNULL(email, ''))) = ?
        OR LOWER(TRIM(IFNULL(personal_email, ''))) = ?
     ORDER BY id DESC
     LIMIT 1`,
    [normalizedEmail, normalizedEmail]
  );
  if (!byEmail.length) return null;
  return mapSubmissionRow(byEmail[0]);
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

  const contract = await getWpContractSubmission(phlebId, email);
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
 * for this phleb. Creates a minimal WP contract row if none exists yet
 * (same table the website uses), then attaches files.
 */
export async function updateWpContractDocuments(
  phlebId: number,
  files: Partial<Record<WpContractFileField, string>>,
  email?: string
): Promise<IWpContractSubmissionSummary> {
  if (!Number.isFinite(phlebId) || phlebId <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid phlebotomist");
  }

  let existing = await getWpContractSubmission(phlebId, email);
  if (!existing) {
    existing = await ensureWpContractRow(phlebId, email);
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

  // Keep app id linked when WP stored a mismatched application_id.
  if (existing.application_id !== phlebId) {
    updates.push("application_id = ?");
    values.push(phlebId);
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

  // Keep admin compliance checklist in sync (same docs website shows as Submitted).
  const complianceByField: Partial<Record<WpContractFileField, string>> = {
    cv_file: "cv_quals",
    hep_b_proof: "hep_b",
    occupational_health_records: "occ_health",
    dbs_adults: "dbs_adults",
    dbs_children: "dbs_children",
    right_to_work: "right_to_work",
  };
  for (const field of WP_CONTRACT_FILE_FIELDS) {
    if (!files[field]) continue;
    const rowKey = complianceByField[field];
    if (!rowKey) continue;
    await pool.query(
      `INSERT INTO npn_phleb_compliance (phleb_id, row_key, status)
       VALUES (?, ?, 'submitted')
       ON DUPLICATE KEY UPDATE status = 'submitted', updated_at = NOW()`,
      [phlebId, rowKey]
    );
  }

  const refreshed = await getWpContractSubmission(phlebId, email);
  if (!refreshed) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Contract updated but could not be reloaded"
    );
  }
  return refreshed;
}

/**
 * Create a minimal wp_phleb_contracts row from the phleb profile so app
 * document uploads land in the same table the website admin reviews.
 */
async function ensureWpContractRow(
  phlebId: number,
  email?: string
): Promise<IWpContractSubmissionSummary> {
  const [phlebRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, email, full_name, phone, home_address
     FROM phlebotomy_applications
     WHERE id = ?
     LIMIT 1`,
    [phlebId]
  );
  if (!phlebRows.length) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Phlebotomist not found");
  }
  const phleb = phlebRows[0];
  const normalizedEmail = await resolvePhlebEmail(
    phlebId,
    email || (phleb.email != null ? String(phleb.email) : undefined)
  );
  const fullName =
    phleb.full_name != null && String(phleb.full_name).trim() !== ""
      ? String(phleb.full_name).trim()
      : null;
  const phone =
    phleb.phone != null && String(phleb.phone).trim() !== ""
      ? String(phleb.phone).trim()
      : null;
  const homeAddress =
    phleb.home_address != null && String(phleb.home_address).trim() !== ""
      ? String(phleb.home_address).trim()
      : null;

  const [insert] = await pool.query<ResultSetHeader>(
    `INSERT INTO wp_phleb_contracts
       (application_id, created_at, email, personal_email, full_name,
        contractor_name, phone, mobile_number, home_address, address)
     VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      phlebId,
      normalizedEmail || null,
      normalizedEmail || null,
      fullName,
      fullName,
      phone,
      phone,
      homeAddress,
      homeAddress,
    ]
  );

  const created = await getWpContractSubmission(phlebId, normalizedEmail);
  if (!created) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      `Contract row created (id ${insert.insertId}) but could not be loaded`
    );
  }
  return created;
}

export function getTokenTtlSeconds(): number {
  return TOKEN_TTL_SECONDS;
}
