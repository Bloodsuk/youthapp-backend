import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import nodemailer from "nodemailer";
import { renderFile } from 'ejs'; 
import { IMailConfig } from "@src/interfaces/IMailConfig";
import { IMailTemplate } from "@src/interfaces/IMailTemplate";

const from = "info@youth-revisited.co.uk";
const cc = "info@youth-revisited.co.uk";

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
} as const;