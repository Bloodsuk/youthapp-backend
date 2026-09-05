/**
 * Send one email using the finalized home-visit template
 * (templates/email/home-visit-status.html) — same theme production uses.
 *
 * Usage (on server):
 *   TEST_TO=you@example.com ENV_FILE=env/local.env node scripts/send_branded_status_test.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const TO = process.env.TEST_TO || "sonusmartpoint@gmail.com";
const envPath = process.env.ENV_FILE || "env/local.env";
const envFile = path.resolve(process.cwd(), envPath);
const templateFile = path.resolve(
  process.cwd(),
  "templates/email/home-visit-status.html"
);

if (!fs.existsSync(envFile)) {
  console.error(`ENV file not found: ${envFile}`);
  process.exit(1);
}
if (!fs.existsSync(templateFile)) {
  console.error(`Template not found: ${templateFile}`);
  process.exit(1);
}

const env = fs.readFileSync(envFile, "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Sample admin status email — matches finalized template placeholders
const vars = {
  status_label: "Booked In",
  recipient_name: "Admin",
  recipient_type: "admin",
  order_id: "TEST-21566",
  booking_date: "Tuesday, 2 September 2026",
  booking_time: "18:00 – 18:30",
  customer_name: "GPS",
  phleb_name: "Test Phleb",
  full_address: "10 Downing Street, Westminster, London, SW1A 2AA",
  dashboard_url: "https://prapp.youth-revisited.co.uk/",
};

let html = fs.readFileSync(templateFile, "utf8");

// Resolve simple PHP echoes
html = html.replace(
  /<\?php\s+echo\s+\$([a-zA-Z0-9_]+);\s*\?>/g,
  (_, key) => esc(vars[key] ?? "")
);

// Resolve recipient_type conditionals (admin gets phleb + address like non-practitioner)
// Template structure: if practitioner → customer; else → phleb (unless phleb) + address (unless customer)
const isPractitioner = vars.recipient_type === "practitioner";
const isPhleb = vars.recipient_type === "phleb";
const isCustomer = vars.recipient_type === "customer";

html = html.replace(
  /<\?php if \(\$recipient_type === 'practitioner'\): \?>[\s\S]*?<\?php else: \?>[\s\S]*?<\?php endif; \?>/g,
  (block) => {
    if (isPractitioner) {
      const m = block.match(
        /<\?php if \(\$recipient_type === 'practitioner'\): \?>([\s\S]*?)<\?php else: \?>/
      );
      return m ? m[1] : "";
    }
    const m = block.match(/<\?php else: \?>([\s\S]*?)<\?php endif; \?>/);
    let elseBlock = m ? m[1] : "";
    // nested: if not phleb → phleb card
    elseBlock = elseBlock.replace(
      /<\?php if \(\$recipient_type !== 'phleb'\): \?>[\s\S]*?<\?php endif; \?>/g,
      (inner) => {
        if (isPhleb) return "";
        const im = inner.match(
          /<\?php if \(\$recipient_type !== 'phleb'\): \?>([\s\S]*?)<\?php endif; \?>/
        );
        return im ? im[1] : "";
      }
    );
    // nested: if not customer → address card
    elseBlock = elseBlock.replace(
      /<\?php if \(\$recipient_type !== 'customer'\): \?>[\s\S]*?<\?php endif; \?>/g,
      (inner) => {
        if (isCustomer) return "";
        const im = inner.match(
          /<\?php if \(\$recipient_type !== 'customer'\): \?>([\s\S]*?)<\?php endif; \?>/
        );
        return im ? im[1] : "";
      }
    );
    return elseBlock;
  }
);

// Strip any leftover PHP
html = html.replace(/<\?php[\s\S]*?\?>/g, "");

(async () => {
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: get("DATABASE"),
  });
  const [rows] = await conn.execute(
    "SELECT * FROM email_configuration WHERE id = 1"
  );
  if (!rows.length) throw new Error("No email_configuration row");
  const cfg = rows[0];
  const port = Number(cfg.smtp_port);
  const encryption = String(cfg.smtp_encryption || "").trim().toLowerCase();
  const secure = port === 465 || encryption === "ssl" || encryption === "smtps";

  console.log(`Template: templates/email/home-visit-status.html (finalized)`);
  console.log(`SMTP ${cfg.smtp_host}:${cfg.smtp_port} → ${TO}`);

  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port,
    secure,
    auth: { user: cfg.smtp_username, pass: cfg.smtp_password },
    tls: { rejectUnauthorized: false },
  });

  const info = await transporter.sendMail({
    from: "info@youth-revisited.co.uk",
    to: TO,
    subject: `Home Visit Update (${vars.status_label}): #${vars.order_id}`,
    html,
  });
  console.log("SUCCESS messageId:", info.messageId);
  await conn.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
