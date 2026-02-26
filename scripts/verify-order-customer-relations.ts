/**
 * Verifies Order–Customer relations and that get-orders queries return customer email.
 *
 * Relations (from schema and interfaces):
 * - orders.customer_id -> customers.id
 * - customers.email is fetched via JOIN in list-order queries as customer_email
 *
 * Usage (from project root, with env loaded):
 *   npx ts-node -r tsconfig-paths/register scripts/verify-order-customer-relations.ts
 *
 * Or with explicit env file:
 *   node -r dotenv/config -r ts-node/register -r tsconfig-paths/register scripts/verify-order-customer-relations.ts
 *   (set DOTENV_CONFIG_PATH=env/development.env)
 */

import path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

// Load development env (same as pre-start)
dotenv.config({ path: path.join(__dirname, "../env/development.env") });

const LIMIT = 2;

async function main() {
  console.log("\n=== Order–Customer relations verification ===\n");

  const pool = mysql.createPool({
    user: process.env.DB_USER ?? "",
    password: process.env.PASSWORD ?? "",
    host: process.env.DB_HOST ?? "",
    database: process.env.DATABASE ?? "",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 2,
  });

  try {
    // 1) Same SELECT as OrderService.getAll (orders + customers join)
    const sql = `
      SELECT 
        orders.id,
        orders.order_id,
        orders.customer_id,
        orders.client_name,
        orders.status,
        customers.id AS cust_id,
        customers.fore_name AS customer_fore_name,
        customers.sur_name AS customer_sur_name,
        customers.email AS customer_email
      FROM orders
      LEFT JOIN customers ON orders.customer_id = customers.id
      WHERE orders.status != 'Failed'
      ORDER BY orders.id DESC
      LIMIT ?
    `;
    const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, [LIMIT]);

    if (!rows || rows.length === 0) {
      console.log("No orders found (table may be empty). Relation check skipped.");
      process.exit(0);
      return;
    }

    console.log("Sample rows from orders LEFT JOIN customers:\n");
    let allHaveEmail = true;
    for (const row of rows as Record<string, unknown>[]) {
      const hasEmail = row.customer_email != null && String(row.customer_email).trim() !== "";
      if (!hasEmail && row.customer_id != null) allHaveEmail = false;
      console.log({
        order_id: row.order_id,
        customer_id: row.customer_id,
        customer_email: row.customer_email ?? "(null)",
        customer_fore_name: row.customer_fore_name,
        customer_sur_name: row.customer_sur_name,
        email_ok: hasEmail,
      });
    }

    // 2) Verify relation: for each order with customer_id, customers.id should match and email present
    const sqlCheck = `
      SELECT 
        o.id AS order_id,
        o.customer_id,
        c.id AS customer_pk,
        c.email
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.status != 'Failed'
      ORDER BY o.id DESC
      LIMIT ?
    `;
    const [relRows] = await pool.query<mysql.RowDataPacket[]>(sqlCheck, [LIMIT]);
    let relationOk = true;
    for (const r of relRows as Record<string, unknown>[]) {
      const oid = r.order_id;
      const cid = r.customer_id;
      const cpk = r.customer_pk;
      const email = r.email;
      if (cid != null && cpk == null) {
        console.log("\nRelation error: order", oid, "has customer_id", cid, "but no matching customer row.");
        relationOk = false;
      }
      if (cid != null && cpk != null && (email == null || String(email).trim() === "")) {
        console.log("\nWarning: order", oid, "customer id", cid, "has no email in customers table.");
      }
    }

    console.log("\n--- Summary ---");
    console.log("customer_email present in JOIN result:", allHaveEmail ? "YES" : "NO (some rows missing email)");
    console.log("orders.customer_id -> customers.id relation:", relationOk ? "OK" : "BROKEN");
    console.log("\nVerification done.\n");
    process.exit(relationOk && allHaveEmail ? 0 : 1);
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
