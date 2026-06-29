/**
 * Send a sample low-kit-stock alert email (same template as production).
 *
 * Usage:
 *   ENV_FILE=env/development.env node scripts/test_low_kit_stock_email.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const envPath = process.env.ENV_FILE || "env/development.env";
const envFile = path.resolve(process.cwd(), envPath);
const env = fs.readFileSync(envFile, "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};

const TO = "info@youth-revisited.co.uk";
const FROM = "info@youth-revisited.co.uk";

const html = `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#333;">
  <h2 style="color:#07274a;">Low Kit Stock Alert (test)</h2>
  <p>A phlebotomist has <strong>2</strong> kit(s) or fewer remaining (alert threshold: 2).</p>
  <p>Please review stock and dispatch replacement kits if required.</p>
  <ul>
    <li><strong>Phlebotomist:</strong> GPS Test Phleb</li>
    <li><strong>Phlebotomist ID:</strong> 1276</li>
    <li><strong>Email:</strong> gpsphleb@test.com</li>
    <li><strong>Total remaining kits:</strong> 2</li>
    <li><strong>Stock breakdown:</strong> Standard blood kit: 1, Urine kit: 1</li>
  </ul>
  <p style="color:#666;font-size:12px;">Test email from Youth Revisited backend — ${new Date().toISOString()}</p>
</body></html>`;

(async () => {
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: get("DATABASE"),
  });
  const [rows] = await conn.execute("SELECT * FROM email_configuration WHERE id = 1");
  if (!rows.length) throw new Error("No email_configuration");
  const cfg = rows[0];
  const port = Number(cfg.smtp_port);
  const encryption = String(cfg.smtp_encryption || "").trim().toLowerCase();
  const secure = port === 465 || encryption === "ssl" || encryption === "smtps";

  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port,
    secure,
    auth: { user: cfg.smtp_username, pass: cfg.smtp_password },
    tls: { rejectUnauthorized: false },
  });

  const info = await transporter.sendMail({
    from: FROM,
    to: TO,
    subject: "Low kit stock: GPS Test Phleb (2 remaining) [TEST]",
    html,
  });

  console.log("SUCCESS messageId:", info.messageId);
  console.log("Sent to:", TO);
  await conn.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
