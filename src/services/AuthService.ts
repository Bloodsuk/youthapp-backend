import { generateUniqueString } from "@src/util/misc";

import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IUser } from "@src/interfaces/IUser";
import { RouteError } from "@src/other/classes";
import { pool } from "@src/server";
import crypto from "crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import MailService from "./MailService";
import { Gender, UserLevels, YesNo } from "@src/constants/enums";
import { ICustomer } from "@src/interfaces/ICustomer";

// **** Variables **** //

// Errors
export const Errors = {
  InvalidEmail: "Email Address Is Not Valid!",
  InvalidPassword: "Invalid password",
  AccountNotFound: "No account found with this email for the selected login type.",
  NoPassword: `No password`,
  AlreadyExists: "Email Already Exists!!",
  UsernameAlreadyExists: "Username Already Exists!!",
  InvalidToken: "Invalid token.",
  TokenExpired: "Token expired.",
} as const;

// **** Functions **** //

/**
 * Login a practitioner, moderator, or customer (never phlebotomists).
 * Phlebotomists must use POST /auth/login with isPleb: true.
 */
async function login(email: string, password: string) {
  const hashedPassword = generateHash(password);

  const [userRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1",
    [email, email]
  );

  if (userRows.length > 0) {
    const user = userRows[0];
    if (user.password === hashedPassword) {
      if (user.status == 0) {
        throw new RouteError(
          HttpStatusCodes.UNAUTHORIZED,
          "Account not activated please contact administrator"
        );
      }
      return user as IUser;
    }
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, Errors.InvalidPassword);
  }

  // Master pass login (practitioner only)
  const [masterRows] = await pool.query<RowDataPacket[]>(
    `SELECT users.* FROM users
     INNER JOIN masterlogin ON users.user_level = masterlogin.user_level
     WHERE users.user_level = 'Practitioner'
       AND (users.email = ? OR users.username = ?)
       AND masterlogin.masterpass = ?
     LIMIT 1`,
    [email, email, hashedPassword]
  );

  if (masterRows.length > 0) {
    const user = masterRows[0];
    if (user.status == 0) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Account not activated please contact administrator"
      );
    }
    return user as IUser;
  }

  const [customerRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM customers WHERE email = ? OR username = ? LIMIT 1",
    [email, email]
  );

  if (customerRows.length > 0) {
    const customer = customerRows[0];
    if (customer.password === hashedPassword) {
      if (customer.status == 0) {
        throw new RouteError(
          HttpStatusCodes.UNAUTHORIZED,
          "Account not activated please contact administrator"
        );
      }
      return customer as IUser;
    }
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, Errors.InvalidPassword);
  }

  throw new RouteError(HttpStatusCodes.UNAUTHORIZED, Errors.AccountNotFound);
}

/**
 * Register a user.
 */
async function register(
  first_name: string,
  last_name: string,
  email: string,
  phone: string,
  company_name: string,
  area_of_business: string,
  number_of_clients: string,
  test_per_month: string,
  comments_box: string,
  password: string,
  con_pass: string,
  user_level: string | null,
  created_by: number,
  address: string,
  town: string,
  country: string,
  postal_code: string,
  cus_notification_types: any,
  mail_sent: string,
  date_of_birth: string,
  gender: string,
  username: string,
) {
  if (!user_level) user_level = "Practitioner"
  if (!["practitioner", "customer"].includes(user_level.toLocaleLowerCase())) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Invalid user type!!"
    );
  }

  if (user_level.toLocaleLowerCase() == "customer") {
    if (!created_by) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Practitioner should be valid!!"
      );
    }
    if (!(await usernameAvailable(username))) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        Errors.UsernameAlreadyExists
      );
    }
    con_pass = con_pass ? con_pass : password;
  } else {
    if (!(await usernameAvailable(username))) {
      username = (username + last_name).replace(' ', '-')
      if (!(await usernameAvailable(username))) {
        username = generateUniqueString(username);
      }
    }
    username = username.toLowerCase();
  }

  if (password != con_pass) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Password not matched!!"
    );
  }
  // Fetch user
  const [result] = await pool.query<RowDataPacket[]>(
    "SELECT email FROM users WHERE email = ?",
    [email]
  );
  const [result2] = await pool.query<RowDataPacket[]>(
    "SELECT email FROM customers WHERE email = ?",
    [email]
  );

  if (result.length > 0 || result2.length > 0) {
    throw new RouteError(
      HttpStatusCodes.CONFLICT,
      Errors.AlreadyExists
    );
  }
  // Hash password
  password = crypto.createHash("md5").update(con_pass).digest("hex");
  let user: IUser;
  // Add user
  if (user_level.toLocaleLowerCase() == "customer") {
    const customerId = await addCustomer({
      first_name,
      last_name,
      date_of_birth,
      gender,
      username,
      email,
      phone,
      password,
      comments_box,
      test_per_month,
      number_of_clients,
      area_of_business,
      company_name,
      user_level,
      created_by,
      address,
      town,
      country,
      postal_code,
      cus_notification_types,
      mail_sent
    })
    if (!customerId) {
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        "Oops! An error occurred, please retry again."
      );
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM customers WHERE id = ? LIMIT 1",
      [customerId]
    );
    user = rows[0] as IUser;
  } else {
    const [newUser] = await pool.query<ResultSetHeader>(
      "INSERT INTO users(first_name ,last_name, username, email,phone, password, status, is_verified, comments_box,test_per_month,number_of_clients,area_of_business,company_name, user_level) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        first_name,
        last_name,
        username,
        email,
        phone,
        password,
        "0",
        "1",
        comments_box,
        test_per_month,
        number_of_clients,
        area_of_business,
        company_name,
        user_level,
      ]
    );
    if (!newUser.insertId) {
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        "Oops! An error occurred, please contact admin."
      );
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [newUser.insertId]
    );
    user = rows[0] as IUser;
  }

  // Send email
  // await MailService.sendRegistrationMail(email, username);
  return user;
}

