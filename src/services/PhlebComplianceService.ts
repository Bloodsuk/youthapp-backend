import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import fs from "fs";
import path from "path";
import {
  IPhlebComplianceDocument,
  IPhlebComplianceDocumentReview,
  IPhlebComplianceItem,
  IPhlebComplianceOverview,
  IPhlebComplianceSignoff,
  PhlebComplianceDocStatus,
  PhlebComplianceItemStatus,
} from "@src/interfaces/IPhlebCompliance";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

/** Admin dashboard checklist keys (`npn_phleb_compliance.row_key`). */
const COMPLIANCE_ROWS: { key: string; title: string }[] = [
  { key: "identity", title: "Identity" },
  { key: "dbs_adults", title: "DBS (adults)" },
  { key: "dbs_children", title: "DBS (children)" },
  { key: "hep_b", title: "Hep B proof" },
  { key: "occ_health", title: "Occupational health" },
  { key: "cv_quals", title: "CV & Qualifications" },
  { key: "right_to_work", title: "Right to work" },
  { key: "sop_reading", title: "SOP reading" },
  { key: "practical_competency", title: "Practical competency" },
];

const UPLOADABLE_KEYS = COMPLIANCE_ROWS.map((r) => r.key);

/** Map compliance row → file column on `wp_phleb_contracts` when present. */
const CONTRACT_FILE_BY_ROW: Record<string, string> = {
  dbs_adults: "dbs_adults",
  dbs_children: "dbs_children",
  hep_b: "hep_b_proof",
  occ_health: "occupational_health_records",
  cv_quals: "cv_file",
  right_to_work: "right_to_work",
};

const WP_CONTRACT_FILES_BASE_URL =
  process.env.WP_CONTRACT_FILES_BASE_URL?.trim() ||
  "https://www.practitioner.youth-revisited.co.uk";

const REMOTE_FILES_BASE_URL =
  process.env.PUBLIC_FILES_BASE_URL?.trim() ||
  "https://prapp.youth-revisited.co.uk";

/** Public URL stored on wp_phleb_contracts (same as website / Agreement uploads). */
function toWpContractFileUrl(storedPath: string): string {
  const raw = storedPath.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return `${REMOTE_FILES_BASE_URL.replace(/\/$/, "")}${normalized}`;
}

/**
 * Resolve the WordPress contract row the admin dashboard uses.
 * Prefer application_id; fall back to phleb email (same as Agreement re-upload).
 */
