#!/usr/bin/env node
/**
 * Create npn_phleb_contracts on the database in env/live.env (tunnel required from Mac).
 * Usage: node scripts/run_phleb_contracts_migration.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const root = path.join(__dirname, "..");
const envPath = path.join(root, "env", "live.env");
if (!fs.existsSync(envPath)) {
  console.error("Missing env/live.env");
  process.exit(1);
}

const env = fs.readFileSync(envPath, "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};

(async () => {
  const sql = fs.readFileSync(
    path.join(root, "scripts", "add_npn_phleb_contracts.sql"),
    "utf8"
  );
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: get("DATABASE"),
    multipleStatements: true,
  });

  await conn.query(sql);
  const [rows] = await conn.query(
    "SHOW TABLES LIKE 'npn_phleb_contracts'"
  );
  console.log(
    rows.length
      ? "OK: npn_phleb_contracts exists"
      : "WARN: table not found after migration"
  );
  await conn.end();
})().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
