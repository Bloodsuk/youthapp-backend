import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import {
  GymPhlebBookingStatus,
  IGymPhlebBooking,
} from "@src/interfaces/IGymPhlebBooking";
import { RouteError } from "@src/other/classes";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";

const NOT_FOUND_ERR = "Gym booking not found";
const INVALID_STATUS_ERR = "Invalid gym booking status";
const INVALID_TRANSITION_ERR =
  "This status change is not allowed for this gym booking";

/** Same transitions as event bookings / dashboard PHP. */
const ALLOWED_TRANSITIONS: Record<
  GymPhlebBookingStatus,
  GymPhlebBookingStatus[]
> = {
  Assigned: ["Pickup", "Cancelled"],
  Pickup: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

const STATUS_SET = new Set<string>([
  "Assigned",
  "Pickup",
  "Delivered",
  "Cancelled",
]);

function normalizeStatus(raw: string): GymPhlebBookingStatus | null {
  const trimmed = raw.trim();
  const aliases: Record<string, GymPhlebBookingStatus> = {
    assigned: "Assigned",
    pickup: "Pickup",
    "picked up": "Pickup",
    delivered: "Delivered",
    cancelled: "Cancelled",
    canceled: "Cancelled",
  };
  const key = trimmed.toLowerCase();
  if (aliases[key]) return aliases[key];
  if (STATUS_SET.has(trimmed)) return trimmed as GymPhlebBookingStatus;
  return null;
}

function formatTime(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null") return null;
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function formatDate(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    // Prefer calendar date in local time — mysql2 DATE can shift with toISOString().
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function mapRow(row: RowDataPacket): IGymPhlebBooking {
  const start = formatTime(row.start_time);
  const end = formatTime(row.end_time);
  let booking_time: string | null = null;
  if (start && end) booking_time = `${start} - ${end}`;
  else if (start) booking_time = start;

  return {
    id: Number(row.id),
    gym_post_id: Number(row.gym_post_id ?? 0),
    gym_name: String(row.gym_name ?? ""),
    gym_address:
      row.gym_address != null && String(row.gym_address).trim() !== ""
        ? String(row.gym_address).trim()
        : null,
    booking_date: formatDate(row.booking_date),
    start_time: start ?? "",
    end_time: end,
    pleb_id: Number(row.pleb_id),
    pay_amount: Number(row.payout_amount ?? 0),
    job_status: String(row.job_status) as GymPhlebBookingStatus,
    is_paid: Number(row.is_paid) === 1,
    created_by:
      row.created_by != null && String(row.created_by).trim() !== ""
        ? String(row.created_by)
        : null,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at ?? ""),
    modified_at:
      row.modified_at instanceof Date
        ? row.modified_at.toISOString()
        : String(row.modified_at ?? ""),
    booking_time,
  };
}

async function getById(id: number): Promise<IGymPhlebBooking | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, gym_post_id, gym_name, gym_address, booking_date, start_time,
            end_time, pleb_id, payout_amount, job_status, is_paid, created_by,
            created_at, modified_at
     FROM gym_phleb_bookings
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return mapRow(rows[0]);
}

async function getByPlebId(plebId: number): Promise<IGymPhlebBooking[]> {
  if (!Number.isFinite(plebId) || plebId <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid phlebotomist id");
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, gym_post_id, gym_name, gym_address, booking_date, start_time,
            end_time, pleb_id, payout_amount, job_status, is_paid, created_by,
            created_at, modified_at
     FROM gym_phleb_bookings
     WHERE pleb_id = ?
     ORDER BY booking_date DESC, start_time DESC, id DESC`,
    [plebId]
  );

  return rows.map(mapRow);
}

async function updateStatus(
  id: number,
  nextStatusRaw: string,
  actingPlebId?: number
): Promise<IGymPhlebBooking> {
  const booking = await getById(id);
  if (!booking) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }

  if (
    actingPlebId != null &&
    Number.isFinite(actingPlebId) &&
    booking.pleb_id !== actingPlebId
  ) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "You can only update your own gym bookings"
    );
  }

  const nextStatus = normalizeStatus(nextStatusRaw);
  if (!nextStatus) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, INVALID_STATUS_ERR);
  }

  if (booking.job_status === nextStatus) {
    return booking;
  }

  const allowed = ALLOWED_TRANSITIONS[booking.job_status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      `${INVALID_TRANSITION_ERR}: ${booking.job_status} → ${nextStatus}`
    );
  }

  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE gym_phleb_bookings SET job_status = ? WHERE id = ?",
    [nextStatus, id]
  );

  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }

  const refreshed = await getById(id);
  if (!refreshed) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  return refreshed;
}

export default {
  getById,
  getByPlebId,
  updateStatus,
  normalizeStatus,
  ALLOWED_TRANSITIONS,
} as const;
