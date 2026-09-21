import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  IPhlebSopCreateInput,
  IPhlebSopDocument,
  IPhlebSopForPhleb,
  IPhlebSopListResult,
  IPhlebSopUpdateInput,
  PhlebSopAckStatus,
} from "@src/interfaces/IPhlebSop";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

/** Titles that must never appear on the SOP acknowledgement list (Training Matrix). */
const HIDDEN_TITLE_PATTERNS = [
  /YR_SD_016/i,
  /Safeguarding\s+Presentation/i,
];

function toIsoString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value).trim();
  return s || null;
}

function isHiddenFromSopList(title: string): boolean {
  return HIDDEN_TITLE_PATTERNS.some((re) => re.test(title));
}

/** Spec: only Booklet / Phlebotomy Procedure / Safeguarding Policy get ticks. */
function inferRequiresAcknowledgement(title: string, code?: string | null): boolean {
  const hay = `${code ?? ""} ${title}`;
  if (/YR_SD_016/i.test(hay) || /Safeguarding\s+Presentation/i.test(hay)) {
    return false;
  }
  return (
    /YR_SD_014/i.test(hay) ||
    /Mobile\s+Phlebotomy\s+Booklet/i.test(hay) ||
    /YR_SOP_008/i.test(hay) ||
    (/Phlebotomy\s+Proceed?ure/i.test(hay) && !/Presentation/i.test(hay) && !/Policy/i.test(hay)) ||
    /YR_SOP_005/i.test(hay) ||
    (/Safeguarding\s+Policy/i.test(hay) && !/Presentation/i.test(hay))
  );
}

function mapDocument(row: RowDataPacket): IPhlebSopDocument {
  const title = String(row.title ?? "");
  const documentCode =
    row.document_code != null ? String(row.document_code) : null;
  // Live admin column is `is_required_ack`; keep title inference as fallback.
  let requiresAck: boolean;
  if (isHiddenFromSopList(title)) {
    requiresAck = false;
  } else if (row.is_required_ack != null) {
    requiresAck = Number(row.is_required_ack) === 1;
  } else if (row.requires_acknowledgement != null) {
    requiresAck = Number(row.requires_acknowledgement) === 1;
  } else {
    requiresAck = inferRequiresAcknowledgement(title, documentCode);
  }

  return {
    id: Number(row.id),
    title,
    description: row.description != null ? String(row.description) : null,
    current_version: String(row.current_version ?? "1.0"),
    file_url: row.file_url != null ? String(row.file_url) : null,
    is_active: Number(row.is_active) === 1,
    requires_acknowledgement: requiresAck,
    document_code: documentCode,
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

async function getAckForCurrentVersion(
  phlebId: number,
  sopId: number,
  currentVersion: string
): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, version, signed_by, signed_at
     FROM npn_sop_acknowledgements
     WHERE phleb_id = ? AND sop_id = ? AND version = ?
     LIMIT 1`,
    [phlebId, sopId, currentVersion]
  );
  return rows[0] ?? null;
}

async function hasHistoricalAck(
  phlebId: number,
  sopId: number,
  currentVersion: string
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM npn_sop_acknowledgements
     WHERE phleb_id = ? AND sop_id = ? AND version <> ?
     LIMIT 1`,
    [phlebId, sopId, currentVersion]
  );
  return rows.length > 0;
}

const PUBLIC_FILES_BASE_URL =
  process.env.PUBLIC_FILES_BASE_URL?.trim() ||
  "https://prapp.youth-revisited.co.uk";

function resolveFileUrl(filePath: string | null, baseUrl?: string): string | null {
  if (!filePath?.trim()) return null;
  const raw = filePath.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  // Always absolute for the app — relative paths open as a blank prapp root in Safari.
  const root = (baseUrl?.trim() || PUBLIC_FILES_BASE_URL).replace(/\/$/, "");
  const normalized = raw.startsWith("/") ? raw.slice(1) : raw;
  return `${root}/${normalized}`;
}

