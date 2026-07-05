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

const SIGNOFF_LABELS: Record<string, string> = {
  identity_verified: "Identity verified",
  dbs_verified: "DBS verified",
  hep_b_verified: "Hepatitis B verified",
  right_to_work_verified: "Right to work verified",
  insurance_verified: "Insurance verified",
  practical_competency_confirmed: "Practical competency confirmed",
  qualifications_reviewed: "Qualifications reviewed",
  cpd_reviewed: "CPD reviewed",
  sop_reading_confirmed: "SOP reading confirmed",
  cv_reviewed: "CV reviewed",
};

const UPLOADABLE_KEYS = Object.keys(SIGNOFF_LABELS);

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

const REMOTE_FILES_BASE_URL =
  process.env.PUBLIC_FILES_BASE_URL?.trim() ||
  "https://prapp.youth-revisited.co.uk";

function buildFileUrl(filePath: string, baseUrl?: string): string {
  const normalized = filePath.startsWith("/") ? filePath.slice(1) : filePath;
  if (baseUrl) {
    const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return `${root}${normalized}`;
  }
  return `/${normalized}`;
}

/** Local dev + live DB: file metadata is remote but PDF may only exist on production disk. */
function resolveFileUrl(filePath: string, requestBaseUrl?: string): string {
  if (!filePath) return "";
  const normalized = filePath.startsWith("/") ? filePath.slice(1) : filePath;
  const localFile = path.join(process.cwd(), "public", normalized);
  if (fs.existsSync(localFile)) {
    return buildFileUrl(filePath, requestBaseUrl);
  }
  return buildFileUrl(filePath, REMOTE_FILES_BASE_URL);
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
    file_url: resolveFileUrl(filePath, baseUrl),
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

function deriveItemStatus(
  signoffCompleted: boolean,
  doc: IPhlebComplianceDocument | null
): PhlebComplianceItemStatus {
  if (doc?.status === "rejected") return "rejected";
  if (doc?.status === "pending_review") return "pendingReview";

  if (signoffCompleted) {
    if (doc?.expiry_date) {
      const days = daysUntil(doc.expiry_date);
      if (days < 0) return "expired";
      if (days <= 30) return "expiringSoon";
    }
    return "valid";
  }

  if (!doc) return "missing";
  return "missing";
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

async function getSignoffsByPhlebId(
  phlebId: number
): Promise<Map<string, IPhlebComplianceSignoff>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, item_key, signed_off, signed_by, signed_at
     FROM npn_phleb_signoffs
     WHERE phleb_id = ?
     ORDER BY item_key ASC`,
    [phlebId]
  );

  const map = new Map<string, IPhlebComplianceSignoff>();
  for (const row of rows) {
    const key = String(row.item_key ?? "");
    map.set(key, {
      id: Number(row.id),
      item_key: key,
      title: SIGNOFF_LABELS[key] ?? key.replace(/_/g, " "),
      completed: Number(row.signed_off) === 1,
      signed_off_by: row.signed_by ? String(row.signed_by) : null,
      signed_off_at: toIsoString(row.signed_at),
    });
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

async function buildItems(
  phlebId: number,
  baseUrl?: string
): Promise<IPhlebComplianceItem[]> {
  const signoffs = await getSignoffsByPhlebId(phlebId);
  const documents = await getCurrentDocumentsByPhlebId(phlebId, baseUrl);

  return UPLOADABLE_KEYS.map((itemKey) => {
    const signoff = signoffs.get(itemKey) ?? {
      id: 0,
      item_key: itemKey,
      title: SIGNOFF_LABELS[itemKey] ?? itemKey,
      completed: false,
      signed_off_by: null,
      signed_off_at: null,
    };
    const currentDocument = documents.get(itemKey) ?? null;
    const status = deriveItemStatus(signoff.completed, currentDocument);
    const canUpload =
      !signoff.completed ||
      status === "missing" ||
      status === "rejected" ||
      status === "expiringSoon" ||
      status === "expired" ||
      currentDocument?.status === "rejected";

    return {
      item_key: itemKey,
      title: signoff.title,
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
    (i) => i.current_document?.status === "pending_review"
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

  await pool.query(
    `UPDATE npn_phleb_files SET is_current = 0
     WHERE phleb_id = ? AND item_key = ? AND is_current = 1`,
    [phlebId, itemKey]
  );

  const [insertResult] = await pool.query<ResultSetHeader>(
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

  await pool.query(
    `UPDATE npn_phleb_signoffs
     SET signed_off = 0, signed_by = NULL, signed_at = NULL
     WHERE phleb_id = ? AND item_key = ?`,
    [phlebId, itemKey]
  );

  const items = await buildItems(phlebId, baseUrl);
  return (
    items.find((i) => i.item_key === itemKey) ?? {
      item_key: itemKey,
      title: SIGNOFF_LABELS[itemKey] ?? itemKey,
      status: "pendingReview",
      signoff: {
        id: 0,
        item_key: itemKey,
        title: SIGNOFF_LABELS[itemKey] ?? itemKey,
        completed: false,
        signed_off_by: null,
        signed_off_at: null,
      },
      current_document: {
        id: insertResult.insertId,
        file_name: file.originalname,
        file_path: filePath,
        file_url: resolveFileUrl(filePath, baseUrl),
        mime_type: file.mimetype,
        file_size: file.size,
        status: "pending_review",
        expiry_date: options.expiryDate ?? null,
        notes: options.notes ?? null,
        uploaded_at: new Date().toISOString(),
        reviewed_by: null,
        reviewed_at: null,
      },
      can_upload: false,
    }
  );
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
    await pool.query(
      `UPDATE npn_phleb_signoffs
       SET signed_off = 1, signed_by = ?, signed_at = NOW()
       WHERE phleb_id = ? AND item_key = ?`,
      [signedOffBy, phlebId, itemKey]
    );
  } else {
    await pool.query(
      `UPDATE npn_phleb_files
       SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), notes = COALESCE(?, notes)
       WHERE id = ?`,
      [signedOffBy, review.notes ?? null, documentId]
    );
    await pool.query(
      `UPDATE npn_phleb_signoffs
       SET signed_off = 0, signed_by = NULL, signed_at = NULL
       WHERE phleb_id = ? AND item_key = ?`,
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
