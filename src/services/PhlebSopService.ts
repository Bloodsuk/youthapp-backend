import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  IPhlebSopCreateInput,
  IPhlebSopDocument,
  IPhlebSopForPhleb,
  IPhlebSopUpdateInput,
  PhlebSopAckStatus,
} from "@src/interfaces/IPhlebSop";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

function toIsoString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value).trim();
  return s || null;
}

function mapDocument(row: RowDataPacket): IPhlebSopDocument {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    description: row.description != null ? String(row.description) : null,
    current_version: String(row.current_version ?? "1.0"),
    file_url: row.file_url != null ? String(row.file_url) : null,
    is_active: Number(row.is_active) === 1,
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

function resolveFileUrl(filePath: string | null, baseUrl?: string): string | null {
  if (!filePath?.trim()) return null;
  const path = filePath.trim();
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `${root}${normalized}`;
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
  baseUrl?: string
): IPhlebSopForPhleb {
  const fileUrl = resolveFileUrl(doc.file_url, baseUrl);
  const hasDocument = fileUrl != null;
  // Acknowledgement only counts when the phleb opened the document for this version.
  const acknowledged = ack != null && view != null && hasDocument;
  const status: PhlebSopAckStatus = acknowledged ? "acknowledged" : "pending";
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
  };
}

async function listActiveDocuments(): Promise<IPhlebSopDocument[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, description, current_version, file_url, is_active,
            created_by, created_at, updated_at
     FROM npn_sop_documents
     ORDER BY title ASC, id ASC`
  );
  return rows.map(mapDocument);
}

async function listForPhleb(
  phlebId: number,
  baseUrl?: string
): Promise<IPhlebSopForPhleb[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, description, current_version, file_url, is_active,
            created_by, created_at, updated_at
     FROM npn_sop_documents
     WHERE is_active = 1
     ORDER BY title ASC, id ASC`
  );

  const result: IPhlebSopForPhleb[] = [];
  for (const row of rows) {
    const doc = mapDocument(row);
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
    result.push(withAckStatus(doc, ack, view, baseUrl));
  }
  return result;
}

async function getDocumentById(id: number): Promise<IPhlebSopDocument | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, description, current_version, file_url, is_active,
            created_by, created_at, updated_at
     FROM npn_sop_documents
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? mapDocument(rows[0]) : null;
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
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO npn_sop_documents
       (title, description, current_version, file_url, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      title,
      input.description?.trim() || null,
      version,
      input.file_url?.trim() || null,
      input.is_active === false ? 0 : 1,
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

  await pool.query(
    `UPDATE npn_sop_documents
     SET title = ?, description = ?, current_version = ?, file_url = ?, is_active = ?
     WHERE id = ?`,
    [title, description, currentVersion.slice(0, 20), fileUrl, isActive, id]
  );

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
  if (!doc || !doc.is_active) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "SOP not found");
  }
  if (!doc.file_url?.trim()) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This SOP has no document attached yet"
    );
  }

  await pool.query(
    `INSERT INTO npn_sop_document_views (phleb_id, sop_id, version, viewed_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE viewed_at = NOW()`,
    [phlebId, sopId, doc.current_version]
  );

  const ack = await getAckForCurrentVersion(
    phlebId,
    sopId,
    doc.current_version
  );
  const view = await getViewForCurrentVersion(
    phlebId,
    sopId,
    doc.current_version
  );
  return withAckStatus(doc, ack, view, baseUrl);
}

async function acknowledge(
  phlebId: number,
  sopId: number,
  signedBy: string,
  baseUrl?: string
): Promise<IPhlebSopForPhleb> {
  const doc = await getDocumentById(sopId);
  if (!doc || !doc.is_active) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "SOP not found");
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
    return withAckStatus(doc, existing, view, baseUrl);
  }

  const signer = signedBy.trim() || "Phlebotomist";
  await pool.query(
    `INSERT INTO npn_sop_acknowledgements (phleb_id, sop_id, version, signed_by, signed_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [phlebId, sopId, doc.current_version, signer]
  );

  const ack = await getAckForCurrentVersion(
    phlebId,
    sopId,
    doc.current_version
  );
  return withAckStatus(doc, ack, view, baseUrl);
}

export default {
  listActiveDocuments,
  listForPhleb,
  getDocumentById,
  createDocument,
  updateDocument,
  markViewed,
  acknowledge,
} as const;
