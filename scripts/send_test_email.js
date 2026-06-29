/**
 * Send one test email using SMTP settings from email_configuration (id=1).
 *
 * Usage:
 *   TEST_TO=you@example.com ENV_FILE=env/live.env node scripts/send_test_email.js
 *
 * Requires DB access (local tunnel or run on production server).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const TO = process.env.TEST_TO || "sonusmartpoint@gmail.com";
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

const buildTransport = (cfg) => {
  const port = Number(cfg.smtp_port);
  const encryption = String(cfg.smtp_encryption || "").trim().toLowerCase();
  const secure = port === 465 || encryption === "ssl" || encryption === "smtps";
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port,
    secure,
    auth: { user: cfg.smtp_username, pass: cfg.smtp_password },
    tls: { rejectUnauthorized: false },
  });
};

(async () => {
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: get("DATABASE"),
  });

  const [rows] = await conn.execute("SELECT * FROM email_configuration WHERE id = 1");
  if (!rows.length) throw new Error("No email_configuration row");
  const cfg = rows[0];

  console.log(`SMTP: ${cfg.smtp_host}:${cfg.smtp_port} user=${cfg.smtp_username} encryption=${cfg.smtp_encryption}`);
  console.log(`Sending test to: ${TO}`);

  const transporter = buildTransport(cfg);
  const info = await transporter.sendMail({
    from: "info@youth-revisited.co.uk",
    to: TO,
    subject: "[Youth Revisited] Email system test",
    html: `<p>Test email from Youth Revisited backend (${new Date().toISOString()}).</p>`,
  });

  console.log("SUCCESS messageId:", info.messageId);
  await conn.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