async function findWpContractId(phlebId: number): Promise<number | null> {
  const [byApp] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM wp_phleb_contracts
     WHERE application_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [phlebId]
  );
  if (byApp.length) return Number(byApp[0].id);

  const [phlebRows] = await pool.query<RowDataPacket[]>(
    `SELECT email FROM phlebotomy_applications WHERE id = ? LIMIT 1`,
    [phlebId]
  );
  const email = (
    phlebRows[0]?.email != null ? String(phlebRows[0].email) : ""
  )
    .trim()
    .toLowerCase();
  if (!email) return null;

  const [byEmail] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM wp_phleb_contracts
     WHERE LOWER(TRIM(IFNULL(email, ''))) = ?
        OR LOWER(TRIM(IFNULL(personal_email, ''))) = ?
     ORDER BY id DESC
     LIMIT 1`,
    [email, email]
  );
  return byEmail.length ? Number(byEmail[0].id) : null;
}

function toDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toIsoString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString();
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function buildFileUrl(filePath: string, baseUrl?: string): string {
  const normalized = filePath.startsWith("/") ? filePath.slice(1) : filePath;
  if (baseUrl) {
    const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return `${root}${normalized}`;
  }
  return `/${normalized}`;
}

function resolveUploadedFileUrl(filePath: string, requestBaseUrl?: string): string {
  if (!filePath) return "";
  const normalized = filePath.startsWith("/") ? filePath.slice(1) : filePath;
  const localFile = path.join(process.cwd(), "public", normalized);
  if (fs.existsSync(localFile)) {
    return buildFileUrl(filePath, requestBaseUrl);
  }
  return buildFileUrl(filePath, REMOTE_FILES_BASE_URL);
}

function resolveContractFileUrl(filePath: string): string {
  const raw = filePath.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.startsWith("/") ? raw.slice(1) : raw;
  return `${WP_CONTRACT_FILES_BASE_URL.replace(/\/$/, "")}/${normalized}`;
}

function mapAdminStatus(raw: string): PhlebComplianceItemStatus {
  switch (raw) {
    case "verified":
    case "override":
    case "not_applicable":
      return "valid";
    case "submitted":
      return "pendingReview";
    case "empty":
    default:
      return "missing";
  }
}

function mapDocumentRow(
  row: RowDataPacket,
  baseUrl?: string
): IPhlebComplianceDocument {
  const filePath = String(row.file_path ?? "");
  return {
    id: Number(row.id),
    file_name: String(row.file_name ?? ""),
    file_path: filePath,
    file_url: resolveUploadedFileUrl(filePath, baseUrl),
    mime_type: row.mime_type ? String(row.mime_type) : null,
    file_size: row.file_size != null ? Number(row.file_size) : null,
    status: String(row.status) as PhlebComplianceDocStatus,
    expiry_date: toDateOnly(row.expiry_date),
    notes: row.notes ? String(row.notes) : null,
    uploaded_at: toIsoString(row.uploaded_at) ?? new Date().toISOString(),
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewed_at: toIsoString(row.reviewed_at),
  };
}

function deriveOverallStatus(
  items: IPhlebComplianceItem[]
): IPhlebComplianceOverview["overall_status"] {
  const hasBlocker = items.some(
    (i) =>
      i.status === "expired" ||
      i.status === "missing" ||
      i.status === "rejected"
  );
  if (hasBlocker) return "red";
  const hasAction = items.some(
    (i) =>
      i.status === "expiringSoon" ||
      i.status === "pendingReview" ||
      !i.signoff.completed
  );
  if (hasAction) return "amber";
  return "green";
}

async function getComplianceRowsByPhlebId(
  phlebId: number
): Promise<Map<string, RowDataPacket>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, row_key, status, verified_by, verified_at,
            na_reason, override_reason, updated_at
     FROM npn_phleb_compliance
     WHERE phleb_id = ?`,
    [phlebId]
  );
  const map = new Map<string, RowDataPacket>();
  for (const row of rows) {
    map.set(String(row.row_key), row);
  }
  return map;
}

async function getCurrentDocumentsByPhlebId(
  phlebId: number,
  baseUrl?: string
): Promise<Map<string, IPhlebComplianceDocument>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, item_key, file_name, file_path, mime_type, file_size, status,
            expiry_date, notes, uploaded_at, reviewed_by, reviewed_at
     FROM npn_phleb_files
     WHERE phleb_id = ? AND is_current = 1
     ORDER BY uploaded_at DESC`,
    [phlebId]
  );

  const map = new Map<string, IPhlebComplianceDocument>();
  for (const row of rows) {
    const key = String(row.item_key ?? "");
    if (!map.has(key)) {
      map.set(key, mapDocumentRow(row, baseUrl));
    }
  }
  return map;
}

async function getLatestContractFiles(
  phlebId: number
): Promise<Record<string, string | null>> {
  const contractId = await findWpContractId(phlebId);
  if (!contractId) return {};

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT dbs_adults, dbs_children, hep_b_proof, occupational_health_records,
            cv_file, right_to_work
     FROM wp_phleb_contracts
     WHERE id = ?
     LIMIT 1`,
    [contractId]
  );
  if (!rows.length) return {};
  const row = rows[0];
  const out: Record<string, string | null> = {};
  for (const [rowKey, field] of Object.entries(CONTRACT_FILE_BY_ROW)) {
    const value = row[field];
    out[rowKey] =
      value != null && String(value).trim() !== ""
        ? String(value).trim()
        : null;
  }
  return out;
}

function documentFromContractPath(
  rowKey: string,
  filePath: string
): IPhlebComplianceDocument {
  const name = filePath.split("/").pop() || `${rowKey}.pdf`;
  return {
    id: 0,
    file_name: name,
    file_path: filePath,
    file_url: resolveContractFileUrl(filePath),
    mime_type: null,
    file_size: null,
    status: "pending_review",
    expiry_date: null,
    notes: null,
    uploaded_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
  };
}

