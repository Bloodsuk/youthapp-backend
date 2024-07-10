/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { ICustomer } from "@src/interfaces/ICustomer";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { empty, getTotalCount, trim } from "@src/util/misc";
import AuthService, { Errors } from "./AuthService";
import { Gender, UserLevels, YesNo } from "@src/constants/enums";
import MailService from "./MailService";
import { ISessionUser } from "@src/interfaces/ISessionUser";
import { LIMIT } from "@src/constants/pagination";

// **** Variables **** //

export const NOT_FOUND_ERR = "Customer not found";

// **** Functions **** //

/**
 * Get all customers.
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}

async function getAll(
  sessionUser: ISessionUser | undefined,
  page: number = 1,
  search?: string
): Promise<IGetResponse<ICustomer>> {
  let where = "";
  const user_id = sessionUser?.id;
  const user_level = sessionUser?.user_level;
  const practitioner_id = sessionUser?.practitioner_id;

  if (user_id && user_id > 1) {
    where = " AND customers.created_by=" + user_id;
    if (user_level === UserLevels.Moderator) {
      where = " AND customers.created_by=" + practitioner_id;
    } else if (user_level === UserLevels.Customer) {
      return { data: [], total: 0 };
    } else if (user_level === UserLevels.Practitioner) {
      where =
        " AND ((customers.created_by=" +
        user_id +
        ") OR ( customers.created_by = 1 AND users.practitioner_id =" +
        user_id +
        "))";
    }
  }

  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  // If there's a search term, add the search condition
  let searchSql = "";
  if (search && !empty(search)) {
    if (search.split(" ").length >= 2) {
      const [first_name, last_name] = search.split(" ");
      searchSql = ` AND (customers.fore_name LIKE '%${first_name}%' AND customers.sur_name LIKE '%${last_name}%')`;
    } else {
      searchSql = ` AND (customers.email LIKE '%${search}%' OR customers.fore_name LIKE '%${search}%' OR customers.sur_name LIKE '%${search}%')`;
    }
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT customers.id, customers.client_code, customers.fore_name, customers.sur_name, customers.date_of_birth, customers.created_at, customers.email, 
    CONCAT(users.first_name, ' ', users.last_name) AS practitioner_name 
    FROM customers 
    LEFT JOIN users ON users.id = customers.created_by 
    WHERE 1 ${where} ${searchSql}
    ORDER BY customers.created_at DESC ${pagination}`
  );

  const allCustomers = rows.map((customer) => {
    return customer as ICustomer;
  });

  const [rows2] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(customers.id) as count FROM customers 
    LEFT JOIN users ON users.id = customers.created_by 
    WHERE 1 ${where} ${searchSql}`
  );
  const total = rows2[0].count;

  return {
    data: allCustomers,
    total,
  };
}

/**
 * Get one customer.
 */
async function getOne(id: number): Promise<ICustomer> {
  const [rows] = await pool.query<RowDataPacket[]>(
    // get customer details with practitioner name
    `SELECT customers.id, customers.client_code, customers.fore_name, customers.sur_name, customers.date_of_birth, customers
    .created_at, customers.gender, customers.address, customers.town, customers.country, customers.postal_code, customers.email, customers.telephone, customers.comments, customers.current_medication, customers.username, customers.password, customers.user_level, customers.status, customers.notifications, customers.notification_types, CONCAT(users.first_name, ' ', users.last_name) AS practitioner_name
    FROM customers
    LEFT JOIN users ON users.id = customers.created_by
    WHERE customers.id = ?`,
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  const customer = rows[0];
  return customer as ICustomer;
}
/**
 * Get by customer_id.
 */
async function getByUserId(
  userId: number,
  page: number = 1
): Promise<IGetResponse<ICustomer>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT customers.fore_name, customers.sur_name, customers.date_of_birth, customers.id, customers.created_at, customers.email, concat(users.first_name, ' ', users.last_name) as practitioner_name from customers left join users on users.id = customers.created_by WHERE customers.created_by = ? " +
      pagination,
    [userId]
  );
  const allCustomers = rows.map((customer) => {
    return customer as ICustomer;
  });
  return {
    data: allCustomers,
    total: await getTotalCount(
      pool,
      "customers",
      `WHERE customers.created_by = ${userId}`
    ),
  };
}

