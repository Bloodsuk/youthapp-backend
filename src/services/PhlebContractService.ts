import fs from "fs";
import path from "path";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  IPhlebContract,
  IPhlebContractInput,
  IPhlebContractReview,
  PhlebContractStatus,
} from "@src/interfaces/IPhlebContract";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

const REMOTE_FILES_BASE_URL =
  process.env.PUBLIC_FILES_BASE_URL?.trim() ||
  "https://prapp.youth-revisited.co.uk";

const FILE_FIELDS = [
  "cv_file",
  "hep_b_proof",
  "occupational_health_records",
  "dbs_adults",
  "dbs_children",
  "right_to_work",
  "utr_file",
] as const;

const WRITABLE_FIELDS = [
  "contractor_name",
  "address",
  "phone",
  "email",
  "full_name",
  "dob",
  "home_address",
  "mobile_number",
  "personal_email",
  "emergency_contact",
  "areas_covered",
  "travel_radius",
  "available_days",
  "weekend_availability",
  "clinic_mobile",
  "own_vehicle",
  "account_name",
  "sort_code",
  "account_number",
  "payment_frequency",
  "cv_file",
  "phlebotomy_qualifications",
  "relevant_certificates",
  "cpd_training",
  "clinical_competencies",
  "hep_b_proof",
  "occupational_health_records",
  "dbs_adults",
  "dbs_children",
  "right_to_work",
  "utr_file",
  "contractor_signature",
  "contractor_signature_date",
  "youth_signature",
  "youth_signature_date",
  "declaration_signature",
  "declaration_name",
  "declaration_date",
  "bank_signature",
  "bank_signature_date",
] as const;

function buildFileUrl(filePath: string | null): string | null {
  if (!filePath || !String(filePath).trim()) return null;
  const raw = String(filePath).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.startsWith("/") ? raw.slice(1) : raw;
  const localFile = path.join(process.cwd(), "public", normalized);
  const base = fs.existsSync(localFile)
    ? undefined
    : REMOTE_FILES_BASE_URL.replace(/\/$/, "");
  if (!base) return `/${normalized}`;
  return `${base}/${normalized}`;
}

function mapRow(row: RowDataPacket): IPhlebContract {
  const contract = row as unknown as IPhlebContract;
  const withUrls = contract as IPhlebContract & Record<string, unknown>;
  for (const field of FILE_FIELDS) {
    withUrls[`${field}_url`] = buildFileUrl(contract[field] as string | null);
  }
  return withUrls;
}

async function getContractsByPhlebId(phlebId: number): Promise<IPhlebContract[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM npn_phleb_contracts
     WHERE phleb_id = ?
     ORDER BY created_at DESC`,
    [phlebId]
  );
  return rows.map(mapRow);
}

async function getContractById(id: number): Promise<IPhlebContract | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM npn_phleb_contracts WHERE id = ? LIMIT 1",
    [id]
  );
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

async function listAllContracts(limit = 50): Promise<IPhlebContract[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, p.full_name AS phleb_name, p.email AS phleb_account_email
     FROM npn_phleb_contracts c
     INNER JOIN phlebotomy_applications p ON p.id = c.phleb_id
     ORDER BY c.created_at DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows.map((row) => {
    const mapped = mapRow(row);
    return {
      ...mapped,
      full_name: mapped.full_name || (row.phleb_name as string) || null,
      email: mapped.email || (row.phleb_account_email as string) || null,
    };
  });
}

function normalizeStatus(value?: string): PhlebContractStatus {
  const raw = (value ?? "submitted").trim().toLowerCase();
  if (raw === "draft") return "draft";
  if (raw === "approved") return "approved";
  if (raw === "rejected") return "rejected";
  return "submitted";
}

async function createContract(
  phlebId: number,
  input: IPhlebContractInput
): Promise<IPhlebContract> {
  const status = normalizeStatus(input.status);
  const columns: string[] = ["phleb_id", "status"];
  const placeholders: string[] = ["?", "?"];
  const values: unknown[] = [phlebId, status];

  for (const key of WRITABLE_FIELDS) {
    const val = input[key as keyof IPhlebContractInput];
    if (val !== undefined) {
      columns.push(key);
      placeholders.push("?");
      values.push(val === "" ? null : String(val).trim());
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO npn_phleb_contracts (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})`,
    values
  );

  const created = await getContractById(result.insertId);
  if (!created) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to load created contract"
    );
  }
  return created;
}

async function reviewContract(
  contractId: number,
  review: IPhlebContractReview,
  reviewerName: string
): Promise<IPhlebContract | null> {
  if (review.status !== "approved" && review.status !== "rejected") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "status must be approved or rejected"
    );
  }

  const existing = await getContractById(contractId);
  if (!existing) return null;

  await pool.query(
    `UPDATE npn_phleb_contracts
     SET status = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [review.status, reviewerName, contractId]
  );

  return getContractById(contractId);
}

export default {
  getContractsByPhlebId,
  getContractById,
  listAllContracts,
  createContract,
  reviewContract,
} as const;
