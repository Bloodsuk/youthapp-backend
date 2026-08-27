import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import {
  EventBookingStatus,
  IEventBooking,
} from "@src/interfaces/IEventBooking";
import { RouteError } from "@src/other/classes";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";

const EVENT_NOT_FOUND_ERR = "Event booking not found";
const INVALID_STATUS_ERR = "Invalid event booking status";
const INVALID_TRANSITION_ERR =
  "This status change is not allowed for this event booking";

/** Allowed transitions — mirrors Gym phleb bookings / dashboard PHP. */
const ALLOWED_TRANSITIONS: Record<EventBookingStatus, EventBookingStatus[]> = {
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

function normalizeStatus(raw: string): EventBookingStatus | null {
  const trimmed = raw.trim();
  // Accept common aliases from the app / older UIs
  const aliases: Record<string, EventBookingStatus> = {
    assigned: "Assigned",
    pickup: "Pickup",
    "picked up": "Pickup",
    delivered: "Delivered",
    cancelled: "Cancelled",
    canceled: "Cancelled",
  };
  const key = trimmed.toLowerCase();
  if (aliases[key]) return aliases[key];
  if (STATUS_SET.has(trimmed)) return trimmed as EventBookingStatus;
  return null;
}

function formatTime(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null") return null;
  // MySQL TIME often comes as "HH:MM:SS"
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function formatDate(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function mapRow(row: RowDataPacket): IEventBooking {
  const start = formatTime(row.start_time);
  const end = formatTime(row.end_time);
  let booking_time: string | null = null;
  if (start && end) booking_time = `${start} - ${end}`;
  else if (start) booking_time = start;

  return {
    id: Number(row.id),
    event_name: String(row.event_name ?? ""),
    event_address:
      row.event_address != null && String(row.event_address).trim() !== ""
        ? String(row.event_address).trim()
        : null,
    booking_date: formatDate(row.booking_date),
    start_time: start ?? "",
    end_time: end,
    pleb_id: Number(row.pleb_id),
    pay_amount: Number(row.pay_amount ?? 0),
    job_status: String(row.job_status) as EventBookingStatus,
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

async function getById(id: number): Promise<IEventBooking | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, event_name, event_address, booking_date, start_time, end_time,
            pleb_id, pay_amount, job_status, is_paid, created_by,
            created_at, modified_at
     FROM event_bookings
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return mapRow(rows[0]);
}

async function getByPlebId(plebId: number): Promise<IEventBooking[]> {
  if (!Number.isFinite(plebId) || plebId <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid phlebotomist id");
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, event_name, event_address, booking_date, start_time, end_time,
            pleb_id, pay_amount, job_status, is_paid, created_by,
            created_at, modified_at
     FROM event_bookings
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
): Promise<IEventBooking> {
  const booking = await getById(id);
  if (!booking) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, EVENT_NOT_FOUND_ERR);
  }

  if (
    actingPlebId != null &&
    Number.isFinite(actingPlebId) &&
    booking.pleb_id !== actingPlebId
  ) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "You can only update your own event bookings"
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
    "UPDATE event_bookings SET job_status = ? WHERE id = ?",
    [nextStatus, id]
  );

  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, EVENT_NOT_FOUND_ERR);
  }

  const refreshed = await getById(id);
  if (!refreshed) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, EVENT_NOT_FOUND_ERR);
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