async function getViewForCurrentVersion(
  phlebId: number,
  sopId: number,
  currentVersion: string
): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, version, viewed_at
     FROM npn_sop_document_views
     WHERE phleb_id = ? AND sop_id = ? AND version = ?
     LIMIT 1`,
    [phlebId, sopId, currentVersion]
  );
  return rows[0] ?? null;
}

function withAckStatus(
  doc: IPhlebSopDocument,
  ack: RowDataPacket | null,
  view: RowDataPacket | null,
  reacknowledgementNeeded: boolean,
  baseUrl?: string
): IPhlebSopForPhleb {
  const fileUrl = resolveFileUrl(doc.file_url, baseUrl);
  const hasDocument = fileUrl != null;
  const requiresAck = doc.requires_acknowledgement;

  let status: PhlebSopAckStatus;
  let acknowledged = false;

  if (!requiresAck) {
    status = "reference";
  } else {
    // Acknowledgement only counts when the phleb opened the document for this version.
    acknowledged = ack != null && view != null && hasDocument;
    status = acknowledged ? "acknowledged" : "unacknowledged";
  }

  return {
    ...doc,
    file_url: fileUrl,
    status,
    acknowledged_version: acknowledged && ack ? String(ack.version) : null,
    acknowledged_at: acknowledged && ack ? toIsoString(ack.signed_at) : null,
    acknowledged_by:
      acknowledged && ack?.signed_by != null ? String(ack.signed_by) : null,
    has_document: hasDocument,
    document_viewed: view != null,
    viewed_at: view ? toIsoString(view.viewed_at) : null,
    can_acknowledge: requiresAck && !acknowledged,
    reacknowledgement_needed: requiresAck && !acknowledged && reacknowledgementNeeded,
  };
}

async function enrichForPhleb(
  phlebId: number,
  doc: IPhlebSopDocument,
  baseUrl?: string
): Promise<IPhlebSopForPhleb> {
  const ack = await getAckForCurrentVersion(
    phlebId,
    doc.id,
    doc.current_version
  );
  const view = await getViewForCurrentVersion(
    phlebId,
    doc.id,
    doc.current_version
  );
  const historical =
    doc.requires_acknowledgement && !ack
      ? await hasHistoricalAck(phlebId, doc.id, doc.current_version)
      : false;
  return withAckStatus(doc, ack, view, historical, baseUrl);
}

function buildListResult(documents: IPhlebSopForPhleb[]): IPhlebSopListResult {
  const required = documents.filter((d) => d.requires_acknowledgement);
  const requiredOpened = required.filter((d) => d.document_viewed).length;
  const requiredAcknowledged = required.filter(
    (d) => d.status === "acknowledged"
  ).length;
  const canAcknowledgeAll =
    required.length > 0 &&
    required.every((d) => d.document_viewed && d.has_document) &&
    required.some((d) => d.status !== "acknowledged");

  return {
    documents,
    required_total: required.length,
    required_opened: requiredOpened,
    required_acknowledged: requiredAcknowledged,
    can_acknowledge_all: canAcknowledgeAll,
  };
}

async function listActiveDocuments(): Promise<IPhlebSopDocument[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT *
     FROM npn_sop_documents
     ORDER BY title ASC, id ASC`
  );
  return rows.map(mapDocument).filter((d) => !isHiddenFromSopList(d.title));
}

