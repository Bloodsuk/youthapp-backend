import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import MailService from "@src/services/MailService";
import {
  IPhlebKitBalance,
  IPhlebKitOverview,
  IPhlebKitRequest,
  IPhlebKitRequestCreate,
  IPhlebKitSummary,
  IPhlebKitType,
  PhlebKitRequestPriority,
} from "@src/interfaces/IPhlebKit";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

export const Errors = {
  KitTypeNotFound: "Kit type not found or inactive",
  InvalidQuantity: "Quantity must be at least 1",
  InvalidPriority: "Priority must be Normal or Urgent",
} as const;

/** Alert admin when total on-hand kits is at or below this count. */
const LOW_KIT_STOCK_THRESHOLD = 2;

/** One alert email per phleb per calendar day (in-process dedup). */
const lowStockNotifiedToday = new Map<number, string>();

async function getPhlebContact(phlebId: number): Promise<{
  full_name: string;
  email: string | null;
  phone: string | null;
} | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT full_name, email, phone
     FROM phlebotomy_applications
     WHERE id = ?
     LIMIT 1`,
    [phlebId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    full_name: String(row.full_name ?? "Phlebotomist"),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
  };
}

async function notifyLowKitStockIfNeeded(
  phlebId: number,
  overview: IPhlebKitOverview
): Promise<void> {
  const total = overview.summary.expected_remaining_stock;
  if (total > LOW_KIT_STOCK_THRESHOLD) return;

  const today = new Date().toISOString().slice(0, 10);
  if (lowStockNotifiedToday.get(phlebId) === today) return;
  lowStockNotifiedToday.set(phlebId, today);

  const phleb = await getPhlebContact(phlebId);
  if (!phleb) return;

  try {
    await MailService.sendLowKitStockAlertEmail({
      phlebId,
      phlebName: phleb.full_name,
      phlebEmail: phleb.email,
      phlebPhone: phleb.phone,
      totalRemaining: total,
      threshold: LOW_KIT_STOCK_THRESHOLD,
      balances: overview.balances.map((b) => ({
        kit_name: b.kit_name,
        current_balance: b.current_balance,
      })),
    });
  } catch (err) {
    console.error("[PhlebKitService] low kit stock email failed", {
      phlebId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function normalizePriority(value?: string): PhlebKitRequestPriority {
  const raw = (value ?? "Normal").trim();
  if (raw === "Urgent") return "Urgent";
  if (raw === "Normal") return "Normal";
  throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidPriority);
}

async function getActiveKitTypes(): Promise<IPhlebKitType[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, kit_name, service_type_id, default_per_job, low_stock_threshold, is_active, created_at
     FROM npn_kit_types
     WHERE is_active = 1
     ORDER BY kit_name ASC`
  );
  return rows as IPhlebKitType[];
}

const requestSelect = `SELECT r.id, r.phleb_id, r.kit_type_id, t.kit_name,
            r.quantity_requested, r.priority, r.request_note, r.status,
            r.dispatched_qty, r.dispatch_date, r.courier_ref, r.dispatched_by,
            r.created_at, r.updated_at`;

async function getRequestsByPhlebId(phlebId: number): Promise<IPhlebKitRequest[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${requestSelect}
     FROM npn_kit_requests r
     INNER JOIN npn_kit_types t ON t.id = r.kit_type_id
     WHERE r.phleb_id = ?
     ORDER BY r.created_at DESC`,
    [phlebId]
  );
  return rows as IPhlebKitRequest[];
}

async function getRequestById(id: number): Promise<IPhlebKitRequest | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${requestSelect}
     FROM npn_kit_requests r
     INNER JOIN npn_kit_types t ON t.id = r.kit_type_id
     WHERE r.id = ?
     LIMIT 1`,
    [id]
  );
  return rows.length > 0 ? (rows[0] as IPhlebKitRequest) : null;
}

async function getBalancesByPhlebId(phlebId: number): Promise<IPhlebKitBalance[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.id AS kit_type_id, t.kit_name,
            COALESCE(s.current_balance, 0) AS current_balance,
            t.low_stock_threshold
     FROM npn_kit_types t
     LEFT JOIN npn_phleb_kit_stock s
       ON s.kit_type_id = t.id AND s.phleb_id = ?
     WHERE t.is_active = 1
     ORDER BY t.kit_name ASC`,
    [phlebId]
  );
  return rows as IPhlebKitBalance[];
}

async function getSummaryByPhlebId(phlebId: number): Promise<IPhlebKitSummary> {
  const [jobRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS jobs_completed
     FROM pleb_jobs
     WHERE pleb_id = ?
       AND job_status = 'Delivered'
       AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
    [phlebId]
  );
  const jobsCompleted = Number(jobRows[0]?.jobs_completed ?? 0);

  const [kitPerJobRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(MIN(default_per_job), 1) AS kits_per_job
     FROM npn_kit_types
     WHERE is_active = 1`
  );
  const kitsPerJob = Number(kitPerJobRows[0]?.kits_per_job ?? 1);

  const [lastReceivedRows] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(dispatch_date) AS last_received
     FROM npn_kit_requests
     WHERE phleb_id = ?
       AND status = 'Dispatched'
       AND dispatch_date IS NOT NULL`,
    [phlebId]
  );
  const lastReceived = lastReceivedRows[0]?.last_received ?? null;

  const balances = await getBalancesByPhlebId(phlebId);
  const expectedRemaining = balances.reduce(
    (sum, row) => sum + Number(row.current_balance ?? 0),
    0
  );

  return {
    last_kit_received_date: lastReceived
      ? String(lastReceived).slice(0, 10)
      : null,
    total_kits_used_this_month: jobsCompleted * kitsPerJob,
    total_jobs_completed_this_month: jobsCompleted,
    expected_remaining_stock: expectedRemaining,
  };
}

async function getOverviewByPhlebId(phlebId: number): Promise<IPhlebKitOverview> {
  const balances = await getBalancesByPhlebId(phlebId);
  const summary = await getSummaryByPhlebId(phlebId);
  const overview = { balances, summary };
  void notifyLowKitStockIfNeeded(phlebId, overview);
  return overview;
}

async function createRequest(
  phlebId: number,
  body: IPhlebKitRequestCreate
): Promise<IPhlebKitRequest> {
  const kitTypeId = Number(body.kit_type_id);
  const quantity = Number(body.quantity_requested);
  const note = body.request_note?.trim() || null;
  const priority = normalizePriority(body.priority);

  if (!Number.isFinite(kitTypeId) || kitTypeId < 1) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.KitTypeNotFound);
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidQuantity);
  }

  const [typeRows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM npn_kit_types WHERE id = ? AND is_active = 1",
    [kitTypeId]
  );
  if (typeRows.length === 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.KitTypeNotFound);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO npn_kit_requests
       (phleb_id, kit_type_id, quantity_requested, priority, request_note, status)
     VALUES (?, ?, ?, ?, ?, 'Pending')`,
    [phlebId, kitTypeId, quantity, priority, note]
  );

  const created = await getRequestById(result.insertId);
  if (!created) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to load created kit request"
    );
  }

  void getOverviewByPhlebId(phlebId);

  return created;
}

export default {
  getActiveKitTypes,
  getRequestsByPhlebId,
  getOverviewByPhlebId,
  createRequest,
} as const;
