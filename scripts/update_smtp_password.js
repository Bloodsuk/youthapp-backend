/**
 * Update email_configuration SMTP password (and standard Mailgun settings).
 * Password is read from SMTP_PASSWORD env — never commit passwords to the repo.
 *
 * Usage:
 *   SMTP_PASSWORD='...' ENV_FILE=env/development.env node scripts/update_smtp_password.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const smtpPassword = process.env.SMTP_PASSWORD;
if (!smtpPassword) {
  console.error("Set SMTP_PASSWORD env var");
  process.exit(1);
}

const envPath = process.env.ENV_FILE || "env/development.env";
const envFile = path.resolve(process.cwd(), envPath);
if (!fs.existsSync(envFile)) {
  console.error(`ENV file not found: ${envFile}`);
  process.exit(1);
}

const env = fs.readFileSync(envFile, "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};

(async () => {
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: get("DATABASE"),
  });

  const [result] = await conn.execute(
    `UPDATE email_configuration SET
      smtp_host = ?,
      smtp_port = ?,
      smtp_username = ?,
      smtp_password = ?,
      smtp_encryption = ?
    WHERE id = 1`,
    [
      "smtp.mailgun.org",
      "587",
      "info@mg.youth-revisited.co.uk",
      smtpPassword,
      "tls",
    ]
  );

  if (result.affectedRows === 0) {
    throw new Error("No email_configuration row updated (id=1 missing?)");
  }

  const [rows] = await conn.execute(
    "SELECT smtp_host, smtp_port, smtp_username, smtp_encryption FROM email_configuration WHERE id = 1"
  );
  console.log("Updated email_configuration:", rows[0]);
  await conn.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
