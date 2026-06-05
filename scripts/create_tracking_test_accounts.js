#!/usr/bin/env node
/**
 * Create a new phlebotomist + customer + order + pleb job for live GPS testing.
 *
 * Usage:
 *   CONFIRM=1 node scripts/create_tracking_test_accounts.js
 *
 * Optional env:
 *   PHLEB_EMAIL=youth.gps.phleb@test.local
 *   CUSTOMER_EMAIL=youth.gps.customer@test.local
 *   PHLEB_PASSWORD=TrackPhleb1!
 *   CUSTOMER_PASSWORD=TrackCust1!
 *   JOB_STATUS=Picked Up
 *   REPLACE=1   — delete existing rows with those emails first
 */
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../env/live.env") });

const CONFIRM = process.env.CONFIRM === "1";
const REPLACE = process.env.REPLACE === "1";
const PHLEB_EMAIL = process.env.PHLEB_EMAIL || "gpsphleb@test.com";
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || "gpscust@test.com";
const PHLEB_PASSWORD = process.env.PHLEB_PASSWORD || "phleb";
const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD || "cust";
const JOB_STATUS = process.env.JOB_STATUS || "Picked Up";

function md5(password) {
  return crypto.createHash("md5").update(password).digest("hex");
}

async function nextId(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COALESCE(MAX(id), 0) + 1 AS n FROM \`${table}\``
  );
  return Number(rows[0].n);
}

async function deleteByEmail(connection, email, table) {
  if (table === "phlebotomy_applications") {
    const [rows] = await connection.execute(
      "SELECT id FROM phlebotomy_applications WHERE LOWER(TRIM(email)) = ?",
      [email.toLowerCase()]
    );
    for (const row of rows) {
      const [jobs] = await connection.execute(
        "SELECT id, order_id FROM pleb_jobs WHERE pleb_id = ?",
        [row.id]
      );
      for (const j of jobs) {
        await connection.execute(
          "DELETE FROM pleb_live_locations WHERE job_id = ?",
          [j.id]
        );
        await connection.execute(
          "DELETE FROM customer_phleb_bookings WHERE order_id = ?",
          [j.order_id]
        );
        await connection.execute("DELETE FROM pleb_jobs WHERE id = ?", [j.id]);
        await connection.execute("DELETE FROM orders WHERE id = ?", [j.order_id]);
      }
      await connection.execute(
        "DELETE FROM pleb_live_locations WHERE pleb_id = ?",
        [row.id]
      );
      await connection.execute(
        "DELETE FROM phlebotomy_applications WHERE id = ?",
        [row.id]
      );
    }
    return;
  }

  if (table === "customers") {
    const [rows] = await connection.execute(
      "SELECT id FROM customers WHERE LOWER(TRIM(email)) = ?",
      [email.toLowerCase()]
    );
    for (const row of rows) {
      const [orders] = await connection.execute(
        "SELECT id, order_id FROM orders WHERE customer_id = ?",
        [row.id]
      );
      for (const o of orders) {
        const [jobs] = await connection.execute(
          "SELECT id FROM pleb_jobs WHERE order_id = ?",
          [o.id]
        );
        for (const j of jobs) {
          await connection.execute(
            "DELETE FROM pleb_live_locations WHERE job_id = ?",
            [j.id]
          );
        }
        await connection.execute(
          "DELETE FROM pleb_jobs WHERE order_id = ?",
          [o.id]
        );
        await connection.execute(
          "DELETE FROM customer_phleb_bookings WHERE order_id = ?",
          [o.id]
        );
        await connection.execute(
          "DELETE FROM bookings_listing WHERE order_id = ?",
          [String(o.order_id)]
        );
        await connection.execute("DELETE FROM orders WHERE id = ?", [o.id]);
      }
      await connection.execute("DELETE FROM customers WHERE id = ?", [row.id]);
    }
  }
}

