import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { ICustomerPracMessage, IMessage, IUnreadMessageCount } from "@src/interfaces/IMessage";
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
  let sql = `SELECT * FROM messages WHERE 1`;
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
 * INFO: Get messages for customer
 * @param customer_id 
 * @param practitioner_id 
 * @returns 
 */
async function getCustomerMessages(
  customer_id: number,
  practitioner_id: number,
): Promise<IGetResponse<IMessage>> {
  let sql = "UPDATE messages set is_read = 1 WHERE sent_to = ? AND sent_from = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [customer_id, practitioner_id]);
  sql = `SELECT 
        m.*, 
        IF(m.sent_from_role = 'p', CONCAT(u.first_name, ' ', u.last_name), 'You') AS display_name 
    FROM 
        messages m
        LEFT JOIN users u ON u.id = m.sent_from AND m.sent_from_role = 'p'
    WHERE 
        (m.sent_from = ? OR m.sent_to = ?) 
        AND 
        (m.sent_from = ? OR m.sent_to = ?)
    ORDER BY 
        m.created_at DESC;`;

  const [rows] = await pool.query<RowDataPacket[]>(sql, [customer_id, customer_id, practitioner_id, practitioner_id]);
  const allMessages = rows.map((message) => {
    return message as IMessage;
  });
  const total = await getTotalCount(pool, 'messages', `WHERE (sent_from = ${customer_id} OR sent_to = ${customer_id}) AND (sent_from = ${practitioner_id} OR sent_to = ${practitioner_id})`);
  return { data: allMessages, total };
}

/**
 * INFO: Get messages for practitioner
 * @param customer_id 
 * @param practitioner_id 
 * @returns 
 */
async function getPractitionerMessages(
  customer_id: number,
  practitioner_id: number,
): Promise<IGetResponse<IMessage>> {
  let sql = "UPDATE messages set is_read = 1 WHERE sent_to = ? AND sent_from = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [practitioner_id, customer_id]);
  sql = `SELECT m.*, if(m.sent_from_role = 'c', concat(u.first_name, ' ', u.last_name), 'You') as display_name from messages m
  LEFT JOIN users u ON u.id = m.sent_from And m.sent_from_role = 'c'
  where (m.sent_from = ? OR m.sent_to = ?) AND (m.sent_from = ? OR m.sent_to = ?)
  ORDER BY m.created_at DESC`;

  const [rows] = await pool.query<RowDataPacket[]>(sql, [customer_id, customer_id, practitioner_id, practitioner_id]);
  const allMessages = rows.map((message) => {
    return message as IMessage;
  });
  const total = await getTotalCount(pool, 'messages', `WHERE (sent_from = ${customer_id} OR sent_to = ${customer_id}) AND (sent_from = ${practitioner_id} OR sent_to = ${practitioner_id})`);
  return { data: allMessages, total };
}

/**
 * INFO: Check if customer has unread messages
 * @param customer_id 
 * @param practitioner_id 
 * @returns 
 */
async function customerHasMessages(
  customer_id: number,
  practitioner_id: number,
): Promise<IUnreadMessageCount> {
  const sql = "SELECT id FROM messages WHERE sent_to = ? AND sent_from = ? AND is_read = 0";
  const [rows] = await pool.query<RowDataPacket[]>(sql, [customer_id, practitioner_id]);
  let unread_count = 0
  if (rows.length) {
    unread_count = rows.length
  }
  return { unread_count };
}

/**
 * INFO: Check if practitioner has even 1 unread message to show notificatoin on top bar
 * @param practitioner_id 
 * @returns 
 */
async function practitionerHasMessages(practitioner_id: number): Promise<IUnreadMessageCount> {
  const sql = "SELECT id FROM messages WHERE sent_to = ? AND is_read = 0";
  const [rows] = await pool.query<RowDataPacket[]>(sql, [practitioner_id]);
  let unread_count = 0
  if (rows.length) {
    unread_count = rows.length
  }
  return { unread_count };
}

/**
 * INFO: Check if practitioner has unread messages against each customers list
 * @param practitioner_id 
 * @returns 
 */
async function practitionerHasMessagesByCustomer(
  practitioner_id: number,
): Promise<IGetResponse<ICustomerPracMessage>> {
  let sql = `SELECT id FROM customers`;
  let [rows] = await pool.query<RowDataPacket[]>(sql, [practitioner_id]);
  const customerIds = rows?.map(el => el.id);
  sql = `SELECT sent_from as sent_by_customer_id, 'unread' as message_type FROM messages WHERE sent_to = ? AND sent_from IN (?) AND is_read = 0`;
  [rows] = await pool.query<RowDataPacket[]>(sql, [practitioner_id, customerIds]);
  const allMessages = rows.map((message) => {
    return message as ICustomerPracMessage;
  });
  return { data: allMessages, total: allMessages.length };
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
    sent_from: message.sent_from,
    sent_to: message.sent_to,
    sent_from_role: message.sent_from_role,
    sent_to_role: message.sent_to_role,
    message: message.message,
  }
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
    await pool.query<ResultSetHeader>("DELETE FROM messages WHERE id = ?", [messageId]);
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting message: " + error);
  }
}

export default {
  getAll,
  getOne,
  getCustomerMessages,
  getPractitionerMessages,
  customerHasMessages,
  practitionerHasMessages,
  practitionerHasMessagesByCustomer,
  addOne,
  updateOne,
  markRead,
  delete: _delete,
} as const;
