import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IMessage } from "@src/interfaces/IMessage";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { LIMIT } from "@src/constants/pagination";
import { empty, getTotalCount } from "@src/util/misc";
export const MESSAGE_NOT_FOUND_ERR = "Message not found!";

/**
 * INFO: response interface
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}

/**
 * INFO: Get all messages
 * @param page 
 * @param search 
 * @returns 
 */
async function getAll(
  page: number = 1,
  search?: string
): Promise<IGetResponse<IMessage>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;
  let sql = `SELECT * FROM messages WHERE is_deleted = 0`;
  let searchSql = "";
  if (search && !empty(search)) {
    searchSql += ` AND message LIKE '%${search}%'`;
    sql += searchSql;
  }

  sql += ` ORDER BY created_at DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allMessages = rows.map((message) => {
    return message as IMessage;
  });
  const total = await getTotalCount(pool, 'messages', `WHERE 1 ${searchSql}`);
  return { data: allMessages, total };
}

/**
 * INFO: Get particular message by Id
 * @param id 
 * @returns 
 */
async function getOne(id: number): Promise<IMessage> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM messages WHERE id = ?", [id]);
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, MESSAGE_NOT_FOUND_ERR);
  }
  const message = rows[0];
  return message as IMessage;
}

/**
 * INFO: Save the sent message
 * @param message 
 * @returns 
 */
async function addOne(message: Record<string, any>): Promise<number> {
  const data = {
    practitioner_id: message.practitioner_id,
    customer_id: message.customer_id,
    message: message.message,
    is_deleted: message.is_deleted ?? false,
    is_read: message.is_read ?? false
  };
  
  const [result3] = await pool.query<ResultSetHeader>("INSERT INTO messages SET ?", data);
  return result3.insertId;
}

/**
 * INFO: Update message by id
 * @param id 
 * @param message 
 * @returns 
 */
async function updateOne(
  id: number,
  message: Record<string, any>
): Promise<boolean> {
  const sql = "UPDATE messages SET message = ? WHERE id = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [message.message, id]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, MESSAGE_NOT_FOUND_ERR);
  }
  return true;
}

/**
 * INFO: Mark messages as read
 * @param message 
 * @returns 
 */
async function markRead(
  message: Record<string, any>
): Promise<boolean> {
  const obj = {
    is_read: message.is_read,
    message_ids: message.message_ids, // comma separate ids
  }
  const ids = message.message_ids?.toString()?.split(',')
  const sql = "UPDATE messages SET is_read = ? WHERE id IN (?)";
  const [result] = await pool.query<ResultSetHeader>(sql, [message.is_read, ids]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, MESSAGE_NOT_FOUND_ERR);
  }
  return true;
}

/**
 * INFO: Delete message by id
 * @param messageId 
 */
async function _delete(messageId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>("UPDATE messages SET is_deleted = 1 WHERE id = ?", [messageId]);
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting message: " + error);
  }
}

export default {
  getAll,
  getOne,
  addOne,
  updateOne,
  markRead,
  delete: _delete,
} as const;
