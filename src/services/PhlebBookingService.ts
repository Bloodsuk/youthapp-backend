import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { IPhlebBooking } from "@src/interfaces/IPhlebBooking";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

// **** Variables **** //

export const NOT_FOUND_ERR = "Phleb booking not found";

// **** Functions **** //

/**
 * Save phlebotomist booking to database
 */
async function saveBooking(
  orderId: number,
  bookingData: Omit<IPhlebBooking, "id" | "order_id" | "created_at">
): Promise<number> {
  const booking: Record<string, any> = {
    order_id: orderId,
    slot_times: bookingData.slot_times,
    price: bookingData.price,
    weekend_surcharge: bookingData.weekend_surcharge || "0",
    zone: bookingData.zone,
    shift_type: bookingData.shift_type,
  };

  const optionalStringFields: (keyof Omit<IPhlebBooking, "id" | "order_id" | "created_at">)[] = [
    "availability",
    "additional_preferences",
    "available_days",
    "blood_draw_issues",
    "blood_draw_issue_types",
    "blood_draw_issue_detail",
    "customer_postcode",
  ];
  for (const key of optionalStringFields) {
    const val = bookingData[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      booking[key] = val;
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO customer_phleb_bookings SET ?",
    booking
  );

  if (!result.insertId) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to save phleb booking"
    );
  }

  return result.insertId;
}

/**
 * Get booking by order ID
 */
async function getBookingByOrderId(orderId: number): Promise<IPhlebBooking | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM customer_phleb_bookings WHERE order_id = ? LIMIT 1",
    [orderId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as IPhlebBooking;
}

/**
 * Get booking by ID
 */
async function getBookingById(id: number): Promise<IPhlebBooking | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM customer_phleb_bookings WHERE id = ? LIMIT 1",
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as IPhlebBooking;
}

/**
 * Update practitioner notes for a home-visit order.
 * Stored on `orders.note_by_practitioner` (website/dashboard parity).
 */
async function updateNotes(orderId: number, notes: string): Promise<IPhlebBooking> {
  const existing = await getBookingByOrderId(orderId);
  if (!existing) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }

  const [orderResult] = await pool.query<ResultSetHeader>(
    "UPDATE orders SET note_by_practitioner = ? WHERE id = ?",
    [notes, orderId]
  );

  if (orderResult.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Order not found");
  }

  // Keep booking.notes in sync for older readers that still join this column.
  await pool.query(
    "UPDATE customer_phleb_bookings SET notes = ? WHERE order_id = ?",
    [notes, orderId]
  );

  const updated = await getBookingByOrderId(orderId);
  if (!updated) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  return {
    ...updated,
    notes,
  };
}

// **** Export default **** //

export default {
  saveBooking,
  getBookingByOrderId,
  getBookingById,
  updateNotes,
} as const;

