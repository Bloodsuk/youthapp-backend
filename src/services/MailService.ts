import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import nodemailer from "nodemailer";
import { renderFile } from 'ejs'; 
import { IMailConfig } from "@src/interfaces/IMailConfig";
import { IMailTemplate } from "@src/interfaces/IMailTemplate";

const from = "info@youth-revisited.co.uk";
const cc = "info@youth-revisited.co.uk";

const normalizeEmail = (email: string): string | null => {
  const trimmed = email.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseEmailCsv = (raw?: string): string[] =>
  raw
    ? raw
        .split(",")
        .map((email) => normalizeEmail(email))
        .filter((email): email is string => !!email)
    : [];

const adminNotificationCcList = parseEmailCsv(process.env.ADMIN_NOTIFICATIONS_CC);

const defaultCcRecipients: string[] = normalizeEmail(cc) ? [normalizeEmail(cc)!] : [];

const adminCcRecipients = Array.from(
  new Set([...defaultCcRecipients, ...adminNotificationCcList])
);

const getAdminCcRecipients = (): string[] => adminCcRecipients;

async function getMailConfig() {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * from email_configuration where id = 1"
  );
  if (rows.length === 0) {
    return null;
  }
  return rows[0] as IMailConfig;
} 
async function addMailConfig(config: IMailConfig) {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO email_configuration SET ?",
    config
  );
  return result.insertId;
}
async function updateMailConfig(config: IMailConfig) {
  const { smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption } = config;
  const sql = "UPDATE email_configuration SET smtp_host = ?,smtp_port = ?,smtp_username = ?,smtp_password = ?,smtp_encryption = ? WHERE id = 1";
  const [result] = await pool.query<ResultSetHeader>(sql, [
    smtp_host,
    smtp_port,
    smtp_username,
    smtp_password,
    smtp_encryption,
  ]);
  return result.affectedRows > 0;
}

// Email Templates API
async function getMailTemplates() {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * from email_templates"
  );
  return rows as IMailTemplate[];
}
async function addMailTemplate(
  type: number,
  subject: string,
  title: string,
  content: string
) {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO email_templates SET ?",
    {
      type,
      subject,
      title,
      content,
    }
  );
  return result.insertId;
}
async function updateMailTemplate(
  type: number,
  subject: string,
  title: string,
  content: string
) {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE email_templates SET subject = ?, title = ?, content = ? WHERE type = ?",
    [subject, title, content, type]
  );
  return result.affectedRows > 0;
}

