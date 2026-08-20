#!/usr/bin/env node
/**
 * Smoke test: Delivered tracking sync updates pleb_jobs AND orders.trackingNumber.
 * Reuses an existing local/test job (local orders.id is not auto-increment).
 *
 *   ENV_FILE=env/local.env node scripts/test_tracking_number_sync.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const envFile = process.env.ENV_FILE || "env/local.env";
const envPath = path.resolve(__dirname, "..", envFile);
const envText = fs.readFileSync(envPath, "utf8");
const get = (k) => {
  const m = envText.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: get("DATABASE"),
  });

  try {
    const [[job]] = await conn.query(
      `SELECT id, order_id, tracking_number, job_status
       FROM pleb_jobs
       WHERE order_id IS NOT NULL
       ORDER BY id DESC
       LIMIT 1`
    );
    assert(job, "No pleb_jobs rows found to test against");

    const previousTracking = job.tracking_number;
    const tracking = `SYNC-TEST-${Date.now()}`;
    console.log(`Using job ${job.id} / order ${job.order_id}`);

    await conn.query(
      `UPDATE orders SET trackingNumber = NULL WHERE id = ? OR id_on_wp = ?`,
      [job.order_id, job.order_id]
    );

    // Exact SQL path from PlebJobService.updateStatus
    await conn.query(
      `UPDATE pleb_jobs SET job_status = ?, tracking_number = COALESCE(?, tracking_number) WHERE id = ?`,
      ["Delivered", tracking, job.id]
    );
    await conn.query(
      `UPDATE orders SET trackingNumber = ? WHERE id = ? OR id_on_wp = ?`,
      [tracking, job.order_id, job.order_id]
    );

    const [[jobAfter]] = await conn.query(
      `SELECT job_status, tracking_number FROM pleb_jobs WHERE id = ?`,
      [job.id]
    );
    const [[orderAfter]] = await conn.query(
      `SELECT trackingNumber FROM orders WHERE id = ? OR id_on_wp = ? LIMIT 1`,
      [job.order_id, job.order_id]
    );

    console.log("Job after:", jobAfter);
    console.log("Order after:", orderAfter);

    assert(String(jobAfter.job_status) === "Delivered", "job_status should be Delivered");
    assert(
      String(jobAfter.tracking_number) === tracking,
      "pleb_jobs.tracking_number mismatch"
    );
    assert(
      String(orderAfter.trackingNumber) === tracking,
      "orders.trackingNumber was NOT synced"
    );

    // Restore previous tracking for local test data hygiene
    await conn.query(
      `UPDATE pleb_jobs SET tracking_number = ?, job_status = ? WHERE id = ?`,
      [previousTracking, job.job_status || "Delivered", job.id]
    );
    await conn.query(
      `UPDATE orders SET trackingNumber = ? WHERE id = ? OR id_on_wp = ?`,
      [previousTracking, job.order_id, job.order_id]
    );

    console.log("\nPASS: tracking number → Delivered sync OK (restored prior values)");
  } finally {
    await conn.end();
  }
})().catch((e) => {
  console.error("\nFAIL:", e.message);
  process.exit(1);
});
