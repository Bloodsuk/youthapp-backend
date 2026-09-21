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

/** WP contract PDFs live on the practitioner site, not prapp uploads. */
const WP_CONTRACT_FILES_BASE_URL =
  process.env.WP_CONTRACT_FILES_BASE_URL?.trim() ||
  process.env.PUBLIC_FILES_BASE_URL?.trim() ||
  "https://www.practitioner.youth-revisited.co.uk";

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
  if (fs.existsSync(localFile)) return `/${normalized}`;
  const base = WP_CONTRACT_FILES_BASE_URL.replace(/\/$/, "");
  return `${base}/${normalized}`;
}

function deriveWpContractStatus(row: RowDataPacket): PhlebContractStatus {
  const youth =
    row.youth_signature != null && String(row.youth_signature).trim() !== "";
  return youth ? "approved" : "submitted";
}

/** Map WordPress `wp_phleb_contracts` (application_id) into the app contract shape. */
function mapWpRow(row: RowDataPacket): IPhlebContract {
  const status = deriveWpContractStatus(row);
  const mapped: IPhlebContract = {
    id: Number(row.id),
    phleb_id: Number(row.application_id),
    created_at: row.created_at
      ? new Date(row.created_at).toISOString()
      : new Date().toISOString(),
    updated_at: row.created_at
      ? new Date(row.created_at).toISOString()
      : new Date().toISOString(),
    status,
    contractor_name: row.contractor_name != null ? String(row.contractor_name) : null,
    address: row.address != null ? String(row.address) : null,
    phone: row.phone != null ? String(row.phone) : null,
    email: row.email != null ? String(row.email) : null,
    full_name: row.full_name != null ? String(row.full_name) : null,
    dob: row.dob != null ? String(row.dob) : null,
    home_address: row.home_address != null ? String(row.home_address) : null,
    mobile_number: row.mobile_number != null ? String(row.mobile_number) : null,
    personal_email:
      row.personal_email != null ? String(row.personal_email) : null,
    emergency_contact:
      row.emergency_contact != null ? String(row.emergency_contact) : null,
    areas_covered: row.areas_covered != null ? String(row.areas_covered) : null,
    travel_radius: row.travel_radius != null ? String(row.travel_radius) : null,
    available_days:
      row.available_days != null ? String(row.available_days) : null,
    weekend_availability:
      row.weekend_availability != null
        ? String(row.weekend_availability)
        : null,
    clinic_mobile: row.clinic_mobile != null ? String(row.clinic_mobile) : null,
    own_vehicle: row.own_vehicle != null ? String(row.own_vehicle) : null,
    account_name: row.account_name != null ? String(row.account_name) : null,
    sort_code: row.sort_code != null ? String(row.sort_code) : null,
    account_number:
      row.account_number != null ? String(row.account_number) : null,
    payment_frequency:
      row.payment_frequency != null ? String(row.payment_frequency) : null,
    cv_file: row.cv_file != null ? String(row.cv_file) : null,
    phlebotomy_qualifications:
      row.phlebotomy_qualifications != null
        ? String(row.phlebotomy_qualifications)
        : null,
    relevant_certificates:
      row.relevant_certificates != null
        ? String(row.relevant_certificates)
        : null,
    cpd_training: row.cpd_training != null ? String(row.cpd_training) : null,
    clinical_competencies:
      row.clinical_competencies != null
        ? String(row.clinical_competencies)
        : null,
    hep_b_proof: row.hep_b_proof != null ? String(row.hep_b_proof) : null,
    occupational_health_records:
      row.occupational_health_records != null
        ? String(row.occupational_health_records)
        : null,
    dbs_adults: row.dbs_adults != null ? String(row.dbs_adults) : null,
    dbs_children: row.dbs_children != null ? String(row.dbs_children) : null,
    right_to_work: row.right_to_work != null ? String(row.right_to_work) : null,
    utr_file: row.utr_file != null ? String(row.utr_file) : null,
    contractor_signature:
      row.contractor_signature != null
        ? String(row.contractor_signature)
        : null,
    contractor_signature_date:
      row.contractor_signature_date != null
        ? String(row.contractor_signature_date)
        : null,
    youth_signature:
      row.youth_signature != null ? String(row.youth_signature) : null,
    youth_signature_date:
      row.youth_signature_date != null
        ? String(row.youth_signature_date)
        : null,
    declaration_signature:
      row.declaration_signature != null
        ? String(row.declaration_signature)
        : null,
    declaration_name:
      row.declaration_name != null ? String(row.declaration_name) : null,
    declaration_date:
      row.declaration_date != null ? String(row.declaration_date) : null,
    bank_signature:
      row.bank_signature != null ? String(row.bank_signature) : null,
    bank_signature_date:
      row.bank_signature_date != null
        ? String(row.bank_signature_date)
        : null,
    reviewed_by: null,
    reviewed_at: null,
  };

  const withUrls = mapped as IPhlebContract & Record<string, unknown>;
  for (const field of FILE_FIELDS) {
    withUrls[`${field}_url`] = buildFileUrl(mapped[field] as string | null);
  }
  return withUrls;
}

