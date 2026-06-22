import { pool } from "@src/server";
import { RowDataPacket } from "mysql2";
import {
  IPhlebPerformanceOverview,
  IPhlebPerformanceRecentJob,
  IPhlebPerformanceSummary,
} from "@src/interfaces/IPhlebPerformance";

function toIsoString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toISOString();
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

function parseTime12h(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return { hours, minutes };
}

function bookingWindowEnd(bookingDate: string | null, endTime: string | null): Date | null {
  if (!bookingDate) return null;
  const datePart = bookingDate.slice(0, 10);
  const base = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  if (!endTime) {
    base.setHours(23, 59, 59, 999);
    return base;
  }
  const parsed = parseTime12h(endTime);
  if (!parsed) {
    base.setHours(23, 59, 59, 999);
    return base;
  }
  base.setHours(parsed.hours, parsed.minutes, 59, 999);
  return base;
}

function isDeliveredOnTime(
  modifiedAt: string | null,
  bookingDate: string | null,
  endTime: string | null
): boolean | null {
  if (!modifiedAt) return null;
  const delivered = new Date(modifiedAt);
  if (Number.isNaN(delivered.getTime())) return null;
  const windowEnd = bookingWindowEnd(bookingDate, endTime);
  if (!windowEnd) return null;
  return delivered.getTime() <= windowEnd.getTime();
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function relativeDaysAgo(isoDate: string | null): string {
  if (!isoDate) return "";
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return "";
  const diffMs = Date.now() - then.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

async function getSummaryByPhlebId(phlebId: number): Promise<IPhlebPerformanceSummary> {
  const [monthRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS jobs_this_month,
       SUM(CASE WHEN job_status = 'Delivered' THEN 1 ELSE 0 END) AS delivered_this_month,
       SUM(CASE WHEN job_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_this_month
     FROM pleb_jobs
     WHERE pleb_id = ?
       AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
    [phlebId]
  );
  const month = monthRows[0] ?? {};

  const [activeRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS active_jobs
     FROM pleb_jobs
     WHERE pleb_id = ?
       AND job_status NOT IN ('Delivered', 'Cancelled')`,
    [phlebId]
  );

  const [allTimeRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_delivered
     FROM pleb_jobs
     WHERE pleb_id = ? AND job_status = 'Delivered'`,
    [phlebId]
  );

  const deliveredThisMonth = Number(month.delivered_this_month ?? 0);
  const cancelledThisMonth = Number(month.cancelled_this_month ?? 0);
  const terminalThisMonth = deliveredThisMonth + cancelledThisMonth;

  const [onTimeRows] = await pool.query<RowDataPacket[]>(
    `SELECT pj.modified_at, cpb.client_booking_date, cpb.client_booking_end_time
     FROM pleb_jobs pj
     LEFT JOIN customer_phleb_bookings cpb ON cpb.order_id = pj.order_id
     WHERE pj.pleb_id = ?
       AND pj.job_status = 'Delivered'
       AND pj.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
    [phlebId]
  );

  let onTimeCount = 0;
  let onTimeEligible = 0;
  for (const row of onTimeRows) {
    const onTime = isDeliveredOnTime(
      toIsoString(row.modified_at),
      toDateOnly(row.client_booking_date),
      row.client_booking_end_time ? String(row.client_booking_end_time) : null
    );
    if (onTime === null) continue;
    onTimeEligible += 1;
    if (onTime) onTimeCount += 1;
  }

  return {
    jobs_this_month: Number(month.jobs_this_month ?? 0),
    delivered_this_month: deliveredThisMonth,
    active_jobs: Number(activeRows[0]?.active_jobs ?? 0),
    cancelled_this_month: cancelledThisMonth,
    completion_rate: pct(deliveredThisMonth, terminalThisMonth),
    on_time_rate: pct(onTimeCount, onTimeEligible),
    total_delivered_all_time: Number(allTimeRows[0]?.total_delivered ?? 0),
  };
}

async function getRecentJobsByPhlebId(
  phlebId: number,
  limit = 10
): Promise<IPhlebPerformanceRecentJob[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT pj.id AS job_id, pj.order_id, pj.job_status, pj.modified_at, pj.created_at,
            cpb.client_booking_date, cpb.client_booking_end_time
     FROM pleb_jobs pj
     LEFT JOIN customer_phleb_bookings cpb ON cpb.order_id = pj.order_id
     WHERE pj.pleb_id = ?
       AND pj.job_status IN ('Delivered', 'Cancelled', 'In Transit', 'Picked Up', 'Assigned')
     ORDER BY COALESCE(pj.modified_at, pj.created_at) DESC
     LIMIT ?`,
    [phlebId, limit]
  );

  return rows.map((row) => {
    const status = String(row.job_status ?? "");
    const modifiedAt = toIsoString(row.modified_at);
    const bookingDate = toDateOnly(row.client_booking_date);
    const endTime = row.client_booking_end_time
      ? String(row.client_booking_end_time)
      : null;
    const onTime =
      status === "Delivered"
        ? isDeliveredOnTime(modifiedAt, bookingDate, endTime)
        : null;

    let title = status;
    let subtitle = `Order #${row.order_id}`;
    if (status === "Delivered") {
      title = onTime === false ? "Visit completed (late)" : "Visit completed";
      subtitle = `Order #${row.order_id} · ${relativeDaysAgo(modifiedAt)}`;
    } else if (status === "Cancelled") {
      title = "Visit cancelled";
      subtitle = `Order #${row.order_id} · ${relativeDaysAgo(modifiedAt)}`;
    } else {
      subtitle = `Order #${row.order_id} · ${status}`;
    }

    return {
      job_id: Number(row.job_id),
      order_id: Number(row.order_id),
      job_status: status,
      completed_at: modifiedAt,
      booking_date: bookingDate,
      title,
      subtitle,
      on_time: onTime,
    };
  });
}

async function getOverviewByPhlebId(phlebId: number): Promise<IPhlebPerformanceOverview> {
  const summary = await getSummaryByPhlebId(phlebId);
  const recent_jobs = await getRecentJobsByPhlebId(phlebId);
  return {
    summary,
    recent_jobs,
    has_feedback: false,
  };
}

export default {
  getOverviewByPhlebId,
} as const;