async function main() {
  if (!CONFIRM) {
    console.error(
      "Refusing without CONFIRM=1.\n" +
        "  CONFIRM=1 node scripts/create_tracking_test_accounts.js"
    );
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
  });

  try {
    if (REPLACE) {
      await deleteByEmail(connection, PHLEB_EMAIL, "phlebotomy_applications");
      await deleteByEmail(connection, CUSTOMER_EMAIL, "customers");
      console.log("Removed existing rows for these emails (if any).");
    } else {
      const [pe] = await connection.execute(
        "SELECT id FROM phlebotomy_applications WHERE LOWER(TRIM(email)) = ?",
        [PHLEB_EMAIL.toLowerCase()]
      );
      const [ce] = await connection.execute(
        "SELECT id FROM customers WHERE LOWER(TRIM(email)) = ?",
        [CUSTOMER_EMAIL.toLowerCase()]
      );
      if (pe.length || ce.length) {
        throw new Error(
          "Email already exists. Set REPLACE=1 to recreate, or use different PHLEB_EMAIL / CUSTOMER_EMAIL."
        );
      }
    }

    const phlebHash = md5(PHLEB_PASSWORD);
    const [phlebResult] = await connection.execute(
      `INSERT INTO phlebotomy_applications (
        full_name, home_address, phone, email,
        employment_type, working_hours, drive, travel_radius,
        dbs, first_aid, trainer, training_academy, payment_terms,
        lat, lng, password, is_active, is_email_sent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, NOW())`,
      [
        "GPS Test Phleb",
        "Lahore, Pakistan",
        "+92 300 0000001",
        PHLEB_EMAIL,
        "Full-time",
        "9:00-17:00",
        "Yes",
        "50 km",
        "Yes",
        "Yes",
        "No",
        "Test",
        "Weekly",
        "31.3535",
        "73.0688",
        phlebHash,
      ]
    );
    const plebId = phlebResult.insertId;

    const custHash = md5(CUSTOMER_PASSWORD);
    const username = CUSTOMER_EMAIL.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 20) || "gpstestcust";
    const customerId = await nextId(connection, "customers");
    await connection.execute(
      `INSERT INTO customers (
        id, fore_name, sur_name, email, telephone, username, password,
        user_level, status, created_by, address, town, country, postal_code,
        notifications, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Customer', 1, 1, ?, ?, ?, ?, 'No', NOW())`,
      [
        customerId,
        "GPS",
        "Test Customer",
        CUSTOMER_EMAIL,
        "+92 300 0000002",
        username,
        custHash,
        "Lahore test address",
        "Lahore",
        "Pakistan",
        "54000",
      ]
    );
    const clientCode = "PID:" + (200200200 + customerId);
    await connection.execute(
      "UPDATE customers SET client_code = ? WHERE id = ?",
      [clientCode, customerId]
    );

    const ts = Date.now();
    const orderRef = `GPS-${ts}`;
    const txn = `txn_gps_${ts}`;

    const orderId = await nextId(connection, "orders");
    await connection.execute(
      `INSERT INTO orders (
        id, order_id, transaction_id, customer_id, test_ids, client_name,
        subtotal, total_val, shipping_type, checkout_type, status,
        payment_status, order_placed_by, created_by, approved,
        is_job_assigned, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        orderId,
        orderRef,
        txn,
        customerId,
        "312",
        "GPS Test Customer",
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

    await connection.execute(
      `INSERT INTO customer_phleb_bookings (
        order_id, slot_times, price, weekend_surcharge, zone, shift_type,
        client_booking_date, client_booking_start_time, client_booking_end_time
      ) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), '09:00:00', '11:00:00')`,
      [orderId, "9:00 AM - 11:00 AM", "65", "0", "lahore", "Morning"]
    );

    const trackingNumber = `TRK-${orderId}-${plebId}`;
    const [jobResult] = await connection.execute(
      `INSERT INTO pleb_jobs (tracking_number, pleb_id, order_id, job_status, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [trackingNumber, plebId, orderId, JOB_STATUS]
    );

    await connection.execute(
      "UPDATE orders SET is_job_assigned = 1 WHERE id = ?",
      [orderId]
    );

    await connection.execute(
      `INSERT INTO bookings_listing (booking_date, booking_time, order_id, user_id)
       VALUES (CURDATE(), ?, ?, ?)`,
      ["9:00 AM - 11:00 AM", orderRef, customerId]
    );

    console.log(`DB: ${process.env.DB_HOST}/${process.env.DATABASE}`);
    console.log("");
    console.log("=== New GPS test accounts ===");
    console.log("");
    console.log("PHLEBOTOMIST (Sign in as Phleb)");
    console.log("  Email:    ", PHLEB_EMAIL);
    console.log("  Password: ", PHLEB_PASSWORD);
    console.log("  pleb_id:  ", plebId);
    console.log("  job_id:   ", jobResult.insertId, `(${JOB_STATUS})`);
    console.log("");
    console.log("CUSTOMER (patient login)");
    console.log("  Email:    ", CUSTOMER_EMAIL);
    console.log("  Password: ", CUSTOMER_PASSWORD);
    console.log("  customer_id:", customerId);
    console.log("  order_id: ", orderId, "(use in customer tracking)");
    console.log("  order_ref:", orderRef);
    console.log("");
    console.log("Flutter tracking:");
    console.log("  Phleb EMIT update_location  job_id =", jobResult.insertId);
    console.log("  Customer EMIT track_job     order_id =", orderId);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