/**
 * Add one customer.
 */
async function addOne(customer: Record<string, any>): Promise<number> {
  const fore_name = customer["fore_name"] ? trim(customer["fore_name"]) : "";
  const sur_name = customer["sur_name"] ? trim(customer["sur_name"]) : "";
  const date_of_birth = customer["date_of_birth"]
    ? trim(customer["date_of_birth"])
    : "";
  const gender = customer["gender"] ? customer["gender"] : Gender.Male;
  const address = customer["address"] ? trim(customer["address"]) : "";
  const town = customer["town"] ? trim(customer["town"]) : "";
  const country = customer["country"] ? trim(customer["country"]) : "";
  const postal_code = customer["postal_code"]
    ? trim(customer["postal_code"])
    : "";
  const email = customer["email"] ? trim(customer["email"]) : "";
  const telephone = customer["telephone"] ? trim(customer["telephone"]) : "";
  const comments = customer["comments"] ? trim(customer["comments"]) : "";
  const created_by = customer["created_by"];
  const username = customer["username"] ? trim(customer["username"]) : "";
  const password = customer["password"] ? trim(customer["password"]) : "";
  const notification_types = customer["cus_notification_types"];
  const notifications = customer["mail_sent"] === "Yes" ? YesNo.Yes : YesNo.No;

  // Check if email already exists
  const [result] = await pool.query<RowDataPacket[]>(
    "SELECT email FROM users WHERE email = ?",
    [email]
  );
  const [result2] = await pool.query<RowDataPacket[]>(
    "SELECT email FROM customers WHERE email = ?",
    [email]
  );

  if (result.length > 0 || result2.length > 0) {
    throw new RouteError(HttpStatusCodes.CONFLICT, Errors.AlreadyExists);
  }

  if (password.length === 0) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Password cannot be empty!!"
    );
  }
  if (!(await AuthService.usernameAvailable(username))) {
    throw new RouteError(HttpStatusCodes.CONFLICT, "Username already exists");
  }
  const hash = AuthService.generateHash(password);

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
    password: hash,
    user_level: "Customer",
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

  if (notifications === YesNo.Yes)
    await MailService.sendCustomerRegistrationMail(
      fore_name,
      email,
      username,
      password,
      created_by
    );
  return id;
}

/**
 * Update one customer.
 */
async function updateOne(
  id: number,
  customer: Record<string, any>
): Promise<boolean> {
  let sql = "UPDATE customers SET ";
  const values = [];
  for (const key in customer) {
    let value = customer[key];
    if (key === "password" || key === "email") continue;
    if (key === "notification_types")
      value = Array.isArray(value) ? value.join(",") : "";
    sql += ` ${key}=?,`;
    values.push(value);
  }
  sql = sql.slice(0, -1);
  sql += " WHERE id = ?";
  values.push(id);

  const [result] = await pool.query<ResultSetHeader>(sql, values);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  return true;
}
/**
 * Delete a customer by their id.
 */
async function _delete(customerId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>("DELETE FROM customers WHERE id = ?", [
      customerId,
    ]);
  } catch (error) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Error deleting customer: " + error
    );
  }
}

async function sendLogins(
  password: string,
  customer_id: number
): Promise<boolean> {
  if (password.length === 0) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Password cannot be empty!!"
    );
  }
  const hash = AuthService.generateHash(password);
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE customers SET password = ? WHERE id = ?",
    [hash, customer_id]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM customers WHERE id = ?",
    [customer_id]
  );
  const customer = rows[0] as ICustomer;
  if (result.affectedRows > 0) {
    await MailService.sendCustomerLoginsMail(
      customer.fore_name,
      customer.email,
      customer.username,
      password,
      customer.created_by
    );
  }
  return true;
}
// **** Export default **** //

export default {
  getAll,
  getOne,
  getByUserId,
  addOne,
  updateOne,
  delete: _delete,
  sendLogins,
} as const;