async function buildItems(
  phlebId: number,
  baseUrl?: string
): Promise<IPhlebComplianceItem[]> {
  const complianceRows = await getComplianceRowsByPhlebId(phlebId);
  const uploadedDocs = await getCurrentDocumentsByPhlebId(phlebId, baseUrl);
  const contractFiles = await getLatestContractFiles(phlebId);

  return COMPLIANCE_ROWS.map(({ key, title }) => {
    const row = complianceRows.get(key);
    const adminStatus = row ? String(row.status || "empty") : "empty";
    let status = mapAdminStatus(adminStatus);

    const uploaded = uploadedDocs.get(key) ?? null;
    let currentDocument = uploaded;
    if (!currentDocument && contractFiles[key]) {
      currentDocument = documentFromContractPath(key, contractFiles[key]!);
    }

    // App upload pending review wins over empty admin status.
    if (uploaded?.status === "pending_review") {
      status = "pendingReview";
    } else if (uploaded?.status === "rejected") {
      status = "rejected";
    } else if (uploaded?.status === "approved" && status === "missing") {
      status = "pendingReview";
    }

    if (status === "valid" && currentDocument?.expiry_date) {
      const days = daysUntil(currentDocument.expiry_date);
      if (days < 0) status = "expired";
      else if (days <= 30) status = "expiringSoon";
    }

    const completed =
      status === "valid" ||
      status === "expiringSoon" ||
      adminStatus === "verified" ||
      adminStatus === "override" ||
      adminStatus === "not_applicable";

    const signoff: IPhlebComplianceSignoff = {
      id: row ? Number(row.id) : 0,
      item_key: key,
      title,
      completed,
      signed_off_by: row?.verified_by ? String(row.verified_by) : null,
      signed_off_at: toIsoString(row?.verified_at),
    };

    if (currentDocument && status === "valid") {
      currentDocument = {
        ...currentDocument,
        status: "approved",
        reviewed_by: signoff.signed_off_by,
        reviewed_at: signoff.signed_off_at,
      };
    }

    const canUpload =
      status === "missing" ||
      status === "rejected" ||
      status === "expired" ||
      status === "expiringSoon";

    return {
      item_key: key,
      title,
      status,
      signoff,
      current_document: currentDocument,
      can_upload: canUpload,
    };
  });
}

async function getOverviewByPhlebId(
  phlebId: number,
  baseUrl?: string
): Promise<IPhlebComplianceOverview> {
  const items = await buildItems(phlebId, baseUrl);
  const validCount = items.filter((i) => i.status === "valid").length;
  const expiringCount = items.filter((i) => i.status === "expiringSoon").length;
  const actionRequiredCount = items.filter(
    (i) =>
      i.status === "expired" ||
      i.status === "missing" ||
      i.status === "rejected" ||
      i.status === "expiringSoon" ||
      i.status === "pendingReview"
  ).length;
  const pendingReviewCount = items.filter(
    (i) => i.status === "pendingReview"
  ).length;

  return {
    overall_status: deriveOverallStatus(items),
    valid_count: validCount,
    expiring_count: expiringCount,
    action_required_count: actionRequiredCount,
    pending_review_count: pendingReviewCount,
    can_be_assigned_to_jobs: !items.some(
      (i) =>
        i.status === "expired" ||
        i.status === "missing" ||
        i.status === "rejected"
    ),
  };
}

async function getItemsByPhlebId(
  phlebId: number,
  baseUrl?: string
): Promise<IPhlebComplianceItem[]> {
  return buildItems(phlebId, baseUrl);
}

async function ensureComplianceRow(phlebId: number, itemKey: string): Promise<void> {
  await pool.query(
    `INSERT INTO npn_phleb_compliance (phleb_id, row_key, status)
     VALUES (?, ?, 'empty')
     ON DUPLICATE KEY UPDATE phleb_id = phleb_id`,
    [phlebId, itemKey]
  );
}

