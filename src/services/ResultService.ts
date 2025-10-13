import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IResult } from "@src/interfaces/IResult";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { empty } from "@src/util/misc";
import { UserLevels } from "@src/constants/enums";
import { ISessionUser } from "@src/interfaces/ISessionUser";
import { LIMIT } from "@src/constants/pagination";
import moment from "moment";
import path from "path";
import fs from "fs";
import pdf from "pdf-parse";

// **** Variables **** //

export const NOT_FOUND_ERR = "Result not found";

// **** Functions **** //

/**
 * Get all results.
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}

async function getAll(
  sessionUser: ISessionUser | undefined,
  page: number = 1,
  search?: string,
  status?: string,
  shipping?: string,
  report?: string,
  billing?: string,
  showAll: boolean = false,
  reportThisWeek: boolean = false
): Promise<IGetResponse<IResult>> {
  const user_id = sessionUser?.id;
  const user_level = sessionUser?.user_level;
  const practitioner_id = sessionUser?.practitioner_id;
  const whereClauses = ["1"];
  const params: any[] = [];

  if (user_id && user_id > 1) {
    if (user_level === UserLevels.Moderator) {
      whereClauses.push("orders.created_by = ?");
      params.push(practitioner_id);
    } else if (user_level === UserLevels.Customer) {
      whereClauses.push("orders.customer_id = ?");
      params.push(user_id);
    } else if (user_level === UserLevels.Practitioner) {
      whereClauses.push(
        "(orders.created_by = ? OR orders.practitioner_id = ?)"
      );
      params.push(user_id, user_id);
    } else {
      whereClauses.push("orders.created_by = ?");
      params.push(user_id);
    }
  }

  if (status && !empty(status)) {
    if (status === "Results Published" || status === "Result Published") {
      whereClauses.push("orders.status IN ('Results Published', 'Result Published')");
    } else if (status === "Received at the Lab" || status === "Received at Lab") {
      whereClauses.push("orders.status IN ('Received at Lab', 'Received at the Lab')");
    } else {
      whereClauses.push("orders.status = ?");
      params.push(status);
    }
  } else {
    whereClauses.push("orders.status != 'Failed'");
  }

  if (shipping && !empty(shipping)) {
    whereClauses.push("orders.shipping_type = ?");
    params.push(shipping);
  }

  if (report && !empty(report)) {
    if (report === "Uploaded") {
      whereClauses.push("orders.attachment IS NOT NULL");
    } else {
      whereClauses.push("orders.attachment IS NULL");
    }
  }

  if (billing && !empty(billing)) {
    whereClauses.push("orders.checkout_type = ?");
    params.push(billing);
  }

  if (search && !empty(search)) {
    whereClauses.push("client_name LIKE ?");
    params.push(`%${search}%`);
  }

  const last_week = moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss');
  if (reportThisWeek) {
    whereClauses.push("orders.created_at >= ?");
    params.push(last_week);
  }

  const pagination = showAll
    ? ""
    : `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  const sql = `
    SELECT 
      orders.*, 
      CONCAT(users.first_name, ' ', users.last_name) AS practitioner_name,
      users.email AS practitioner_email,
      GROUP_CONCAT(tests.test_name SEPARATOR ', ') AS tests,
      customers.date_of_birth,
      customers.email AS customer_email
    FROM orders 
    LEFT JOIN users ON orders.created_by = users.id
    LEFT JOIN tests ON FIND_IN_SET(tests.id, orders.test_ids)
    LEFT JOIN customers ON orders.customer_id = customers.id
    WHERE ${whereClauses.join(" AND ")} 
    GROUP BY orders.id
    ORDER BY orders.id DESC 
    ${pagination}
  `;
  console.log(sql);
  console.log(params);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  const allResults = rows.map((result) => {
    return {
      ...result,
      test_ids: result.test_ids,
      practitioner_name: result.practitioner_name,
      tests: result.tests,
      date_of_birth: result.date_of_birth,
    } as IResult;
  });
  console.log(rows[0], "rows");

  const totalSql = `
    SELECT COUNT(*) as count
    FROM orders 
    WHERE ${whereClauses.join(" AND ")}
  `;
  const [totalResult] = await pool.query<RowDataPacket[]>(totalSql, params);
  const total = totalResult[0].count;

  return {
    data: allResults,
    total,
  };
}

/**
 * Get one result.
 */
async function getOne(id: number): Promise<IResult> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM orders WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  const result = rows[0] as IResult;
  return result;
}

/**
 * Extract PDF text from an order's attachment located in the public folder.
 */
async function extractPdfTextByOrderId(id: number, customerId: number): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT attachment FROM orders WHERE id = ? AND customer_id = ?",
    [id, customerId]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  const attachment = (rows[0] as RowDataPacket).attachment as string | null;
  if (!attachment || attachment.trim() === "") {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      "No attachment found for this order"
    );
  }

  // Resolve path to the public directory similar to server.ts
  const rootDir = path.resolve(__dirname, "..", "..");
  const staticDir = path.join(rootDir, "public");

  // Normalize attachment to be relative to public directory
  let relativePath = attachment.trim();
  if (/^https?:\/\//i.test(relativePath)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Attachment is a remote URL; expected local public file"
    );
  }
  relativePath = relativePath.replace(/^\/+/, "");
  relativePath = relativePath.replace(/^public[\\/]/, "");

  const filePath = path.join(staticDir, relativePath);

  try {
    const buffer = await fs.promises.readFile(filePath);
    const result = await pdf(buffer);
    return (result as any).text || "";
  } catch (err) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to read or parse PDF: " + err
    );
  }
}

/**
 * Delete a order by their id.
 */
async function _delete(id: number, type: string): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      `UPDATE orders set ${type}=null WHERE id = ?`,
      [id]
    );
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting order: " + error);
  }
}



// **** Export default **** //

export default {
  getAll,
  getOne,
  extractPdfTextByOrderId,
  delete: _delete,
} as const;
