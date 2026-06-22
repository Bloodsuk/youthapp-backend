import { pool } from "@src/server";
import { RowDataPacket } from "mysql2";
import {
  IPhlebApprovedTaskRecord,
  IPhlebCompetencySignoff,
  IPhlebTrainingMatrixItem,
  IPhlebTrainingOverview,
  PhlebTrainingOverallStatus,
  PhlebTrainingRecordStatus,
} from "@src/interfaces/IPhlebTraining";

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

function parseApprovedTaskIds(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
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

function deriveTrainingStatus(
  completedDate: string | null,
  nextDueDate: string | null
): PhlebTrainingRecordStatus {
  if (!completedDate) return "notStarted";
  if (!nextDueDate) return "valid";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);

  if (days < 0) return "expired";
  if (days <= 30) return "expiringSoon";
  return "valid";
}

function deriveOverallStatus(
  renewalDueCount: number,
  pendingSignOffCount: number,
  expiredCount: number
): PhlebTrainingOverallStatus {
  if (pendingSignOffCount > 0 || expiredCount > 0) return "actionRequired";
  if (renewalDueCount > 0) return "renewalDue";
  return "fullyQualified";
}

async function getMatrixByPhlebId(
  phlebId: number
): Promise<IPhlebTrainingMatrixItem[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, item_name, completed_date, next_due_date
     FROM npn_phleb_training
     WHERE phleb_id = ?
     ORDER BY item_name ASC`,
    [phlebId]
  );

  return rows.map((row) => {
    const completed = toDateOnly(row.completed_date);
    const nextDue = toDateOnly(row.next_due_date);
    return {
      id: Number(row.id),
      item_name: String(row.item_name ?? ""),
      status: deriveTrainingStatus(completed, nextDue),
      completed_date: completed,
      next_due_date: nextDue,
      mandatory: false,
    };
  });
}

async function getApprovedTasksByPhlebId(
  phlebId: number
): Promise<IPhlebApprovedTaskRecord[]> {
  const [phlebRows] = await pool.query<RowDataPacket[]>(
    "SELECT approved_tasks FROM phlebotomy_applications WHERE id = ? LIMIT 1",
    [phlebId]
  );
  const approvedIds = new Set(
    parseApprovedTaskIds(phlebRows[0]?.approved_tasks as string | null)
  );

  const [serviceTypes] = await pool.query<RowDataPacket[]>(
    `SELECT id, task_name, required_competency
     FROM npn_service_types
     WHERE is_active = 1
     ORDER BY task_name ASC`
  );

  return serviceTypes.map((row) => ({
    id: Number(row.id),
    task_name: String(row.task_name ?? ""),
    required_competency: row.required_competency
      ? String(row.required_competency)
      : null,
    approved: approvedIds.has(Number(row.id)),
  }));
}

async function getCompetencyByPhlebId(
  phlebId: number
): Promise<IPhlebCompetencySignoff[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, item_key, signed_off, signed_by, signed_at
     FROM npn_phleb_signoffs
     WHERE phleb_id = ?
     ORDER BY item_key ASC`,
    [phlebId]
  );

  return rows.map((row) => {
    const key = String(row.item_key ?? "");
    return {
      id: Number(row.id),
      item_key: key,
      title: SIGNOFF_LABELS[key] ?? key.replace(/_/g, " "),
      completed: Number(row.signed_off) === 1,
      signed_off_by: row.signed_by ? String(row.signed_by) : null,
      signed_off_at: toIsoString(row.signed_at),
    };
  });
}

async function getOverviewByPhlebId(
  phlebId: number
): Promise<IPhlebTrainingOverview> {
  const matrix = await getMatrixByPhlebId(phlebId);
  const tasks = await getApprovedTasksByPhlebId(phlebId);
  const signoffs = await getCompetencyByPhlebId(phlebId);

  const matrixValidCount = matrix.filter((m) => m.status === "valid").length;
  const renewalDueCount = matrix.filter(
    (m) => m.status === "expiringSoon" || m.status === "expired"
  ).length;
  const expiredCount = matrix.filter((m) => m.status === "expired").length;
  const pendingSignOffCount = signoffs.filter((s) => !s.completed).length;
  const approvedTaskCount = tasks.filter((t) => t.approved).length;

  return {
    overall_status: deriveOverallStatus(
      renewalDueCount,
      pendingSignOffCount,
      expiredCount
    ),
    matrix_valid_count: matrixValidCount,
    renewal_due_count: renewalDueCount,
    pending_sign_off_count: pendingSignOffCount,
    approved_task_count: approvedTaskCount,
  };
}

export default {
  getOverviewByPhlebId,
  getMatrixByPhlebId,
  getApprovedTasksByPhlebId,
  getCompetencyByPhlebId,
} as const;