const sendRegistrationMail = async (email: string, username:string) => { 
  const [rows2] = await pool.query<RowDataPacket[]>("SELECT * from email_templates where id = 1");
  const template = rows2[0];
  const subject = template['subject'];
  const title = template['title'];
  const content = template['content'];

  const config = await getMailConfig();
  if(!config) throw new Error("Mail configuration not found");
  const mailerConfig = {
    host: config.smtp_host,
    secureConnection: true,
    port: Number(config.smtp_port),
    auth: {
      user: config.smtp_username,
      pass: config.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
  const transporter = nodemailer.createTransport(mailerConfig);

  renderFile(
    __dirname + "/mail_templates/registration.ejs",
    { title, username, content },
    (err, data) => {
      if (err) {
        console.log(err);
        throw new Error("Error rendering email template");
      } else {
        const mailOptions = {
          from: from,
          to: email,
          cc: cc,
          subject: subject,
          html: data,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
          console.log("Message sent: %s", info.messageId);
        });
      }
    }
  );
}

const sendCustomerRegistrationMail = async (name: string, email: string, username:string, password:string, created_by: number) => { 
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * from email_templates where id = 6");
  const template = rows[0];
  const subject = template['subject'];
  const title = template['title'];
  const content = template['content'];
         
  const [rows2] = await pool.query<RowDataPacket[]>(
    "SELECT logo, company_name, email from users where id = ?",
    [created_by]
  );
  let company_name = '', logo = '', pract_em = '';
  if(rows2.length > 0) {
    const user = rows2[0];
    company_name = user['company_name'];
    logo = user['logo'];
    pract_em = user["email"];
  }
  const config = await getMailConfig();
  if (!config) throw new Error("Mail configuration not found");

  const mailerConfig = {
    host: config.smtp_host,
    secureConnection: true,
    port: Number(config.smtp_port),
    auth: {
      user: config.smtp_username,
      pass: config.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
  const transporter = nodemailer.createTransport(mailerConfig);

  renderFile(
    __dirname + "/mail_templates/customer_reg.ejs",
    {logo, company_name, title, name, username, password, content, pract_em },
    ( err, data) => {
      if (err) {
        console.log(err);
        throw new Error("Error rendering email template");
      } else {
        const mailOptions = {
          from: from,
          to: email,
          cc: cc,
          subject: subject,
          html: data,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
          console.log("Message sent: %s", info.messageId);
        });
      }
    }
  );
}
const sendProfileUpdateEmail = async (
  email: string,
  username: string,
) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * from email_templates where id = 5"
  );
  const template = rows[0];
  const subject = template["subject"];
  const title = template["title"];
  const content = template["content"];

  const config = await getMailConfig();
  if (!config) throw new Error("Mail configuration not found");

  const mailerConfig = {
    host: config.smtp_host,
    secureConnection: true,
    port: Number(config.smtp_port),
    auth: {
      user: config.smtp_username,
      pass: config.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
  const transporter = nodemailer.createTransport(mailerConfig);

  renderFile(
    __dirname + "/mail_templates/profile_update.ejs",
    { title, username, content },
    (err, data) => {
      if (err) {
        console.log(err);
        throw new Error("Error rendering email template");
      } else {
        const mailOptions = {
          from: from,
          to: email,
          cc: cc,
          subject: subject,
          html: data,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
          console.log("Message sent: %s", info.messageId);
        });
      }
    }
  );
};
const sendCustomerLoginsMail = async (name: string, email: string, username:string, password:string, created_by: number) => { 
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * from email_templates where id = 7");
  const template = rows[0];
  const subject = template['subject'];
  const title = template['title'];
  const content = template['content'];
         
  const [rows2] = await pool.query<RowDataPacket[]>(
    "SELECT logo, company_name, email from users where id = ?",
    [created_by]
  );
  let company_name = '', logo = '', pract_em = '';
  if(rows2.length > 0) {
    const user = rows2[0];
    company_name = user['company_name'];
    logo = user['logo'];
    pract_em = email;
  }

  const config = await getMailConfig();
  if (!config) throw new Error("Mail configuration not found");

  const mailerConfig = {
    host: config.smtp_host,
    secureConnection: true,
    port: Number(config.smtp_port),
    auth: {
      user: config.smtp_username,
      pass: config.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
  const transporter = nodemailer.createTransport(mailerConfig);

  renderFile(
    __dirname + "/mail_templates/customer_logins.ejs",
    {logo, company_name, title, name, username, password, content, pract_em },
    ( err, data) => {
      if (err) {
        console.log(err);
        throw new Error("Error rendering email template");
      } else {
        const mailOptions = {
          from: from,
          to: email,
          cc: cc,
          subject: subject,
          html: data,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
          console.log("Message sent: %s", info.messageId);
        });
      }
    }
  );
}
const sendUserOrderStatusEmail = async (email: string, username: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM email_templates WHERE id = 4"
  );
  const template = rows[0];
  const subject = template["subject"];
  const title = template["title"];
  const content = template["content"];

  const config = await getMailConfig();
  if (!config) throw new Error("Mail configuration not found");

  const mailerConfig = {
    host: config.smtp_host,
    secureConnection: true,
    port: Number(config.smtp_port),
    auth: {
      user: config.smtp_username,
      pass: config.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
  const transporter = nodemailer.createTransport(mailerConfig);

  renderFile(
    __dirname + "/mail_templates/user_order_status.ejs",
    { title, username, content },
    (err, data) => {
      if (err) {
        console.log(err);
        throw new Error("Error rendering email template");
      } else {
        const mailOptions = {
          from: from,
          to: email,
          cc: cc,
          subject: subject,
          html: data,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
          console.log("Message sent: %s", info.messageId);
        });
      }
    }
  );
};
const sendUserForgotCodeEmail = async (email: string, code: string) => { 
  const subject = "Forgot Password Code";
  const title = "Forgot Password Code";
  const content = `Your forgot password code is ${code}`;

  const config = await getMailConfig();
  if(!config) throw new Error("Mail configuration not found");
  const mailerConfig = {
    host: config.smtp_host,
    secureConnection: true,
    port: Number(config.smtp_port),
    auth: {
      user: config.smtp_username,
      pass: config.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
  const transporter = nodemailer.createTransport(mailerConfig);

  renderFile(
    __dirname + "/mail_templates/forgot_code.ejs",
    { title, content },
    (err, data) => {
      if (err) {
        console.log(err);
        throw new Error("Error rendering email template");
      } else {
        const mailOptions = {
          from: from,
          to: email,
          cc: cc,
          subject: subject,
          html: data,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
          console.log("Message sent: %s", info.messageId);
        });
      }
    }
  );
}

const sendPhlebotomistCredentialsEmail = async (name: string, email: string, password: string) => {
  const subject = "Your Phlebotomist Login Credentials";
  const title = "Welcome to Youth Revisited!";

  const config = await getMailConfig();
  if (!config) throw new Error("Mail configuration not found");

  const mailerConfig = {
    host: config.smtp_host,
    secureConnection: true,
    port: Number(config.smtp_port),
    auth: {
      user: config.smtp_username,
      pass: config.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
  const transporter = nodemailer.createTransport(mailerConfig);

  renderFile(
    __dirname + "/mail_templates/phlebotomist_credentials.ejs",
    { name, email, password, title },
    (err, data) => {
      if (err) {
        console.log(err);
        throw new Error("Error rendering email template");
      } else {
        const mailOptions = {
          from: from,
          to: email,
          subject: subject,
          html: data,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
          console.log("Phlebotomist credentials email sent: %s", info.messageId);
        });
      }
    }
  );
};

type Recipient = string | string[];

const mapStatusForEmail = (dbStatus: string): string => {
  const normalized = dbStatus.trim().toLowerCase();
  switch (normalized) {
    case "assigned":
      return "Allocated";
    case "picked up":
      return "Booked In";
    case "delivered":
    case "completed":
    case "deliver":
    case "deliever":
      return "Sample Posted";
    case "cancelled":
      return "Cancelled";
    default:
      return dbStatus;
  }
};

interface INotificationDetail {
  label: string;
  value?: string | null;
  isSectionHeader?: boolean;
}

interface INotificationTemplateOptions {
  title: string;
  greeting?: string;
  introLines?: string[];
  detailRows?: INotificationDetail[];
  outroLines?: string[];
  signOff?: string;
}

const htmlEscape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeDetailValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === undefined || value === null) {
    return null;
  }
  return null;
};

const buildNotificationEmail = ({
  title,
  greeting,
  introLines = [],
  detailRows = [],
  outroLines = [],
  signOff = "Kind regards",
}: INotificationTemplateOptions): string => {
  const greetingHtml = greeting
    ? `<p style="margin: 0 0 12px 0; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">${htmlEscape(greeting)}</p>`
    : "";

  const introHtml = introLines
    .filter((line) => !!line && line.trim().length > 0)
    .map(
      (line) =>
        `<p style="margin: 5px 0; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">${htmlEscape(line.trim())}</p>`
    )
    .join("");

  const detailHtml = (() => {
    const items = detailRows
      .map((row) => {
        if (row.isSectionHeader) {
          return { type: "header" as const, label: row.label };
        }
        const val = normalizeDetailValue(row.value);
        if (!val) return null;
        return { type: "item" as const, label: row.label, value: val };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length === 0) return "";

    let html = "";
    let inList = false;
    for (const item of items) {
      if (item.type === "header") {
        if (inList) { html += "</ul>"; inList = false; }
        html += `<p style="margin: 15px 0 5px 0; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 600; line-height: 25px;">${htmlEscape(item.label)}</p>`;
      } else {
        if (!inList) { html += '<ul style="padding-left: 20px; margin: 5px 0;">'; inList = true; }
        html += `<li style="margin: 5px;"><strong>${htmlEscape(item.label)}:</strong> ${htmlEscape(item.value)}</li>`;
      }
    }
    if (inList) html += "</ul>";
    return html;
  })();

  const outroHtml = outroLines
    .filter((line) => !!line && line.trim().length > 0)
    .map(
      (line) =>
        `<p style="margin: 5px 0; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">${htmlEscape(line.trim())}</p>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${htmlEscape(title)}</title>
</head>
<body style="background-color: #f4f4f4; margin: 0; padding: 0;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <table bgcolor="#07274a" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
          <tr>
            <td align="center" valign="top" style="padding: 10px;">
              <img src="https://www.youth-revisited.co.uk/wp-content/uploads/2022/02/logo.png" alt="Youth Revisited" style="max-width: 200px;">
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0px 10px 0px 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
          <tr>
            <td bgcolor="#ffffff" align="center" valign="top" style="padding: 40px 20px 20px 20px; border-radius: 4px 4px 0px 0px; color: #111111; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 48px; font-weight: 400; letter-spacing: 4px; line-height: 48px;">
              <h1 style="font-size: 25px; font-weight: 600; margin: 0;">${htmlEscape(title)}</h1>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td bgcolor="#f4f4f4" align="center" style="padding: 0 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
          <tr>
            <td bgcolor="#ffffff" align="left" style="padding: 20px 30px 20px 30px; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">
              ${greetingHtml}
              ${introHtml}
              ${detailHtml}
              ${outroHtml}
              <p style="margin: 20px 0 5px 0; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">${htmlEscape(signOff)},<br/>Youth Revisited Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td bgcolor="#f4f4f4" align="center" style="padding: 10px 10px 0px 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
          <tr>
            <td bgcolor="#07274a" align="center" style="padding: 30px 30px 30px 30px; border-radius: 4px 4px 4px 4px; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">
              <h2 style="font-size: 20px; font-weight: 400; color: #ffffff; margin: 0;">Get in Touch</h2>
              <p style="margin: 0; color: #ffffff; font-size: 15px;">This email was sent by: info@youth-revisited.co.uk</p>
              <p style="margin: 0; color: #ffffff; font-size: 15px;">For any questions please send an email to info@youth-revisited.co.uk</p>
              <p style="margin: 0;"><a href="https://www.youth-revisited.co.uk/privacy-policy/" target="_blank" style="color: #ffffff; text-decoration: none;">Privacy Policy</a> | <a href="https://www.youth-revisited.co.uk/contactus/" target="_blank" style="color: #ffffff; text-decoration: none;">Help Center</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const toArray = (recipient: Recipient): string[] => {
  if (Array.isArray(recipient)) {
    return recipient
      .filter((email) => typeof email === "string" && email.trim().length > 0)
      .map((email) => email.trim());
  }
  if (typeof recipient === "string" && recipient.trim().length > 0) {
    return [recipient.trim()];
  }
  return [];
};

const sendEmail = async (
  to: Recipient,
  subject: string,
  html: string,
  options?: { cc?: Recipient | null }
): Promise<void> => {
  const recipients = toArray(to);
  if (recipients.length === 0) {
    console.warn("[MailService] sendEmail: no valid recipients (to was empty or invalid)", {
      to: typeof to === "string" ? to : Array.isArray(to) ? to : String(to),
    });
    return;
  }

  const config = await getMailConfig();
  if (!config) throw new Error("Mail configuration not found");

  const mailerConfig = {
    host: config.smtp_host,
    secureConnection: true,
    port: Number(config.smtp_port),
    auth: {
      user: config.smtp_username,
      pass: config.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
  const transporter = nodemailer.createTransport(mailerConfig);

  const ccOption =
    options && options.cc !== undefined
      ? options.cc === null
        ? undefined
        : toArray(options.cc)
      : cc;

  try {
    await transporter.sendMail({
      from,
      to: recipients,
      cc: ccOption,
      subject,
      html,
    });
  } catch (err) {
    console.error("[MailService] sendMail failed", {
      to: recipients,
      subject,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
};

interface IOrderIdentifiers {
  orderId: number;
  orderCode?: string | null;
}

const formatOrderRef = ({ orderId, orderCode }: IOrderIdentifiers): string =>
  orderCode && orderCode.trim().length > 0 ? `#${orderCode.trim()}` : `#${orderId}`;

interface IPlebJobAssignmentPayload extends IOrderIdentifiers {
  plebName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  jobStatus: string;
}

const getDetailValue = (value?: string | null, fallback = "Not provided"): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

const sendPlebJobAssignmentEmail = async (
  email: string,
  payload: IPlebJobAssignmentPayload
): Promise<void> => {
  const { plebName, customerName, customerPhone, customerAddress, jobStatus } = payload;
  const orderRef = formatOrderRef(payload);

  const introLines = [
    "A new job has been assigned to you.",
    `Order ${orderRef} is ready for you to review.`,
  ];

  const detailRows: INotificationDetail[] = [
    { label: "Order Reference", value: orderRef },
    { label: "Customer", value: getDetailValue(customerName) },
    { label: "Customer Phone", value: getDetailValue(customerPhone) },
    { label: "Customer Address", value: getDetailValue(customerAddress) },
    { label: "Starting Status", value: jobStatus },
  ];

  const html = buildNotificationEmail({
    title: "New Job Assigned",
    greeting: `Hi ${plebName},`,
    introLines,
    detailRows,
    outroLines: [
      "Please log in to your phlebotomist portal for full job details and keep the status updated as you progress.",
    ],
  });

  await sendEmail(email, `Job Assigned: ${orderRef}`, html, { cc: null });
};

interface IAdminNotificationPayload extends IOrderIdentifiers {
  status: string;
  plebName?: string | null;
  plebPhone?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  trackingNumber?: string | null;
}

const sendAdminJobNotificationEmail = async (
  adminEmails: Recipient,
  payload: IAdminNotificationPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);
  const displayStatus = mapStatusForEmail(payload.status);

  const detailRows: INotificationDetail[] = [
    { label: "Appointment Details", isSectionHeader: true },
    { label: "Order Reference", value: orderRef },
    { label: "Status", value: displayStatus },
    { label: "Phlebotomist", value: payload.plebName },
    { label: "Phlebotomist Phone", value: payload.plebPhone },
    { label: "Customer", value: payload.customerName },
    { label: "Customer Phone", value: payload.customerPhone },
    { label: "Customer Address", value: payload.customerAddress },
    { label: "Tracking Number", value: payload.trackingNumber },
  ];

  const html = buildNotificationEmail({
    title: `Order Update – ${displayStatus}`,
    greeting: "Hello Admin,",
    introLines: [
      `Order ${orderRef} status has been updated to "${displayStatus}".`,
    ],
    detailRows,
    outroLines: [
      "You can review the details in the admin dashboard.",
    ],
  });

  await sendEmail(adminEmails, `Order Update (${displayStatus}): ${orderRef}`, html, {
    cc: null,
  });
};

interface ICustomerAssignmentPayload extends IOrderIdentifiers {
  customerName?: string | null;
  plebName: string;
  plebPhone?: string | null;
}

const sendCustomerJobAssignmentEmail = async (
  email: string,
  payload: ICustomerAssignmentPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);
  const greeting =
    payload.customerName && payload.customerName.trim().length > 0
      ? `Dear ${payload.customerName},`
      : "Dear Customer,";

  const html = buildNotificationEmail({
    title: "Your Appointment Has Been Allocated",
    greeting,
    introLines: [
      "We are pleased to inform you that your appointment has now been allocated to a member of our clinical team.",
    ],
    detailRows: [
      { label: "Appointment Details", isSectionHeader: true },
      { label: "Order Reference", value: orderRef },
      { label: "Status", value: "Allocated" },
      { label: "Assigned Phlebotomist", isSectionHeader: true },
      { label: "Name", value: payload.plebName },
    ],
    outroLines: [
      "Your assigned phlebotomist will confirm a time and date for your upcoming appointment and attend your appointment as scheduled.",
    ],
  });

  await sendEmail(email, `Your Appointment Has Been Allocated – Order ${orderRef}`, html, { cc: null });
};

interface ICustomerJobStatusPayload extends IOrderIdentifiers {
  customerName?: string | null;
  plebName: string;
  newStatus: string;
  bookingDate?: string | null;
  bookingStartTime?: string | null;
  bookingEndTime?: string | null;
}

const formatBookingDate = (date?: string | null): string | null => {
  if (!date || date.trim().length === 0) return null;
  const d = new Date(date);
  return !isNaN(d.getTime())
    ? d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : date.trim();
};

const formatBookingTime = (
  startTime?: string | null,
  endTime?: string | null
): string | null => {
  const parts: string[] = [];
  if (startTime && startTime.trim().length > 0) parts.push(startTime.trim());
  if (endTime && endTime.trim().length > 0) parts.push(endTime.trim());
  return parts.length > 0 ? parts.join(" – ") : null;
};

const sendCustomerJobStatusUpdateEmail = async (
  email: string,
  payload: ICustomerJobStatusPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);
  const greeting =
    payload.customerName && payload.customerName.trim().length > 0
      ? `Dear ${payload.customerName},`
      : "Dear Customer,";

  const bookingDate = formatBookingDate(payload.bookingDate);
  const bookingTime = formatBookingTime(payload.bookingStartTime, payload.bookingEndTime);

  const detailRows: INotificationDetail[] = [
    { label: "Order Details", isSectionHeader: true },
    { label: "Order Reference", value: orderRef },
    { label: "Status", value: "Booked In" },
  ];
  if (bookingDate) {
    detailRows.push({ label: "Booking Date", value: bookingDate });
  }
  if (bookingTime) {
    detailRows.push({ label: "Booking Time", value: bookingTime });
  }

  const html = buildNotificationEmail({
    title: "Your Appointment Has Been Confirmed",
    greeting,
    introLines: [
      "We are pleased to confirm that your phlebotomy visit has now been booked in.",
    ],
    detailRows,
  });

  await sendEmail(email, `Your appointment has been confirmed – Order ${orderRef}`, html, { cc: null });
};

interface IJobCompletionPayload extends IOrderIdentifiers {
  plebName: string;
  trackingNumber?: string | null;
  customerName?: string | null;
  newStatus: string;
}

interface ICustomerCancellationPayload extends IOrderIdentifiers {
  customerName?: string | null;
}

const sendCustomerJobCancellationEmail = async (
  email: string,
  payload: ICustomerCancellationPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);
  const greeting =
    payload.customerName && payload.customerName.trim().length > 0
      ? `Dear ${payload.customerName},`
      : "Dear Customer,";

  const html = buildNotificationEmail({
    title: "Update Regarding Your Order",
    greeting,
    introLines: [
      "We regret to inform you that your visit has been cancelled.",
    ],
    detailRows: [
      { label: "Order Details", isSectionHeader: true },
      { label: "Order Reference", value: orderRef },
      { label: "Status", value: "Cancelled" },
    ],
    outroLines: [
      "If this cancellation was not requested by you, or if you would like to reschedule, please contact our support team.",
      "We apologise for any inconvenience this may cause and remain committed to providing you with the highest standard of care.",
    ],
  });

  await sendEmail(email, `Update Regarding Your Order – Order ${orderRef}`, html, { cc: null });
};

interface IPhlebBookingNotificationPayload extends IOrderIdentifiers {
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  booking: {
    shift_type: string;
    slot_times: string;
    price: string;
    weekend_surcharge?: string;
    zone: string;
    availability?: string;
    additional_preferences?: string;
  };
}

const sendCustomerJobCompletionEmail = async (
  email: string,
  payload: IJobCompletionPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);
  const greeting =
    payload.customerName && payload.customerName.trim().length > 0
      ? `Dear ${payload.customerName},`
      : "Dear Customer,";

  const trackingDisplay = payload.trackingNumber && payload.trackingNumber.trim().length > 0
    ? payload.trackingNumber.trim()
    : null;

  const html = buildNotificationEmail({
    title: "Your Sample Has Been Posted",
    greeting,
    introLines: [
      "We are pleased to confirm that your sample has been posted back to the Laboratory.",
    ],
    detailRows: [
      { label: "Order Summary", isSectionHeader: true },
      { label: "Order Reference", value: orderRef },
      { label: "Status", value: "Posted" },
      { label: "Tracking Number", value: trackingDisplay },
    ],
    outroLines: [
      "Your visit has been successfully finalised. Your sample has been posted to the Laboratory today and if any follow-up is required, a member of our team will be in touch.",
      "We truly appreciate your trust in Youth Revisited. If you require any further assistance, please don't hesitate to contact us.",
    ],
    signOff: "Warm regards",
  });

  await sendEmail(email, `Your sample has been Posted – Order ${orderRef}`, html, { cc: null });
};

