/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IUser } from "@src/interfaces/IUser";
import { pool } from "@src/server";
import AuthService, { Errors } from "./AuthService";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { UserLevels } from "@src/constants/enums";
import { empty, getTotalCount } from "@src/util/misc";
import { LIMIT } from "@src/constants/pagination";
import MailService from "./MailService";

// **** Variables **** //

export const USER_NOT_FOUND_ERR = "User not found";

// **** Functions **** //

/**
 * Get all users.
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}
async function getAll(page: number = 1): Promise<IGetResponse<IUser>> {
  let where = "";
  // if (userId && userId > 1) {
  //   where = `AND practitioner_id=${userId} AND id !=${userId}`;
  // }
  where += " ORDER BY id DESC";
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;
  const sql = `SELECT * FROM users WHERE id > 1 ${where} ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const users = rows.map((user) => {
    return user as IUser;
  });

  return { data: users, total: await getTotalCount(pool, "users") };
}
async function getAllPractitioners(
  page: number = 1,
  search: string = ""
): Promise<IGetResponse<IUser>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  // Prepare the base SQL query
  let sql = `SELECT * FROM users WHERE user_level = 'Practitioner'`;

  // If there's a search term, add the search condition
  if (search && !empty(search)) {
    if (search.split(" ").length >= 2) {
      const [first_name, last_name] = search.split(" ");
      sql += ` AND (first_name LIKE '%${first_name}%' AND last_name LIKE '%${last_name}%')`;
    }
    else
      sql += ` AND (email LIKE '%${search}%' OR username LIKE '%${search}%' OR first_name LIKE '%${search}%' OR last_name LIKE '%${search}%')`;
  }

  sql += ` ORDER BY created_at DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allUsers = rows.map((user) => {
    return user as IUser;
  });

  // Prepare the base SQL query for total count
  let countSql = `SELECT COUNT(*) AS count FROM users WHERE user_level = 'Practitioner'`;

  // Add the same search condition for the count query
  if (search && !empty(search)) {
    if (search.split(" ").length >= 2) {
      const [first_name, last_name] = search.split(" ");
      countSql += ` AND (first_name LIKE '%${first_name}%' AND last_name LIKE '%${last_name}%')`;
    }
    else
      countSql += ` AND (email LIKE '%${search}%' OR username LIKE '%${search}%' OR first_name LIKE '%${search}%' OR last_name LIKE '%${search}%')`;
  }

  const [countRows] = await pool.query<RowDataPacket[]>(countSql);
  const total = countRows[0].count;

  return { data: allUsers, total };
}

/**
 * Get all clinics.
 */
async function getAllClinics(
  user_id: number,
  page: number = 1,
  search: string = ""
): Promise<IGetResponse<IUser>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  // Prepare the base SQL query
  let sql = `SELECT * FROM users WHERE user_level = 'Moderator'`;
  if (user_id) {
    sql += ` AND practitioner_id = ${user_id}`
  }
  // If there's a search term, add the search condition
  if (search && search.length > 0) {
    sql += ` AND (email LIKE '%${search}%' OR username LIKE '%${search}%' OR first_name LIKE '%${search}%' OR last_name LIKE '%${search}%')`;
  }

  sql += ` ORDER BY created_at DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allUsers = rows.map((user) => {
    return user as IUser;
  });

  // Prepare the base SQL query for total count
  let countSql = `SELECT COUNT(*) AS count FROM users WHERE user_level = 'Moderator' AND practitioner_id = ${user_id}`;

  // Add the same search condition for the count query
  if (search && search.length > 0) {
    countSql += ` AND (email LIKE '%${search}%' OR username LIKE '%${search}%' OR first_name LIKE '%${search}%' OR last_name LIKE '%${search}%')`;
  }

  const [countRows] = await pool.query<RowDataPacket[]>(countSql);
  const total = countRows[0].count;

  return { data: allUsers, total };
}

/**
 * Get one user.
 */
async function getOne(id: number): Promise<IUser> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  const user = rows[0];
  return user as IUser;
}

/**
 * Add one user.
 */
async function addOne(
  user: Record<string, any>,
  isAdmin: boolean = false,
  user_id: number
): Promise<number> {
  const {
    first_name,
    last_name,
    username,
    email,
    phone,
    password,
    confirm_password,
    notification_types,
    user_level,
    role_id
  } = user;

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

  if (!password || password != confirm_password) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Password not matched!!");
  }
  if (!(await AuthService.usernameAvailable(username as string))) {
    throw new RouteError(HttpStatusCodes.CONFLICT, "Username already exists");
  }
  const hash = AuthService.generateHash(password as string);

  let userLevel = UserLevels.Moderator as string;
  if (isAdmin) userLevel = user_level || (UserLevels.Practitioner as string);

  let notifTypes = "";
  if (
    isAdmin &&
    notification_types &&
    Array.isArray(notification_types) &&
    notification_types.length > 0
  ) {
    notifTypes = notification_types.join(",");
  }
  let data: any = {
    first_name,
    last_name,
    username,
    email,
    phone,
    password: hash,
    user_level: userLevel,
    notification_types: notifTypes,
    status: 1,
    is_verified: 1,
    practitioner_id: user_id,
  };
  if (role_id) {
    data = { ...data, role_id }
  }
  const [result3] = await pool.query<ResultSetHeader>(
    "INSERT INTO users SET ?",
    data
  );
  return result3.insertId;
}

/**
 * Update one user.
 */
async function updateOne(
  id: number,
  user: Record<string, any>
): Promise<boolean> {
  let sql = "UPDATE users SET ";
  const values = [];
  for (const key in user) {
    let value = user[key];
    if (key === "password") {
      if (typeof value === "string" && value?.length) {
        value = AuthService.generateHash(value);
        sql += ` ${key}=?,`;
        values.push(value);
      }
    } else if (key === "notification_types") {
      value = Array.isArray(value) ? value.join(",") : "";
      sql += ` ${key}=?,`;
      values.push(value);
    } else if (value) {
      sql += ` ${key}=?,`;
      values.push(value);
    }
  }
  sql = sql.slice(0, -1);
  sql += " WHERE id = ?";
  values.push(id);
  // if (!isAdmin)
  //   sql = `UPDATE users SET first_name = '${user.first_name}', last_name = '${user.last_name} WHERE id = ${id}`;
  const [result] = await pool.query<ResultSetHeader>(sql, values);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  // await MailService.sendProfileUpdateEmail(
  //   user.email as string,
  //   user.username as string
  // );
  return true;
}
/**
 * Update user's email.
 */