async function listForPhleb(
  phlebId: number,
  baseUrl?: string
): Promise<IPhlebSopListResult> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT *
     FROM npn_sop_documents
     WHERE is_active = 1
     ORDER BY title ASC, id ASC`
  );

  const documents: IPhlebSopForPhleb[] = [];
  for (const row of rows) {
    const doc = mapDocument(row);
    if (isHiddenFromSopList(doc.title)) continue;
    documents.push(await enrichForPhleb(phlebId, doc, baseUrl));
  }
  // Required docs first in the payload for the app sections.
  documents.sort((a, b) => {
    if (a.requires_acknowledgement !== b.requires_acknowledgement) {
      return a.requires_acknowledgement ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
  return buildListResult(documents);
}

async function getDocumentById(id: number): Promise<IPhlebSopDocument | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT *
     FROM npn_sop_documents
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? mapDocument(rows[0]) : null;
}

async function queueVersionNotifications(
  sopId: number,
  newVersion: string
): Promise<void> {
  // Flag-only: record that re-read notice is due for phlebs who ack'd an older version.
  // Actual email/push sending is item 5 (later). UNIQUE key prevents spam.
  await pool.query(
    `INSERT IGNORE INTO npn_sop_version_notifications
       (phleb_id, sop_id, version, notified_at)
     SELECT DISTINCT a.phleb_id, a.sop_id, ?, NOW()
     FROM npn_sop_acknowledgements a
     WHERE a.sop_id = ?
       AND a.version <> ?`,
    [newVersion, sopId, newVersion]
  );
}

async function createDocument(
  input: IPhlebSopCreateInput,
  createdBy: string
): Promise<IPhlebSopDocument> {
  const title = input.title?.trim();
  if (!title) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "title is required");
  }

  const version = (input.current_version?.trim() || "1.0").slice(0, 20);
  const documentCode = input.document_code?.trim() || null;
  const requiresAck =
    input.requires_acknowledgement !== undefined
      ? Boolean(input.requires_acknowledgement)
      : inferRequiresAcknowledgement(title, documentCode);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO npn_sop_documents
       (title, description, current_version, file_url, is_active,
        is_required_ack, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      input.description?.trim() || null,
      version,
      input.file_url?.trim() || null,
      input.is_active === false ? 0 : 1,
      requiresAck ? 1 : 0,
      createdBy,
    ]
  );

  const created = await getDocumentById(Number(result.insertId));
  if (!created) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to create SOP"
    );
  }
  return created;
}

async function updateDocument(
  id: number,
  input: IPhlebSopUpdateInput
): Promise<IPhlebSopDocument> {
  const existing = await getDocumentById(id);
  if (!existing) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "SOP not found");
  }

  const title = input.title?.trim() || existing.title;
  const description =
    input.description !== undefined
      ? input.description?.trim() || null
      : existing.description;
  const currentVersion =
    input.current_version?.trim() || existing.current_version;
  const fileUrl =
    input.file_url !== undefined
      ? input.file_url?.trim() || null
      : existing.file_url;
  const isActive =
    input.is_active !== undefined ? (input.is_active ? 1 : 0) : existing.is_active ? 1 : 0;
  const documentCode =
    input.document_code !== undefined
      ? input.document_code?.trim() || null
      : existing.document_code;
  const requiresAck =
    input.requires_acknowledgement !== undefined
      ? Boolean(input.requires_acknowledgement)
      : existing.requires_acknowledgement;

  const versionChanged = currentVersion !== existing.current_version;

  await pool.query(
    `UPDATE npn_sop_documents
     SET title = ?, description = ?, current_version = ?, file_url = ?,
         is_active = ?, is_required_ack = ?
     WHERE id = ?`,
    [
      title,
      description,
      currentVersion.slice(0, 20),
      fileUrl,
      isActive,
      requiresAck ? 1 : 0,
      id,
    ]
  );

  if (versionChanged && requiresAck) {
    await queueVersionNotifications(id, currentVersion.slice(0, 20));
  }

  const updated = await getDocumentById(id);
  if (!updated) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "SOP not found");
  }
  return updated;
}

async function markViewed(
  phlebId: number,
  sopId: number,
  baseUrl?: string
): Promise<IPhlebSopForPhleb> {
  const doc = await getDocumentById(sopId);
  if (!doc || !doc.is_active || isHiddenFromSopList(doc.title)) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "SOP not found");
  }
  if (!doc.file_url?.trim()) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This SOP has no document attached yet"
    );
  }

  // Spec: opens tracking only for the 3 required docs — reference library has no read-state.
  if (doc.requires_acknowledgement) {
    await pool.query(
      `INSERT INTO npn_sop_document_views (phleb_id, sop_id, version, viewed_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE viewed_at = viewed_at`,
      [phlebId, sopId, doc.current_version]
    );
  }

  return enrichForPhleb(phlebId, doc, baseUrl);
}

async function acknowledge(
  phlebId: number,
  sopId: number,
  signedBy: string,
  baseUrl?: string
): Promise<IPhlebSopForPhleb> {
  const doc = await getDocumentById(sopId);
  if (!doc || !doc.is_active || isHiddenFromSopList(doc.title)) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "SOP not found");
  }

  if (!doc.requires_acknowledgement) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This document is reference-only and does not require acknowledgement"
    );
  }

  if (!doc.file_url?.trim()) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Cannot sign off — no document is attached to this SOP"
    );
  }

  const view = await getViewForCurrentVersion(
    phlebId,
    sopId,
    doc.current_version
  );
  if (!view) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Open and read the SOP document before signing off"
    );
  }

  const existing = await getAckForCurrentVersion(
    phlebId,
    sopId,
    doc.current_version
  );
  if (existing) {
    return enrichForPhleb(phlebId, doc, baseUrl);
  }

  const signer = signedBy.trim() || "Phlebotomist";
  await pool.query(
    `INSERT INTO npn_sop_acknowledgements (phleb_id, sop_id, version, signed_by, signed_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [phlebId, sopId, doc.current_version, signer]
  );

  // Legacy admin dashboards still treat Safeguarding Presentation as required.
  // Policy ack in the app should clear that pending row too.
  if (/Safeguarding\s+Policy/i.test(doc.title) && !/Presentation/i.test(doc.title)) {
    await mirrorLegacySafeguardingPresentationAck(
      phlebId,
      doc.current_version,
      signer
    );
  }

  return enrichForPhleb(phlebId, doc, baseUrl);
}