interface IPlebStatusPayload extends IOrderIdentifiers {
  plebName: string;
  newStatus: string;
  customerName?: string | null;
  trackingNumber?: string | null;
}

const sendPlebJobStatusUpdateEmail = async (
  email: string,
  payload: IPlebStatusPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);
  const displayStatus = mapStatusForEmail(payload.newStatus);

  const detailRows: INotificationDetail[] = [
    { label: "Order Reference", value: orderRef },
    { label: "Customer", value: getDetailValue(payload.customerName) },
    { label: "Status", value: displayStatus },
  ];

  const html = buildNotificationEmail({
    title: "Job Status Update",
    greeting: `Hi ${payload.plebName},`,
    introLines: [
      `The status for order ${orderRef} has been updated to "${displayStatus}".`,
    ],
    detailRows,
    outroLines: [
      "Please log in to your portal for full details and keep the status updated as you progress.",
    ],
  });

  await sendEmail(email, `Job Update: ${displayStatus} - ${orderRef}`, html, { cc: null });
};

const sendPlebJobCompletionEmail = async (
  email: string,
  payload: IPlebStatusPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);
  const displayStatus = mapStatusForEmail(payload.newStatus);

  const detailRows: INotificationDetail[] = [
    { label: "Order Reference", value: orderRef },
    { label: "Customer", value: getDetailValue(payload.customerName) },
    { label: "Status", value: displayStatus },
    { label: "Tracking Number", value: payload.trackingNumber },
  ];

  const html = buildNotificationEmail({
    title: "Visit Completed",
    greeting: `Hi ${payload.plebName},`,
    introLines: [
      `Order ${orderRef} has been marked as "${displayStatus}".`,
      "Thank you for completing this visit.",
    ],
    detailRows,
    outroLines: [
      "Please ensure all paperwork and samples are handled as required.",
    ],
  });

  await sendEmail(email, `Visit Completed - ${orderRef}`, html, { cc: null });
};