async function uploadDocument(
  phlebId: number,
  itemKey: string,
  file: Express.Multer.File,
  options: { expiryDate?: string | null; notes?: string | null },
  baseUrl?: string
): Promise<IPhlebComplianceItem> {
  if (!UPLOADABLE_KEYS.includes(itemKey)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid item_key");
  }

  const filePath = `uploads/${file.filename}`;
  const publicUrl = toWpContractFileUrl(`/uploads/${file.filename}`);
  const contractField = CONTRACT_FILE_BY_ROW[itemKey];

  // Website admin View reads wp_phleb_contracts — keep app uploads on the same table.
  if (contractField) {
    const contractId = await findWpContractId(phlebId);
    if (!contractId) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "No agreement/contract found for this phlebotomist. Submit Agreement first, then upload documents."
      );
    }
    await pool.query(
      `UPDATE wp_phleb_contracts
       SET ${contractField} = ?, application_id = ?
       WHERE id = ?`,
      [publicUrl, phlebId, contractId]
    );
  }

  // App history / non-contract rows (identity, practical_competency, etc.)
  await pool.query(
    `UPDATE npn_phleb_files SET is_current = 0
     WHERE phleb_id = ? AND item_key = ? AND is_current = 1`,
    [phlebId, itemKey]
  );

  await pool.query<ResultSetHeader>(
    `INSERT INTO npn_phleb_files
       (phleb_id, item_key, file_name, file_path, mime_type, file_size, status, expiry_date, notes, is_current)
     VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, 1)`,
    [
      phlebId,
      itemKey,
      file.originalname,
      filePath,
      file.mimetype,
      file.size,
      options.expiryDate ?? null,
      options.notes ?? null,
    ]
  );

  await ensureComplianceRow(phlebId, itemKey);
  await pool.query(
    `UPDATE npn_phleb_compliance
     SET status = 'submitted', updated_at = NOW()
     WHERE phleb_id = ? AND row_key = ?`,
    [phlebId, itemKey]
  );

  const items = await buildItems(phlebId, baseUrl);
  const found = items.find((i) => i.item_key === itemKey);
  if (!found) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Upload saved but item could not be loaded"
    );
  }
  return found;
}

async function reviewDocument(
  documentId: number,
  review: IPhlebComplianceDocumentReview,
  reviewerName: string,
  baseUrl?: string
): Promise<IPhlebComplianceItem | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, phleb_id, item_key, file_path
     FROM npn_phleb_files
     WHERE id = ? AND is_current = 1
     LIMIT 1`,
    [documentId]
  );
  const row = rows[0];
  if (!row) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Document not found");
  }

  const phlebId = Number(row.phleb_id);
  const itemKey = String(row.item_key);
  const signedOffBy = review.signed_off_by?.trim() || reviewerName;

  if (review.status === "approved") {
    await pool.query(
      `UPDATE npn_phleb_files
       SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), notes = COALESCE(?, notes)
       WHERE id = ?`,
      [signedOffBy, review.notes ?? null, documentId]
    );
    await ensureComplianceRow(phlebId, itemKey);
    await pool.query(
      `UPDATE npn_phleb_compliance
       SET status = 'verified', verified_by = ?, verified_at = NOW(), updated_at = NOW()
       WHERE phleb_id = ? AND row_key = ?`,
      [signedOffBy, phlebId, itemKey]
    );
  } else {
    await pool.query(
      `UPDATE npn_phleb_files
       SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), notes = COALESCE(?, notes)
       WHERE id = ?`,
      [signedOffBy, review.notes ?? null, documentId]
    );
    await ensureComplianceRow(phlebId, itemKey);
    await pool.query(
      `UPDATE npn_phleb_compliance
       SET status = 'empty', verified_by = NULL, verified_at = NULL, updated_at = NOW()
       WHERE phleb_id = ? AND row_key = ?`,
      [phlebId, itemKey]
    );
  }

  const items = await buildItems(phlebId, baseUrl);
  return items.find((i) => i.item_key === itemKey) ?? null;
}

export default {
  getOverviewByPhlebId,
  getItemsByPhlebId,
  uploadDocument,
  reviewDocument,
  UPLOADABLE_KEYS,
} as const;