async function updateStatus(
  id: number,
  status: number,
  practitioner_id?: number
): Promise<boolean> {
  let where = "";
  if (practitioner_id) where = `AND practitioner_id=${practitioner_id}`;
  const sql = `UPDATE users set status=? where id=? ${where}`;
  // console.log("updateStatus", id, status, sql);

  const [result] = await pool.query<ResultSetHeader>(sql, [status, id]);
  // console.log("updateStatus", result);

  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  return true;
}

/**
 * Update user's email.
 */
async function updateEmail(id: number, email: string): Promise<boolean> {
  console.log("updateEmail", id, email);

  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE users SET email = ? WHERE id = ?",
    [email, id]
  );
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  return true;
}

/**
 * Update user's password.
 */
async function updatePassword(
  email: string,
  password: string
): Promise<boolean> {
  // Hash password
  const hash = AuthService.generateHash(password);

  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE users SET password = ? WHERE email = ?",
    [hash, email]
  );
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  return true;
}

async function getEmailFromForgotCode(code: string): Promise<string> { 
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT email FROM users WHERE forgot_code = ?",
    [code]
  );

  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }

  return rows[0].email;
}

async function updateForgotCode(email: string): Promise<string> { 
  // generate code of 4 digit from 0-9
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE users SET forgot_code = ? WHERE email = ?",
    [code, email]
  );

  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  
  await MailService.sendUserForgotCodeEmail(email, code);

  return code;
}

/**
 * Update many users.
 */
// async function updateMany(users: IUser[]): Promise<boolean> {
//   // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
//   const promises = users.map(async (user) => {
//     const pagesStr = JSON.stringify(user.pages || {});
//     try {
//       await pool.query<IUser>(
//         "UPDATE users SET first_name = $1, last_name = $2, email = $3, role = $4, pages = $5 WHERE id = $6",
//         [user.first_name, user.last_name, user.email, user.role, pagesStr, user.id]
//       );
//       return true;

//     } catch (error) {
//       return false;
//     }
//   } );
//   const results = await Promise.all(promises);
//   return results.every((result) => result===true);
// }

/**
 * Delete a user by their id.
 */
async function _delete(userId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>("DELETE FROM users WHERE id = ?", [
      userId,

    ]);
  } catch (error) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Error deleting user: " + error
    );
  }
}

// **** Export default **** //

export default {
  getAll,
  getAllPractitioners,
  getAllClinics,
  updateForgotCode,
  getOne,
  addOne,
  updateOne,
  updateStatus,
  updateEmail,
  updatePassword,
  getEmailFromForgotCode,
  // updateMany,
  delete: _delete,
} as const;