async function getContractsByPhlebId(phlebId: number): Promise<IPhlebContract[]> {
  // Source of truth for admin + app: WordPress contracts table.
  const [byApp] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM wp_phleb_contracts
     WHERE application_id = ?
     ORDER BY created_at DESC, id DESC`,
    [phlebId]
  );
  if (byApp.length) return byApp.map(mapWpRow);

  const [phlebRows] = await pool.query<RowDataPacket[]>(
    `SELECT email FROM phlebotomy_applications WHERE id = ? LIMIT 1`,
    [phlebId]
  );
  const email = (
    phlebRows[0]?.email != null ? String(phlebRows[0].email) : ""
  )
    .trim()
    .toLowerCase();
  if (!email) return [];

  const [byEmail] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM wp_phleb_contracts
     WHERE LOWER(TRIM(IFNULL(email, ''))) = ?
        OR LOWER(TRIM(IFNULL(personal_email, ''))) = ?
     ORDER BY created_at DESC, id DESC`,
    [email, email]
  );
  return byEmail.map(mapWpRow);
}

async function getContractById(id: number): Promise<IPhlebContract | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM wp_phleb_contracts WHERE id = ? LIMIT 1",
    [id]
  );
  return rows.length > 0 ? mapWpRow(rows[0]) : null;
}

async function listAllContracts(limit = 50): Promise<IPhlebContract[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, p.full_name AS phleb_name, p.email AS phleb_account_email
     FROM wp_phleb_contracts c
     INNER JOIN phlebotomy_applications p ON p.id = c.application_id
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows.map((row) => {
    const mapped = mapWpRow(row);
    return {
      ...mapped,
      full_name: mapped.full_name || (row.phleb_name as string) || null,
      email: mapped.email || (row.phleb_account_email as string) || null,
    };
  });
}

function createContract(
  _phlebId: number,
  _input: IPhlebContractInput
): Promise<IPhlebContract> {
  // Admin reviews agreements in WordPress (`wp_phleb_contracts`), not this table.
  // Writing here made the app show "under review" while admin saw nothing.
  throw new RouteError(
    HttpStatusCodes.BAD_REQUEST,
    "Agreement documents cannot be uploaded here. Open Agreement on your dashboard and upload to your WordPress contract instead."
  );
}

/** Remove mistaken app-only contract rows admin never sees (wp_phleb_contracts is source of truth). */
async function deleteWrongCollectionContracts(): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM npn_phleb_contracts"
  );
  return result.affectedRows;
}

async function reviewContract(
  _contractId: number,
  _review: IPhlebContractReview,
  _reviewerName: string
): Promise<IPhlebContract | null> {
  // Approvals are done in the admin/WP dashboard (youth_signature), not via this API.
  throw new RouteError(
    HttpStatusCodes.BAD_REQUEST,
    "Contract review is managed in the admin dashboard (wp_phleb_contracts), not this API"
  );
}

export default {
  getContractsByPhlebId,
  getContractById,
  listAllContracts,
  createContract,
  reviewContract,
  deleteWrongCollectionContracts,
} as const;