const sendPhlebBookingNotification = async (
  toEmails: Recipient,
  payload: IPhlebBookingNotificationPayload
): Promise<void> => {
  const orderRef = formatOrderRef({ orderId: payload.orderId, orderCode: payload.orderCode });
  const detailRows: INotificationDetail[] = [
    { label: "Order Reference", value: orderRef },
    { label: "Customer Name", value: getDetailValue(payload.customerName) },
    { label: "Customer Email", value: getDetailValue(payload.customerEmail) },
    { label: "Customer Phone", value: getDetailValue(payload.customerPhone) },
    { label: "Zone", value: getDetailValue(payload.booking.zone) },
    { label: "Shift", value: getDetailValue(payload.booking.shift_type) },
    { label: "Slot", value: getDetailValue(payload.booking.slot_times) },
    { label: "Price", value: getDetailValue(payload.booking.price) },
    { label: "Weekend Surcharge", value: getDetailValue(payload.booking.weekend_surcharge) },
    { label: "Availability", value: getDetailValue(payload.booking.availability) },
    { label: "Additional Preferences", value: getDetailValue(payload.booking.additional_preferences) },
  ];

  const html = buildNotificationEmail({
    title: "New Home Visit Booking",
    introLines: [
      "A new home phlebotomy booking has been placed.",
      "Details are listed below."
    ],
    detailRows,
    outroLines: [
      "Please coordinate the booking and reach out to the customer if needed."
    ],
  });

  await sendEmail(toEmails, `New Home Visit Booking - ${orderRef}`, html, {
    cc: getAdminCcRecipients(),
  });
};

