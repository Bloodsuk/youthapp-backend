/**
 * Assign one pleb_job to a phlebotomist (by phlebotomy_applications email).
 * pleb_jobs.pleb_id = phlebotomy_applications.id (same as login user.id in API).
 *
 * Usage:
 *   node scripts/assign_pleb_job.js sonusmartpoint@gmail.com
 *   node scripts/assign_pleb_job.js sonusmartpoint@gmail.com 12345   # explicit order id
 *
 * Env: loads ./env/development.env (DB_HOST, DB_USER, PASSWORD, DATABASE).
 */
const mysql = require("mysql2/promise");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../env/development.env") });

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const explicitOrderId = process.argv[3] ? Number(process.argv[3]) : null;

  if (!email) {
    console.error("Usage: node scripts/assign_pleb_job.js <phleb_email> [order_id]");
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.PASSWORD || "",
      database: process.env.DATABASE,
    });

    const [plebRows] = await connection.execute(
      "SELECT id, full_name, email, is_active FROM phlebotomy_applications WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [email]
    );
    if (plebRows.length === 0) {
      console.error(`No phlebotomy_applications row for email: ${email}`);
      process.exit(1);
    }
    const pleb = plebRows[0];
    if (Number(pleb.is_active) !== 1) {
      console.warn(`Warning: is_active is not 1 for this phleb (id=${pleb.id}).`);
    }

    let orderId = explicitOrderId;
    if (!orderId || Number.isNaN(orderId)) {
      const [orderRows] = await connection.execute(
        `SELECT o.id
         FROM orders o
         WHERE COALESCE(o.is_job_assigned, 0) = 0
           AND NOT EXISTS (SELECT 1 FROM pleb_jobs pj WHERE pj.order_id = o.id)
         ORDER BY o.id DESC
         LIMIT 1`
      );
      if (orderRows.length === 0) {
        console.error(
          "No eligible order found (need COALESCE(is_job_assigned,0)=0 and no existing pleb_jobs row). " +
            "Create an order or pass order_id: node scripts/assign_pleb_job.js <email> <order_id>"
        );
        process.exit(1);
      }
      orderId = Number(orderRows[0].id);
    } else {
      const [exists] = await connection.execute(
        "SELECT id FROM orders WHERE id = ? LIMIT 1",
        [orderId]
      );
      if (exists.length === 0) {
        console.error(`Order id ${orderId} not found.`);
        process.exit(1);
      }
      const [taken] = await connection.execute(
        "SELECT id FROM pleb_jobs WHERE order_id = ? LIMIT 1",
        [orderId]
      );
      if (taken.length > 0) {
        console.error(`Order ${orderId} already has pleb_jobs id=${taken[0].id}.`);
        process.exit(1);
      }
    }

    const [result] = await connection.execute(
      "INSERT INTO pleb_jobs (pleb_id, order_id, job_status, created_at) VALUES (?, ?, ?, NOW())",
      [pleb.id, orderId, "Assigned"]
    );

    await connection.execute("UPDATE orders SET is_job_assigned = 1 WHERE id = ?", [orderId]);

    console.log("Done.");
    console.log({
      pleb_id: pleb.id,
      pleb_name: pleb.full_name,
      pleb_email: pleb.email,
      order_id: orderId,
      pleb_job_id: result.insertId,
      job_status: "Assigned",
    });
    console.log(
      `Flutter/API: GET .../api/pleb_jobs/pleb/${pleb.id} (use phlebotomy_applications.id, not users.id).`
    );
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
