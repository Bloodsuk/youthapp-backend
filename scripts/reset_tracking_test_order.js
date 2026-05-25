#!/usr/bin/env node
/**
 * Replace one tracking test order with a fresh order + pleb job (live DB).
 *
 * Usage:
 *   CONFIRM=1 OLD_ORDER_ID=20286 node scripts/reset_tracking_test_order.js
 *
 * Defaults:
 *   CUSTOMER_EMAIL=systemtest18@yahoo.com
 *   PHLEB_EMAIL=systemtest18@yahoo.com
 *   JOB_STATUS=Picked Up
 */
const mysql = require("mysql2/promise");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../env/live.env") });

const OLD_ORDER_ID = Number(process.env.OLD_ORDER_ID || 20286);
const CUSTOMER_EMAIL =
  process.env.CUSTOMER_EMAIL || "systemtest18@yahoo.com";
const PHLEB_EMAIL = process.env.PHLEB_EMAIL || "systemtest18@yahoo.com";
const JOB_STATUS = process.env.JOB_STATUS || "Picked Up";
const CONFIRM = process.env.CONFIRM === "1";

async function main() {
  if (!CONFIRM) {
    console.error(
      "Refusing to modify DB without CONFIRM=1.\n" +
        "  CONFIRM=1 OLD_ORDER_ID=20286 node scripts/reset_tracking_test_order.js"
    );
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
  });

  try {
    const [custRows] = await connection.execute(
      "SELECT id, fore_name, sur_name FROM customers WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [CUSTOMER_EMAIL.toLowerCase()]
    );
    const [phlebRows] = await connection.execute(
      "SELECT id, full_name FROM phlebotomy_applications WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [PHLEB_EMAIL.toLowerCase()]
    );
    if (!custRows.length || !phlebRows.length) {
      throw new Error("Customer or phlebotomist email not found in DB");
    }
    const customerId = custRows[0].id;
    const plebId = phlebRows[0].id;

    const [oldOrders] = await connection.execute(
      "SELECT id, order_id FROM orders WHERE id = ? LIMIT 1",
      [OLD_ORDER_ID]
    );
    if (!oldOrders.length) {
      console.warn(`Order ${OLD_ORDER_ID} not found — will only create a new order.`);
    } else {
      const oldOrderRef = oldOrders[0].order_id;
      const [jobRows] = await connection.execute(
        "SELECT id FROM pleb_jobs WHERE order_id = ?",
        [OLD_ORDER_ID]
      );
      const jobIds = jobRows.map((r) => r.id);

      if (jobIds.length) {
        const placeholders = jobIds.map(() => "?").join(",");
        await connection.execute(
          `DELETE FROM pleb_live_locations WHERE job_id IN (${placeholders}) OR pleb_id = ?`,
          [...jobIds, plebId]
        );
        await connection.execute(
          `DELETE FROM pleb_jobs WHERE id IN (${placeholders})`,
          jobIds
        );
      } else {
        await connection.execute(
          "DELETE FROM pleb_live_locations WHERE pleb_id = ?",
          [plebId]
        );
      }

      await connection.execute(
        "DELETE FROM customer_phleb_bookings WHERE order_id = ?",
        [OLD_ORDER_ID]
      );
      await connection.execute(
        "DELETE FROM bookings_listing WHERE order_id = ?",
        [String(oldOrderRef)]
      );
      await connection.execute("DELETE FROM orders WHERE id = ?", [OLD_ORDER_ID]);
      console.log(`Removed order ${OLD_ORDER_ID} (${oldOrderRef}) and related rows.`);
    }

    const ts = Date.now();
    const newOrderRef = `TRK-${ts}`;
    const txn = `txn_track_${ts}`;

    const [orderResult] = await connection.execute(
      `INSERT INTO orders (
        order_id, transaction_id, customer_id, test_ids, client_name,
        subtotal, total_val, shipping_type, checkout_type, status,
        payment_status, order_placed_by, created_by, approved,
        is_job_assigned, order_from_web, is_active, specific_service
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 2)`,
      [
        newOrderRef,
        txn,
        customerId,
        "312",
        `${custRows[0].fore_name || ""} ${custRows[0].sur_name || ""}`.trim() ||
          "system18 test",
        "65.00",
        65.0,
        "10",
        "Credit",
        "In Progress",
        "Paid",
        customerId,
        customerId,
        1,
      ]
    );
    const newOrderId = orderResult.insertId;

    await connection.execute(
      `INSERT INTO customer_phleb_bookings (
        order_id, slot_times, price, weekend_surcharge, zone, shift_type,
        client_booking_date, client_booking_start_time, client_booking_end_time
      ) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), '09:00:00', '11:00:00')`,
      [
        newOrderId,
        "9:00 AM - 11:00 AM",
        "65",
        "0",
        "london",
        "Morning",
      ]
    );

    const trackingNumber = `TRK-${newOrderId}-${plebId}`;
    const [jobResult] = await connection.execute(
      `INSERT INTO pleb_jobs (tracking_number, pleb_id, order_id, job_status, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [trackingNumber, plebId, newOrderId, JOB_STATUS]
    );

    await connection.execute(
      "UPDATE orders SET is_job_assigned = 1 WHERE id = ?",
      [newOrderId]
    );

    await connection.execute(
      `INSERT INTO bookings_listing (booking_date, booking_time, order_id, user_id)
       VALUES (CURDATE(), ?, ?, ?)`,
      ["9:00 AM - 11:00 AM", newOrderRef, customerId]
    );

    console.log("");
    console.log("=== New tracking test visit ===");
    console.log("customer_id:", customerId, `(${CUSTOMER_EMAIL})`);
    console.log("phleb_id:", plebId, `(${PHLEB_EMAIL})`);
    console.log("order_id (customer tracking):", newOrderId);
    console.log("order_ref:", newOrderRef);
    console.log("job_id (phleb update_location):", jobResult.insertId);
    console.log("job_status:", JOB_STATUS);
    console.log("");
    console.log("Flutter:");
    console.log("  Customer → track order_id", newOrderId);
    console.log("  Phleb     → job_id", jobResult.insertId);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