/**
 * INFO: Function to add customer
 * @param customer 
 * @returns 
 */
async function addCustomer(customer: Record<string, any>): Promise<number> {
  const fore_name = customer["first_name"] ? customer["first_name"].trim() : "";
  const sur_name = customer["last_name"] ? customer["last_name"].trim() : "";
  const user_level = customer["user_level"] ? customer["user_level"].trim() : "";
  const date_of_birth = customer["date_of_birth"]
    ? customer["date_of_birth"].trim()
    : "";
  const gender = customer["gender"] ? customer["gender"] : Gender.Male;
  const address = customer["address"] ? customer["address"].trim() : "";
  const town = customer["town"] ? customer["town"].trim() : "";
  const country = customer["country"] ? customer["country"].trim() : "";
  const postal_code = customer["postal_code"]
    ? customer["postal_code"].trim()
    : "";
  const email = customer["email"] ? customer["email"].trim() : "";
  const telephone = customer["phone"] ? customer["phone"].trim() : "";
  const comments = customer["comments_box"] ? customer["comments_box"].trim() : "";
  const created_by = customer["created_by"] ? customer["created_by"] : 1;
  const username = customer["username"] ? customer["username"].trim() : "";
  const password = customer["password"] ? customer["password"].trim() : "";
  const notification_types = customer["cus_notification_types"] ? customer["cus_notification_types"] : "";
  const notifications = customer["mail_sent"] === "Yes" ? YesNo.Yes : YesNo.No;

  const data: Partial<ICustomer> = {
    fore_name,
    sur_name,
    date_of_birth,
    gender,
    address,
    town,
    country,
    postal_code,
    username,
    email,
    telephone,
    comments,
    created_by,
    password,
    user_level,
    notifications,
    notification_types: Array.isArray(notification_types)
      ? notification_types.join(",")
      : "",
  };
  const [result3] = await pool.query<ResultSetHeader>(
    "INSERT INTO customers SET ?",
    data
  );
  const id = result3.insertId;
  const code = 200200200 + id;
  const client_code = "PID:" + code;
  await pool.query("UPDATE customers SET client_code = ? WHERE id = ?", [
    client_code,
    id,
  ]);
  return id;
}

/**
 * Forgot password.
 */
async function forgetPassword(email: string) {
  // Fetch user
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT email FROM users WHERE email = ?",
    [email]
  );

  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, Errors.InvalidEmail);
  }
  return true;
}

const generateHash = (password: string) => {
  return crypto.createHash("md5").update(password).digest("hex");
}

async function usernameAvailable(username: string) {
  let query = await pool.query<RowDataPacket[]>("SELECT username from users where username=? limit 1", [username]);
  if (query[0].length === 0) {
    query = await pool.query<RowDataPacket[]>("SELECT username from customers where username=? limit 1", [username]);
  }
  return query[0].length === 0;
}

// **** Export default **** //

export default {
  login,
  register,
  forgetPassword,
  generateHash,
  usernameAvailable
} as const;