/** Keep old dashboards in sync when Policy (not Presentation) is acknowledged. */
async function mirrorLegacySafeguardingPresentationAck(
  phlebId: number,
  version: string,
  signedBy: string
): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM npn_sop_documents
     WHERE title LIKE '%Safeguarding Presentation%'
        OR title LIKE '%YR_SD_016%'
     ORDER BY id ASC
     LIMIT 1`
  );
  const presentationId = rows[0] ? Number(rows[0].id) : 0;
  if (!presentationId) return;

  await pool.query(
    `INSERT INTO npn_sop_document_views (phleb_id, sop_id, version, viewed_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE viewed_at = viewed_at`,
    [phlebId, presentationId, version]
  );
  await pool.query(
    `INSERT IGNORE INTO npn_sop_acknowledgements
       (phleb_id, sop_id, version, signed_by, signed_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [phlebId, presentationId, version, signedBy]
  );
}

async function acknowledgeAllRequired(
  phlebId: number,
  signedBy: string,
  baseUrl?: string
): Promise<IPhlebSopListResult> {
  const list = await listForPhleb(phlebId, baseUrl);
  const required = list.documents.filter((d) => d.requires_acknowledgement);

  if (required.length === 0) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "No required SOP documents are published yet"
    );
  }

  const notOpened = required.filter((d) => !d.document_viewed || !d.has_document);
  if (notOpened.length > 0) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Open all required documents before using Read all"
    );
  }

  // Spec: one click writes a separate acknowledgement row per required document.
  for (const doc of required) {
    if (doc.status !== "acknowledged") {
      await acknowledge(phlebId, doc.id, signedBy, baseUrl);
    }
  }

  return listForPhleb(phlebId, baseUrl);
}

export default {
  listActiveDocuments,
  listForPhleb,
  getDocumentById,
  createDocument,
  updateDocument,
  markViewed,
  acknowledge,
  acknowledgeAllRequired,
} as const;
