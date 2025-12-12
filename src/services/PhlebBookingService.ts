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

  // Only include optional fields if they have values
  if (bookingData.availability) {
    booking.availability = bookingData.availability;
  }
  if (bookingData.additional_preferences) {
    booking.additional_preferences = bookingData.additional_preferences;
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

// **** Export default **** //

export default {
  saveBooking,
  getBookingByOrderId,
  getBookingById,
} as const;

