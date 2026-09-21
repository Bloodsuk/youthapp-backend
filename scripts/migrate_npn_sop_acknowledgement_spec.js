/**
 * Apply SOP acknowledgement spec columns + seed flags.
 * Safe to re-run.
 *
 *   ENV_FILE=env/live.env node scripts/migrate_npn_sop_acknowledgement_spec.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv(file) {
  const p = path.resolve(root, file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] == null) process.env[m[1]] = v;
  }
}

loadEnv(process.env.ENV_FILE || "env/live.env");

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.PASSWORD || process.env.DB_PASSWORD,
    database: process.env.DATABASE,
    multipleStatements: true,
  });

  try {
    if (!(await columnExists(conn, "npn_sop_documents", "requires_acknowledgement"))) {
      await conn.query(
        `ALTER TABLE npn_sop_documents
         ADD COLUMN requires_acknowledgement tinyint(1) NOT NULL DEFAULT 0 AFTER is_active`
      );
      console.log("Added npn_sop_documents.requires_acknowledgement");
    } else {
      console.log("requires_acknowledgement already present");
    }

    if (!(await columnExists(conn, "npn_sop_documents", "document_code"))) {
      await conn.query(
        `ALTER TABLE npn_sop_documents
         ADD COLUMN document_code varchar(64) DEFAULT NULL AFTER requires_acknowledgement`
      );
      console.log("Added npn_sop_documents.document_code");
    } else {
      console.log("document_code already present");
    }

    const sql = fs.readFileSync(
      path.join(__dirname, "add_npn_sop_acknowledgement_spec.sql"),
      "utf8"
    );
    for (const stmt of sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--"))) {
      await conn.query(stmt);
    }
    console.log("OK: SOP acknowledgement spec migration applied");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
