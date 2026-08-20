#!/usr/bin/env node
/**
 * Delete mistaken agreement rows from npn_phleb_contracts.
 * Admin reviews live in WordPress wp_phleb_contracts only.
 *
 *   ENV_FILE=env/local.env node scripts/cleanup_wrong_agreement_collection.js
 *   ENV_FILE=env/development.env node scripts/cleanup_wrong_agreement_collection.js
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

(async () => {
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: get("DATABASE"),
  });

  try {
    const [tables] = await conn.query(
      "SHOW TABLES LIKE 'npn_phleb_contracts'"
    );
    if (!tables.length) {
      console.log("SKIP: npn_phleb_contracts does not exist");
      return;
    }

    const [[{ c: before }]] = await conn.query(
      "SELECT COUNT(*) AS c FROM npn_phleb_contracts"
    );
    const [result] = await conn.query("DELETE FROM npn_phleb_contracts");
    console.log(
      `Deleted ${result.affectedRows} row(s) from npn_phleb_contracts (had ${before}).`
    );
    console.log(
      "Agreements must use wp_phleb_contracts via Agreement / submit-contract."
    );
  } finally {
    await conn.end();
  }
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
