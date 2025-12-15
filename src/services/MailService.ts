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
          cc: cc,
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

interface INotificationDetail {
  label: string;
  value?: string | null;
}

interface INotificationTemplateOptions {
  title: string;
  greeting?: string;
  introLines?: string[];
  detailRows?: INotificationDetail[];
  outroLines?: string[];
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
}: INotificationTemplateOptions): string => {
  const introHtml = introLines
    .filter((line) => !!line && line.trim().length > 0)
    .map(
      (line) =>
        `<p style="margin: 0 0 12px 0; color: #333333; font-size: 16px; line-height: 22px;">${htmlEscape(
          line.trim()
        )}</p>`
    )
    .join("");

  const detailHtml = detailRows
    .map((row) => ({
      label: row.label,
      value: normalizeDetailValue(row.value),
    }))
    .filter((row) => !!row.value)
    .map(
      (row) => `
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #e3e3e3; font-weight: 600; background-color: #f7f9fc;">${htmlEscape(
            row.label
          )}</td>
          <td style="padding: 6px 12px; border: 1px solid #e3e3e3;">${htmlEscape(
            row.value!
          )}</td>
        </tr>`
    )
    .join("");

  const detailsTable =
    detailHtml.length > 0
      ? `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin: 10px 0;">${detailHtml}</table>`
      : "";

  const outroHtml = outroLines
    .filter((line) => !!line && line.trim().length > 0)
    .map(
      (line) =>
        `<p style="margin: 12px 0 0 0; color: #333333; font-size: 16px; line-height: 22px;">${htmlEscape(
          line.trim()
        )}</p>`
    )
    .join("");

  const greetingHtml = greeting
    ? `<p style="margin: 0 0 12px 0; color: #333333; font-size: 16px; line-height: 22px;">${htmlEscape(
        greeting
      )}</p>`
    : "";

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${htmlEscape(title)}</title>
    </head>
    <body style="background-color: #f4f4f4; padding: 20px; font-family: 'Lato', Helvetica, Arial, sans-serif;">
      <table align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="background-color: #07274a; padding: 24px 32px; color: #ffffff;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 600;">${htmlEscape(title)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 32px;">
            ${greetingHtml}
            ${introHtml}
            ${detailsTable}
            ${outroHtml}
            <p style="margin: 24px 0 0 0; color: #333333; font-size: 16px; line-height: 22px;">Regards,<br/>Youth Revisited Team</p>
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

  await transporter.sendMail({
    from,
    to: recipients,
    cc: ccOption,
    subject,
    html,
  });
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

  await sendEmail(email, `Job Assigned: ${orderRef}`, html);
};

interface IAdminAssignmentPayload extends IOrderIdentifiers {
  plebName: string;
  plebPhone?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
}

const sendAdminJobAssignmentEmail = async (
  adminEmails: Recipient,
  payload: IAdminAssignmentPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);

  const detailRows: INotificationDetail[] = [
    { label: "Order Reference", value: orderRef },
    { label: "Pleb", value: getDetailValue(payload.plebName) },
    { label: "Pleb Phone", value: getDetailValue(payload.plebPhone) },
    { label: "Customer", value: getDetailValue(payload.customerName) },
    { label: "Customer Phone", value: getDetailValue(payload.customerPhone) },
    { label: "Customer Address", value: getDetailValue(payload.customerAddress) },
  ];

  const html = buildNotificationEmail({
    title: "Job Assigned to Pleb",
    greeting: "Hello Admin,",
    introLines: [
      `${payload.plebName} has been assigned to order ${orderRef}.`,
    ],
    detailRows,
    outroLines: [
      "You can review the assignment details in the admin dashboard.",
    ],
  });

  await sendEmail(adminEmails, `Job Assigned: ${orderRef} → ${payload.plebName}`, html, {
    cc: getAdminCcRecipients(),
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
      ? `Hello ${payload.customerName},`
      : "Hello,";

  const detailRows: INotificationDetail[] = [
    { label: "Order Reference", value: orderRef },
    { label: "Assigned Phlebotomist", value: payload.plebName },
    { label: "Pleb Phone", value: payload.plebPhone },
  ];

  const html = buildNotificationEmail({
    title: "Phlebotomist Assigned",
    greeting,
    introLines: [
      `${payload.plebName} has been assigned to carry out your blood draw for order ${orderRef}.`,
    ],
    detailRows,
    outroLines: [
      "They will reach out if any additional coordination is required.",
    ],
  });

  await sendEmail(email, `Your Phlebotomist: ${payload.plebName}`, html);
};

interface IJobStatusPayload extends IOrderIdentifiers {
  plebName: string;
  newStatus: string;
  trackingNumber?: string | null;
}

const sendAdminJobStatusUpdateEmail = async (
  adminEmails: Recipient,
  payload: IJobStatusPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);

  const detailRows: INotificationDetail[] = [
    { label: "Order Reference", value: orderRef },
    { label: "Pleb", value: payload.plebName },
    { label: "New Status", value: payload.newStatus },
    { label: "Tracking Number", value: payload.trackingNumber },
  ];

  const html = buildNotificationEmail({
    title: "Pleb Job Status Updated",
    greeting: "Hello Admin,",
    introLines: [
      `${payload.plebName} updated the status for order ${orderRef}.`,
    ],
    detailRows,
    outroLines: [
      "Please review if any additional action is needed.",
    ],
  });

  await sendEmail(
    adminEmails,
    `Job Status Updated (${payload.newStatus}): ${orderRef}`,
    html,
    {
      cc: getAdminCcRecipients(),
    }
  );
};

interface ICustomerJobStatusPayload extends IOrderIdentifiers {
  customerName?: string | null;
  plebName: string;
  newStatus: string;
}

const sendCustomerJobStatusUpdateEmail = async (
  email: string,
  payload: ICustomerJobStatusPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);
  const greeting =
    payload.customerName && payload.customerName.trim().length > 0
      ? `Hello ${payload.customerName},`
      : "Hello,";

  const detailRows: INotificationDetail[] = [
    { label: "Order Reference", value: orderRef },
    { label: "Pleb", value: payload.plebName },
    { label: "New Status", value: payload.newStatus },
  ];

  const html = buildNotificationEmail({
    title: "Job Status Update",
    greeting,
    introLines: [
      `${payload.plebName} has updated the status of your order (${orderRef}) to "${payload.newStatus}".`,
    ],
    detailRows,
    outroLines: [
      "We will keep you updated as the job progresses.",
    ],
  });

  await sendEmail(email, `Status Update: ${payload.newStatus} for ${orderRef}`, html);
};