// ---- Home Visit Booking Email (to Peter / Bloodservices) ----

interface IHomeVisitEmailPayload {
  orderCode: string;
  testNames: string;
  practitionerPhone: string;
  clientName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerPostcode: string;
  totalVal: number;
  slotTimes?: string;
  shiftType?: string;
  zone?: string;
  price?: string;
  weekendSurcharge?: number;
  availability?: string;
  additionalPreferences?: string;
}

const buildHomeVisitEmailHtml = (p: IHomeVisitEmailPayload): string => {
  const formatCurrency = (val: number): string => `\u00A3${val.toFixed(2)}`;

  let bookingItems = "";
  if (p.slotTimes)
    bookingItems += `<li style="margin:5px;"><strong>Booking Time:</strong> ${htmlEscape(p.slotTimes)}</li>`;
  if (p.shiftType)
    bookingItems += `<li style="margin:5px;"><strong>Shift Type:</strong> ${htmlEscape(p.shiftType)}</li>`;
  if (p.zone)
    bookingItems += `<li style="margin:5px;"><strong>Zone:</strong> ${htmlEscape(p.zone)}</li>`;
  if (p.price)
    bookingItems += `<li style="margin:5px;"><strong>Booking Amount:</strong> ${htmlEscape(formatCurrency(parseFloat(p.price)))}</li>`;
  if (p.weekendSurcharge && p.weekendSurcharge > 0)
    bookingItems += `<li style="margin:5px;"><strong>Weekend Surcharge:</strong> ${htmlEscape(formatCurrency(p.weekendSurcharge))}</li>`;

  let optionalItems = "";
  if (p.availability && p.availability.trim() !== "")
    optionalItems += `<li style="margin:5px;"><strong>Availability:</strong> ${htmlEscape(p.availability)}</li>`;
  if (p.additionalPreferences && p.additionalPreferences.trim() !== "")
    optionalItems += `<li style="margin:5px;"><strong>Additional Preferences:</strong> ${htmlEscape(p.additionalPreferences)}</li>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="background-color: #f4f4f4; margin: 0; padding: 0;">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr><td align="center">
    <table bgcolor="#07274a" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
      <tr><td align="center" valign="top" style="padding: 10px;">
        <img src="https://www.youth-revisited.co.uk/wp-content/uploads/2022/02/logo.png" alt="Youth Revisited" style="max-width:200px;height:auto;display:block;">
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding: 0px 10px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
      <tr><td bgcolor="#ffffff" align="center" valign="top"
        style="padding: 40px 20px 20px 20px; border-radius: 4px 4px 0px 0px;
        color: #111111; font-family: Lato, Helvetica, Arial, sans-serif;
        font-size: 25px; font-weight: 600;">
        New Home Phlebotomy Booking (From App)
      </td></tr>
    </table>
  </td></tr>
  <tr><td bgcolor="#f4f4f4" align="center" style="padding: 0 10px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
      <tr><td bgcolor="#ffffff" align="left"
        style="padding: 20px 30px; color: #666666;
        font-family: Lato, Helvetica, Arial, sans-serif;
        font-size: 16px; line-height: 24px;">
        <p style="margin:5px;">A new Home Phlebotomy booking has been placed.</p>
        <ul style="padding-left:20px;">
          <li style="margin:5px;"><strong>Order ID:</strong> ${htmlEscape(p.orderCode)}</li>
          <li style="margin:5px;"><strong>Blood Test:</strong> ${htmlEscape(p.testNames)}</li>
          <li style="margin:5px;"><strong>Practitioner Phone:</strong> ${htmlEscape(p.practitionerPhone || "NA")}</li>
          <li style="margin:5px;"><strong>Customer Name:</strong> ${htmlEscape(p.clientName)}</li>
          <li style="margin:5px;"><strong>Customer Email:</strong> ${htmlEscape(p.customerEmail)}</li>
          <li style="margin:5px;"><strong>Customer Phone:</strong> ${htmlEscape(p.customerPhone)}</li>
          <li style="margin:5px;"><strong>Customer Address:</strong> ${htmlEscape(p.customerAddress)}</li>
          <li style="margin:5px;"><strong>Customer Postcode:</strong> ${htmlEscape(p.customerPostcode)}</li>
          ${bookingItems}
          <li style="margin:5px;"><strong>Total Order Amount:</strong> ${htmlEscape(formatCurrency(p.totalVal))}</li>
          ${optionalItems}
        </ul>
        <p style="margin:5px;">Thank you.</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td bgcolor="#f4f4f4" align="center" style="padding: 10px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
      <tr><td bgcolor="#07274a" align="center"
        style="padding: 30px; border-radius: 4px;
        color: #ffffff; font-family: Lato, Helvetica, Arial, sans-serif; font-size: 15px;">
        <h2 style="color:#ffffff; margin:0; font-size:18px;">Get in Touch</h2>
        <p style="margin:5px 0;">This email was sent by: info@youth-revisited.co.uk</p>
        <p style="margin:5px 0;">For any questions please send an email to info@youth-revisited.co.uk</p>
        <p style="margin:5px 0;">
          <a href="https://www.youth-revisited.co.uk/privacy-policy/" target="_blank" style="color:#ffffff; text-decoration:none;">Privacy Policy</a> |
          <a href="https://www.youth-revisited.co.uk/contactus/" target="_blank" style="color:#ffffff; text-decoration:none;">Help Center</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
};

const sendHomeVisitBookingEmail = async (
  payload: IHomeVisitEmailPayload
): Promise<void> => {
  const subject = `New Home Phlebotomy Booking - Order ${payload.orderCode}`;
  const html = buildHomeVisitEmailHtml(payload);
  await sendEmail("Bloodservices@mail.com", subject, html, { cc: null });
};

// ---- New Order from App Email (to Jade + info) ----

interface INewOrderEmailPayload {
  clientName: string;
  customerEmail: string;
  customerPhone: string;
  fullAddress: string;
  practitionerName: string;
  testNames: string;
  otherChargesNames: string;
  otherChargesAmount: string;
  checkoutType: string;
  totalVal: string;
  orderId: string;
}

const buildNewOrderFromAppHtml = (p: INewOrderEmailPayload): string => {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="background-color: #f4f4f4; margin: 0; padding: 0;">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr><td align="center">
    <table bgcolor="#06274a" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
      <tr><td align="center" valign="top" style="padding: 15px;">
        <img src="https://www.youth-revisited.co.uk/wp-content/uploads/2025/04/logo-300x59-1.png"
          alt="Youth Revisited" style="max-width:200px; height:auto; display:block;">
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding: 0px 10px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
      <tr><td bgcolor="#ffffff" align="center"
        style="padding: 30px 20px 20px 20px; border-radius: 4px 4px 0px 0px;
        color: #06274a; font-family: Arial, sans-serif;
        font-size: 24px; font-weight: bold;">
        New Order from App
      </td></tr>
    </table>
  </td></tr>
  <tr><td bgcolor="#f4f4f4" align="center" style="padding: 0 10px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px;">
      <tr><td bgcolor="#ffffff" align="left"
        style="padding: 20px 30px 30px 30px;
        color: #555555; font-family: Arial, sans-serif;
        font-size: 16px; line-height: 24px;">
        <p style="margin: 5px 0 15px 0;">A new order from app has been placed. Details are below:</p>
        <ul style="padding-left:20px; margin:0;">
          <li><strong>Customer Name:</strong> ${htmlEscape(p.clientName)}</li>
          <li><strong>Customer Email:</strong> ${htmlEscape(p.customerEmail)}</li>
          <li><strong>Customer Phone:</strong> ${htmlEscape(p.customerPhone)}</li>
          <li><strong>Customer Address:</strong> ${htmlEscape(p.fullAddress)}</li>
          <li><strong>Practitioner:</strong> ${htmlEscape(p.practitionerName)}</li>
          <li><strong>Tests:</strong> ${htmlEscape(p.testNames)}</li>
          <li><strong>Other Charges:</strong> ${htmlEscape(p.otherChargesNames || "NA")}</li>
          <li><strong>Other Charges Amount:</strong> ${htmlEscape(p.otherChargesAmount || "NA")}</li>
          <li><strong>Checkout Type:</strong> ${htmlEscape(p.checkoutType)}</li>
          <li><strong>Amount Paid:</strong> \u00A3${htmlEscape(p.totalVal)}</li>
        </ul>
        <div style="text-align:center; margin-top:30px;">
          <a href="https://www.practitioner.youth-revisited.co.uk/view-order.php?order_id=${htmlEscape(p.orderId)}"
            style="background-color:#06274a; color:#ffffff;
            padding:12px 25px; text-decoration:none;
            border-radius:4px; display:inline-block;
            font-weight:bold;">
            View Order Details
          </a>
        </div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td bgcolor="#06274a" align="center" style="padding: 20px; color:#ffffff; font-family: Arial, sans-serif; font-size: 13px;">
    &copy; ${year} Youth Revisited. All rights reserved.
  </td></tr>
</table>
</body></html>`;
};

