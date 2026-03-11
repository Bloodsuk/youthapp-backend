/**
 * Quick test script to send all job lifecycle email templates to a test address.
 * Usage: node scripts/test_email_templates.js
 */
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");
require("dotenv").config({ path: "./env/development.env" });

const TEST_EMAIL = "hafizg346@gmail.com";
const FROM = "info@youth-revisited.co.uk";

const SAMPLE = {
  orderRef: "#ORD-20260305",
  customerName: "John Smith",
  plebName: "Sarah Johnson",
  plebPhone: "07712 345678",
  customerPhone: "07898 765432",
  customerAddress: "42 High Street, London, SW1A 1AA, UK",
  trackingNumber: "RM1234567890GB",
  bookingDate: "Thursday, 20 March 2026",
  bookingTime: "08:00 AM – 08:30 AM",
};

// ── HTML builder (mirrors MailService.buildNotificationEmail) ──

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmail({ title, greeting, introLines = [], detailRows = [], outroLines = [], signOff = "Kind regards" }) {
  const greetingHtml = greeting
    ? `<p style="margin:0 0 12px;color:#666;font-family:'Lato',Helvetica,Arial,sans-serif;font-size:18px;line-height:25px;">${esc(greeting)}</p>`
    : "";

  const introHtml = introLines
    .map((l) => `<p style="margin:5px 0;color:#666;font-family:'Lato',Helvetica,Arial,sans-serif;font-size:18px;line-height:25px;">${esc(l)}</p>`)
    .join("");

  let detailHtml = "";
  let inList = false;
  for (const row of detailRows) {
    if (row.isSectionHeader) {
      if (inList) { detailHtml += "</ul>"; inList = false; }
      detailHtml += `<p style="margin:15px 0 5px;color:#666;font-family:'Lato',Helvetica,Arial,sans-serif;font-size:18px;font-weight:600;line-height:25px;">${esc(row.label)}</p>`;
    } else if (row.value) {
      if (!inList) { detailHtml += '<ul style="padding-left:20px;margin:5px 0;">'; inList = true; }
      detailHtml += `<li style="margin:5px;"><strong>${esc(row.label)}:</strong> ${esc(row.value)}</li>`;
    }
  }
  if (inList) detailHtml += "</ul>";

  const outroHtml = outroLines
    .map((l) => `<p style="margin:5px 0;color:#666;font-family:'Lato',Helvetica,Arial,sans-serif;font-size:18px;line-height:25px;">${esc(l)}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
</head>
<body style="background:#f4f4f4;margin:0;padding:0;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr><td align="center">
      <table bgcolor="#07274a" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:700px;">
        <tr><td align="center" valign="top" style="padding:10px;">
          <img src="https://www.youth-revisited.co.uk/wp-content/uploads/2022/02/logo.png" alt="Youth Revisited" style="max-width:200px;">
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:0 10px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:700px;">
        <tr><td bgcolor="#ffffff" align="center" valign="top" style="padding:40px 20px 20px;border-radius:4px 4px 0 0;color:#111;font-family:'Lato',Helvetica,Arial,sans-serif;font-size:48px;letter-spacing:4px;line-height:48px;">
          <h1 style="font-size:25px;font-weight:600;margin:0;">${esc(title)}</h1>
        </td></tr>
      </table>
    </td></tr>
    <tr><td bgcolor="#f4f4f4" align="center" style="padding:0 10px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:700px;">
        <tr><td bgcolor="#ffffff" align="left" style="padding:20px 30px;color:#666;font-family:'Lato',Helvetica,Arial,sans-serif;font-size:18px;line-height:25px;">
          ${greetingHtml}
          ${introHtml}
          ${detailHtml}
          ${outroHtml}
          <p style="margin:20px 0 5px;color:#666;font-family:'Lato',Helvetica,Arial,sans-serif;font-size:18px;line-height:25px;">${esc(signOff)},<br/>Youth Revisited Team</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td bgcolor="#f4f4f4" align="center" style="padding:10px 10px 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:700px;">
        <tr><td bgcolor="#07274a" align="center" style="padding:30px;border-radius:4px;color:#666;font-family:'Lato',Helvetica,Arial,sans-serif;font-size:18px;line-height:25px;">
          <h2 style="font-size:20px;font-weight:400;color:#fff;margin:0;">Get in Touch</h2>
          <p style="margin:0;color:#fff;font-size:15px;">This email was sent by: info@youth-revisited.co.uk</p>
          <p style="margin:0;color:#fff;font-size:15px;">For any questions please send an email to info@youth-revisited.co.uk</p>
          <p style="margin:0;"><a href="https://www.youth-revisited.co.uk/privacy-policy/" target="_blank" style="color:#fff;text-decoration:none;">Privacy Policy</a> | <a href="https://www.youth-revisited.co.uk/contactus/" target="_blank" style="color:#fff;text-decoration:none;">Help Center</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── The 5 email definitions ──

const emails = [
  {
    name: "1. Customer – Allocated (Assigned)",
    subject: `Your Appointment Has Been Allocated – Order ${SAMPLE.orderRef}`,
    html: buildEmail({
      title: "Your Appointment Has Been Allocated",
      greeting: `Dear ${SAMPLE.customerName},`,
      introLines: [
        "We are pleased to inform you that your appointment has now been allocated to a member of our clinical team.",
      ],
      detailRows: [
        { label: "Appointment Details", isSectionHeader: true },
        { label: "Order Reference", value: SAMPLE.orderRef },
        { label: "Status", value: "Allocated" },
        { label: "Assigned Phlebotomist", isSectionHeader: true },
        { label: "Name", value: SAMPLE.plebName },
        { label: "Contact Number", value: SAMPLE.plebPhone },
      ],
      outroLines: [
        "Your assigned phlebotomist will confirm a time and date for your upcoming appointment and attend your appointment as scheduled. If you need to communicate any important information prior to the visit, please feel free to contact them directly.",
      ],
    }),
  },
  {
    name: "2. Customer – Booked In (Picked Up)",
    subject: `Your appointment has been confirmed – Order ${SAMPLE.orderRef}`,
    html: buildEmail({
      title: "Your Appointment Has Been Confirmed",
      greeting: `Dear ${SAMPLE.customerName},`,
      introLines: [
        "We are pleased to confirm that your phlebotomy visit has now been booked in.",
      ],
      detailRows: [
        { label: "Order Details", isSectionHeader: true },
        { label: "Order Reference", value: SAMPLE.orderRef },
        { label: "Status", value: "Booked In" },
        { label: "Booking Date", value: SAMPLE.bookingDate },
        { label: "Booking Time", value: SAMPLE.bookingTime },
      ],
    }),
  },
  {
    name: "3. Customer – Sample Posted (Delivered)",
    subject: `Your sample has been Posted – Order ${SAMPLE.orderRef}`,
    html: buildEmail({
      title: "Your Sample Has Been Posted",
      greeting: `Dear ${SAMPLE.customerName},`,
      introLines: [
        "We are pleased to confirm that your sample has been posted back to the Laboratory.",
      ],
      detailRows: [
        { label: "Order Summary", isSectionHeader: true },
        { label: "Order Reference", value: SAMPLE.orderRef },
        { label: "Status", value: "Posted" },
        { label: "Tracking Number", value: SAMPLE.trackingNumber },
      ],
      outroLines: [
        "Your visit has been successfully finalised. Your sample has been posted to the Laboratory today and if any follow-up is required, a member of our team will be in touch.",
        "We truly appreciate your trust in Youth Revisited. If you require any further assistance, please don't hesitate to contact us.",
      ],
      signOff: "Warm regards",
    }),
  },
  {
    name: "4. Customer – Cancelled",
    subject: `Update Regarding Your Order – Order ${SAMPLE.orderRef}`,
    html: buildEmail({
      title: "Update Regarding Your Order",
      greeting: `Dear ${SAMPLE.customerName},`,
      introLines: [
        "We regret to inform you that your visit has been cancelled.",
      ],
      detailRows: [
        { label: "Order Details", isSectionHeader: true },
        { label: "Order Reference", value: SAMPLE.orderRef },
        { label: "Status", value: "Cancelled" },
      ],
      outroLines: [
        "If this cancellation was not requested by you, or if you would like to reschedule, please contact our support team.",
        "We apologise for any inconvenience this may cause and remain committed to providing you with the highest standard of care.",
      ],
    }),
  },
  {
    name: "5. Admin – Status Notification",
    subject: `Order Update (Allocated): ${SAMPLE.orderRef}`,
    html: buildEmail({
      title: "Order Update – Allocated",
      greeting: "Hello Admin,",
      introLines: [
        `Order ${SAMPLE.orderRef} status has been updated to "Allocated".`,
      ],
      detailRows: [
        { label: "Appointment Details", isSectionHeader: true },
        { label: "Order Reference", value: SAMPLE.orderRef },
        { label: "Status", value: "Allocated" },
        { label: "Phlebotomist", value: SAMPLE.plebName },
        { label: "Phlebotomist Phone", value: SAMPLE.plebPhone },
        { label: "Customer", value: SAMPLE.customerName },
        { label: "Customer Phone", value: SAMPLE.customerPhone },
        { label: "Customer Address", value: SAMPLE.customerAddress },
      ],
      outroLines: [
        "You can review the details in the admin dashboard.",
      ],
    }),
  },
  {
    name: "6. Phlebotomist – Job Assigned",
    subject: `Job Assigned: ${SAMPLE.orderRef}`,
    html: buildEmail({
      title: "New Job Assigned",
      greeting: `Hi ${SAMPLE.plebName},`,
      introLines: [
        "A new job has been assigned to you.",
        `Order ${SAMPLE.orderRef} is ready for you to review.`,
      ],
      detailRows: [
        { label: "Order Reference", value: SAMPLE.orderRef },
        { label: "Customer", value: SAMPLE.customerName },
        { label: "Customer Phone", value: SAMPLE.customerPhone },
        { label: "Customer Address", value: SAMPLE.customerAddress },
        { label: "Starting Status", value: "Allocated" },
      ],
      outroLines: [
        "Please log in to your phlebotomist portal for full job details and keep the status updated as you progress.",
      ],
    }),
  },
  {
    name: "7. Phlebotomist – Status Update (Booked In)",
    subject: `Job Update: Booked In - ${SAMPLE.orderRef}`,
    html: buildEmail({
      title: "Job Status Update",
      greeting: `Hi ${SAMPLE.plebName},`,
      introLines: [
        `The status for order ${SAMPLE.orderRef} has been updated to "Booked In".`,
      ],
      detailRows: [
        { label: "Order Reference", value: SAMPLE.orderRef },
        { label: "Customer", value: SAMPLE.customerName },
        { label: "Status", value: "Booked In" },
      ],
      outroLines: [
        "Please log in to your portal for full details and keep the status updated as you progress.",
      ],
    }),
  },
  {
    name: "8. Phlebotomist – Completion (Sample Posted)",
    subject: `Visit Completed - ${SAMPLE.orderRef}`,
    html: buildEmail({
      title: "Visit Completed",
      greeting: `Hi ${SAMPLE.plebName},`,
      introLines: [
        `Order ${SAMPLE.orderRef} has been marked as "Sample Posted".`,
        "Thank you for completing this visit.",
      ],
      detailRows: [
        { label: "Order Reference", value: SAMPLE.orderRef },
        { label: "Customer", value: SAMPLE.customerName },
        { label: "Status", value: "Sample Posted" },
        { label: "Tracking Number", value: SAMPLE.trackingNumber },
      ],
      outroLines: [
        "Please ensure all paperwork and samples are handled as required.",
      ],
    }),
  },
];

// ── Send ──

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER,
      password: process.env.PASSWORD,
      database: process.env.DATABASE,
    });

    const [rows] = await connection.execute("SELECT * FROM email_configuration WHERE id = 1");
    if (rows.length === 0) {
      console.error("No email configuration found in DB.");
      process.exit(1);
    }
    const cfg = rows[0];
    console.log(`SMTP: ${cfg.smtp_host}:${cfg.smtp_port} (user: ${cfg.smtp_username})\n`);

    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: Number(cfg.smtp_port),
      secure: false,
      auth: { user: cfg.smtp_username, pass: cfg.smtp_password },
      tls: { rejectUnauthorized: false },
    });

    for (const email of emails) {
      try {
        const info = await transporter.sendMail({
          from: FROM,
          to: TEST_EMAIL,
          subject: `[TEST] ${email.subject}`,
          html: email.html,
        });
        console.log(`✅ ${email.name}  →  ${info.messageId}`);
      } catch (err) {
        console.error(`❌ ${email.name}  →  ${err.message}`);
      }
    }

    console.log(`\nDone! Check ${TEST_EMAIL} for ${emails.length} test emails.`);
  } catch (err) {
    console.error("Fatal:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
