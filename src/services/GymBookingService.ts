import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IGymBooking } from "@src/interfaces/IGymBooking";
import { RouteError } from "@src/other/classes";
import { pool } from "@src/server";
import { RowDataPacket } from "mysql2";

const DEFAULT_WP_GYM_BOOKING_URL =
  "https://www.youth-revisited.co.uk/wp-json/youthrevisited/v1/gym-booking";

function gymBookingApiUrl(): string {
  return (
    process.env.WP_GYM_BOOKING_API_URL?.trim() || DEFAULT_WP_GYM_BOOKING_URL
  ).replace(/\/$/, "");
}

function gymBookingApiKey(): string {
  const key = process.env.WP_GYM_BOOKING_API_KEY?.trim();
  if (!key) {
    throw new RouteError(
      HttpStatusCodes.SERVICE_UNAVAILABLE,
      "Gym booking API is not configured on the server"
    );
  }
  return key;
}

type WpFetchResult =
  | { status: "ok"; booking: IGymBooking }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string; httpStatus: number };

/**
 * Fetch gym clinic booking from WordPress by WP order id.
 */
async function fetchFromWordPress(wpOrderId: number): Promise<WpFetchResult> {
  if (!Number.isFinite(wpOrderId) || wpOrderId <= 0) {
    return { status: "not_found", message: "Invalid WordPress order id" };
  }

  const url = `${gymBookingApiUrl()}/${wpOrderId}`;
  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-KEY": gymBookingApiKey(),
        Accept: "application/json",
      },
    });
  } catch (error) {
    console.error("WP gym-booking request failed:", error);
    return {
      status: "error",
      message: "Unable to reach gym booking service",
      httpStatus: HttpStatusCodes.BAD_GATEWAY,
    };
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 401) {
    return {
      status: "error",
      message: "Gym booking API authentication failed",
      httpStatus: HttpStatusCodes.BAD_GATEWAY,
    };
  }

  if (response.status === 404 || response.status === 400) {
    return {
      status: "not_found",
      message:
        (body && (body.message || body.error)) ||
        "No Local Gym booking found for this order",
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      message:
        (body && (body.message || body.error)) ||
        `Gym booking service error (${response.status})`,
      httpStatus: HttpStatusCodes.BAD_GATEWAY,
    };
  }

  const data = body?.data ?? body;
  if (!body?.success || !data) {
    return {
      status: "not_found",
      message: body?.message || "No Local Gym booking found for this order",
    };
  }

  const booking: IGymBooking = {
    order_id: Number(data.order_id) || wpOrderId,
    order_status: String(data.order_status ?? ""),
    clinic_id: Number(data.clinic_id) || 0,
    clinic_name: String(data.clinic_name ?? ""),
    booking_date: String(data.booking_date ?? ""),
    booking_time: String(data.booking_time ?? ""),
    booking_day: String(data.booking_day ?? ""),
  };

  return { status: "ok", booking };
}

async function getWpOrderIdForAppOrder(
  appOrderId: number
): Promise<{ id_on_wp: number | null; order_id: string; customer_id: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, order_id, customer_id, id_on_wp FROM orders WHERE id = ? LIMIT 1",
    [appOrderId]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Order not found");
  }
  const row = rows[0];
  const raw = row.id_on_wp;
  const idOnWp =
    raw === null || raw === undefined || Number(raw) <= 0
      ? null
      : Number(raw);
  return {
    id_on_wp: idOnWp,
    order_id: String(row.order_id ?? ""),
    customer_id: Number(row.customer_id),
  };
}

/**
 * Resolve gym booking for an app order (via orders.id_on_wp).
 */
async function getForAppOrder(appOrderId: number): Promise<{
  has_booking: boolean;
  id_on_wp: number | null;
  booking: IGymBooking | null;
  message?: string;
}> {
  const meta = await getWpOrderIdForAppOrder(appOrderId);
  if (!meta.id_on_wp) {
    return {
      has_booking: false,
      id_on_wp: null,
      booking: null,
      message: "Order is not linked to a WordPress order",
    };
  }

  const result = await fetchFromWordPress(meta.id_on_wp);
  if (result.status === "ok") {
    return {
      has_booking: true,
      id_on_wp: meta.id_on_wp,
      booking: result.booking,
    };
  }
  if (result.status === "not_found") {
    return {
      has_booking: false,
      id_on_wp: meta.id_on_wp,
      booking: null,
      message: result.message,
    };
  }
  throw new RouteError(result.httpStatus, result.message);
}

/**
 * List gym bookings for a customer across WP-linked orders.
 */
async function listForCustomer(customerId: number): Promise<{
  bookings: Array<{
    app_order_id: number;
    app_order_code: string;
    id_on_wp: number;
    booking: IGymBooking;
  }>;
}> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, order_id, id_on_wp
     FROM orders
     WHERE customer_id = ?
       AND id_on_wp IS NOT NULL
       AND id_on_wp > 0
     ORDER BY id DESC
     LIMIT 20`,
    [customerId]
  );

  const bookings: Array<{
    app_order_id: number;
    app_order_code: string;
    id_on_wp: number;
    booking: IGymBooking;
  }> = [];

  // Sequential to avoid hammering WP; customers rarely have many gym orders.
  for (const row of rows) {
    const idOnWp = Number(row.id_on_wp);
    const result = await fetchFromWordPress(idOnWp);
    if (result.status === "ok") {
      bookings.push({
        app_order_id: Number(row.id),
        app_order_code: String(row.order_id ?? ""),
        id_on_wp: idOnWp,
        booking: result.booking,
      });
    }
  }

  return { bookings };
}

export default {
  getForAppOrder,
  listForCustomer,
  fetchFromWordPress,
} as const;