const sendNewOrderFromAppEmail = async (
  payload: INewOrderEmailPayload
): Promise<void> => {
  const html = buildNewOrderFromAppHtml(payload);
  await sendEmail(
    ["info@youth-revisited.co.uk", "Jadebradley.work@gmail.com"],
    "New Order from App",
    html,
    { cc: null }
  );
};

export default {
  getMailConfig,
  addMailConfig,
  updateMailConfig,
  getMailTemplates,
  addMailTemplate,
  updateMailTemplate,
  sendRegistrationMail,
  sendCustomerRegistrationMail,
  sendCustomerLoginsMail,
  sendProfileUpdateEmail,
  sendUserOrderStatusEmail,
  sendUserForgotCodeEmail,
  sendPhlebotomistCredentialsEmail,
  sendPlebJobAssignmentEmail,
  sendAdminJobNotificationEmail,
  sendCustomerJobAssignmentEmail,
  sendCustomerJobStatusUpdateEmail,
  sendCustomerJobCompletionEmail,
  sendCustomerJobCancellationEmail,
  sendPlebJobStatusUpdateEmail,
  sendPlebJobCompletionEmail,
  sendPhlebBookingNotification,
  sendHomeVisitBookingEmail,
  sendNewOrderFromAppEmail,
} as const;