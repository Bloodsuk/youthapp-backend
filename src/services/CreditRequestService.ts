import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { ICreditRequest } from "@src/interfaces/ICreditRequest";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { LIMIT } from "@src/constants/pagination";
import { getTotalCount } from "@src/util/misc";
import { IUser } from "@src/interfaces/IUser";

// **** Variables **** //

export const NOT_FOUND_ERR = "Credit Request not found";

// **** Functions **** //
interface IGetResponse<T> {
  data: T[];
  total: number;
}

/**
 * Get all creditRequests.
 */
async function getAll(page = 1): Promise<IGetResponse<ICreditRequest>> {

  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT credit_requests.*, CONCAT(users.first_name,' ',users.last_name) as practitioner_name 
    FROM credit_requests 
    LEFT JOIN users ON credit_requests.user_id = users.id 
    ORDER BY id DESC ${pagination}`
  );
  const allCreditRequests = rows.map((creditRequest) => {
    return creditRequest as ICreditRequest;
  });
  const total = await getTotalCount(pool, "credit_requests", '');
  return { data: allCreditRequests, total };
}

/**
 * Get all creditRequests by user_id
 */
async function getByUserId(user_id: number, page=1): Promise<IGetResponse<ICreditRequest>> {
    const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT credit_requests.*, CONCAT(users.first_name,' ',users.last_name) as practitioner_name 
    FROM credit_requests 
    LEFT JOIN users ON credit_requests.user_id = users.id 
    WHERE credit_requests.user_id = ?
    ORDER BY id DESC ${pagination}`, [user_id]
  );
  const allCreditRequests = rows.map((creditRequest) => {
    return creditRequest as ICreditRequest;
  });
  const total = await getTotalCount(
    pool,
    "credit_requests",
    `WHERE credit_requests.user_id = ${user_id}`
  );
  return { data: allCreditRequests, total };
}
/**
 * Get pending creditRequests
 */
async function getPending(page = 1): Promise<IGetResponse<ICreditRequest>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT credit_requests.*, CONCAT(users.first_name,' ',users.last_name) as practitioner_name 
    FROM credit_requests 
    LEFT JOIN users ON credit_requests.user_id = users.id 
    WHERE credit_requests.status = ?
    ORDER BY id DESC ${pagination}`,
    ["Pending"]
  );
  const allCreditRequests = rows.map((creditRequest) => {
    return creditRequest as ICreditRequest;
  });
  const total = await getTotalCount(pool, "credit_requests", "WHERE status = 'Pending'");
  return { data: allCreditRequests, total };
}

/**
 * Get approved creditRequests
 */
async function getApproved(page = 1): Promise<IGetResponse<ICreditRequest>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT credit_requests.*, CONCAT(users.first_name,' ',users.last_name) as practitioner_name 
    FROM credit_requests 
    LEFT JOIN users ON credit_requests.user_id = users.id 
    WHERE credit_requests.status = ?
    ORDER BY id DESC ${pagination}`,
    ["Approved"]
  );
  const allCreditRequests = rows.map((creditRequest) => {
    return creditRequest as ICreditRequest;
  });
  const total = await getTotalCount(pool, "credit_requests", "WHERE status = 'Approved'");
  return { data: allCreditRequests, total };
}

/**
 * Get Users Balances
 */
interface IUserBalance {
  user_id: number;
  name: string;
  total_credit: number;
  total_paid: number;
  total_pending: number;
  balance: number;
}

async function getUsersBalances(page = 1): Promise<IGetResponse<IUserBalance>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * from users WHERE id > 1 ${pagination}`
  );
  const userBalances: IUserBalance[] = [];
  for (const row of rows) {
    const user = row as IUser;
    console.log(user.id);
    if (!user.id) continue;
    const [totalcr_rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(credit_amount) AS total_credit from credit_requests WHERE user_id = ?",
      [user.id]
    );
    const [total_paid_rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(total_val) AS total_paid from orders WHERE created_by = ? AND payment_status = 'Paid'",
      [user.id]
    );
    const [total_pending_rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(total_val) AS pending_paid from orders WHERE created_by = ? AND payment_status = 'Pending'",
      [user.id]
    );
    const userBalance: IUserBalance = {
      user_id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      total_credit: totalcr_rows[0].total_credit || 0,
      total_paid: total_paid_rows[0].total_paid || 0,
      total_pending: total_pending_rows[0].pending_paid || 0,
      balance: (totalcr_rows[0].total_credit || 0) - (total_pending_rows[0].pending_paid || 0)
    };
    userBalances.push(userBalance);
  }
    const total = await getTotalCount(pool, "users", "WHERE id > 1");

  return { data: userBalances, total };
}

/**
 * Get one creditRequest.
 */
async function getOne(id: number): Promise<ICreditRequest> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM credit_requests WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  const creditRequest = rows[0];
  return creditRequest as ICreditRequest;
}

/**
 * Add one creditRequest.
 */
async function addOne(creditRequest: Partial<ICreditRequest>): Promise<number> {
  const data = {
    user_id: creditRequest.user_id,
    credit_amount: creditRequest.credit_amount || 0,
    remarks: creditRequest.remarks || "",
  };
  if(!creditRequest.user_id)
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "user_id is required");
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO credit_requests SET ?",
    data
  );
  return result.insertId;
}

/**
 * Update one creditRequest
 */
async function updateOne(
  id: number, 
  credit_request: Record<string, any>
): Promise<boolean> {
  let sql = "UPDATE credit_requests SET ";
  const values = [];
  for (const key in credit_request) {
    const value = credit_request[key];
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
 * Update one creditRequest status
 */
async function updateStatus(
  id: number,
  status: string
): Promise<boolean> {
  const sql = "UPDATE credit_requests SET status = ? WHERE id = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [ status, id ]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  return true;
}
/**
 * Delete a creditRequest by their id.
 */
async function _delete(creditRequestId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      "DELETE FROM credit_requests WHERE id = ?",
      [creditRequestId]
    );
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting creditRequest: "+error);
  }
}

// **** Export default **** //

export default {
  getAll,
  getByUserId,
  getPending,
  getApproved,
  getUsersBalances,
  getOne,
  addOne,
  updateOne,
  updateStatus,
  delete: _delete,
} as const;