interface IJobCompletionPayload extends IOrderIdentifiers {
  plebName: string;
  trackingNumber?: string | null;
  customerName?: string | null;
  newStatus: string;
}

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

const sendAdminJobCompletionEmail = async (
  adminEmails: Recipient,
  payload: IJobCompletionPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);

  const detailRows: INotificationDetail[] = [
    { label: "Order Reference", value: orderRef },
    { label: "Pleb", value: payload.plebName },
    { label: "Status", value: payload.newStatus },
    { label: "Tracking Number", value: payload.trackingNumber },
  ];

  const html = buildNotificationEmail({
    title: "Job Marked as Completed",
    greeting: "Hello Admin,",
    introLines: [
      `${payload.plebName} marked order ${orderRef} as "${payload.newStatus}".`,
    ],
    detailRows,
    outroLines: [
      "Please ensure the logistics follow-up is handled promptly.",
    ],
  });

  await sendEmail(adminEmails, `Job Completed: ${orderRef}`, html, {
    cc: getAdminCcRecipients(),
  });
};

const sendCustomerJobCompletionEmail = async (
  email: string,
  payload: IJobCompletionPayload
): Promise<void> => {
  const orderRef = formatOrderRef(payload);
  const greeting =
    payload.customerName && payload.customerName.trim().length > 0
      ? `Hello ${payload.customerName},`
      : "Hello,";

  const html = buildNotificationEmail({
    title: "Blood Sample Collected",
    greeting,
    introLines: [
      `${payload.plebName} has updated your order (${orderRef}) to "${payload.newStatus}".`,
      "The blood sample has been collected successfully.",
      "Thank you for your cooperation. We will notify you once your results are available.",
    ],
    detailRows: [
      { label: "Order Reference", value: orderRef },
      { label: "Status", value: payload.newStatus },
      { label: "Tracking Number", value: payload.trackingNumber },
    ],
  });

  await sendEmail(
    email,
    `Blood Sample Collected for ${orderRef}`,
    html
  );
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
  sendAdminJobAssignmentEmail,
  sendCustomerJobAssignmentEmail,
  sendAdminJobStatusUpdateEmail,
  sendCustomerJobStatusUpdateEmail,
  sendAdminJobCompletionEmail,
  sendCustomerJobCompletionEmail,
  sendPhlebBookingNotification,
} as const;