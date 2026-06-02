import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import { ISessionUser } from "@src/interfaces/ISessionUser";
import {
  IVisitChatMessage,
  IVisitChatThreadMeta,
  IVisitChatUnreadSummaryItem,
} from "@src/interfaces/IVisitChatMessage";
import { RouteError } from "@src/other/classes";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export const VISIT_CHAT_ORDER_NOT_FOUND = "Order not found";
export const VISIT_CHAT_FORBIDDEN = "You cannot access chat for this order";
export const VISIT_CHAT_NO_PHLEB =
  "No phlebotomist is assigned to this visit yet";
export const VISIT_CHAT_JOB_CLOSED =
  "This visit is closed. Chat is read-only.";

interface IOrderChatContext {
  orderId: number;
  customerId: number;
  plebId: number | null;
  jobId: number | null;
  jobStatus: string | null;
  customerName: string;
  plebName: string;
}

interface IViewerContext {
  viewerId: number;
  viewerRole: "c" | "ph";
  counterpartId: number;
  counterpartRole: "c" | "ph";
  counterpartName: string;
}

function normalizeLevel(level?: string): string {
  return (level ?? "").trim().toLowerCase();
}

function isCustomerLevel(level: string): boolean {
  return level === UserLevels.Customer.toLowerCase() || level === "patient";
}

function isPhlebLevel(level: string): boolean {
  return (
    level === UserLevels.Phlebotomist.toLowerCase() ||
    level === "pleb" ||
    level === "phleb"
  );
}

function isJobClosedForChat(jobStatus: string | null | undefined): boolean {
  const s = (jobStatus ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  return s === "delivered" || s === "completed" || s === "cancelled";
}

async function getOrderChatContext(
  orderId: number
): Promise<IOrderChatContext | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
        o.id AS order_id,
        o.customer_id,
        pj.id AS job_id,
        pj.pleb_id,
        pj.job_status,
        COALESCE(CONCAT(c.fore_name, ' ', c.sur_name), o.client_name, 'Patient') AS customer_name,
        COALESCE(pleb.full_name, 'Phlebotomist') AS pleb_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN pleb_jobs pj ON pj.order_id = o.id
      LEFT JOIN phlebotomy_applications pleb ON pleb.id = pj.pleb_id
      WHERE o.id = ?
      ORDER BY pj.id DESC
      LIMIT 1`,
    [orderId]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    orderId: Number(row.order_id),
    customerId: Number(row.customer_id),
    plebId: row.pleb_id != null ? Number(row.pleb_id) : null,
    jobId: row.job_id != null ? Number(row.job_id) : null,
    jobStatus: row.job_status != null ? String(row.job_status) : null,
    customerName: String(row.customer_name ?? "Patient"),
    plebName: String(row.pleb_name ?? "Phlebotomist"),
  };
}

function resolveViewer(
  sessionUser: ISessionUser,
  ctx: IOrderChatContext
): IViewerContext {
  const level = normalizeLevel(sessionUser.user_level);

  if (isCustomerLevel(level)) {
    if (Number(sessionUser.id) !== ctx.customerId) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, VISIT_CHAT_FORBIDDEN);
    }
    if (!ctx.plebId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, VISIT_CHAT_NO_PHLEB);
    }
    return {
      viewerId: ctx.customerId,
      viewerRole: "c",
      counterpartId: ctx.plebId,
      counterpartRole: "ph",
      counterpartName: ctx.plebName,
    };
  }

  if (isPhlebLevel(level)) {
    if (!ctx.plebId || Number(sessionUser.id) !== ctx.plebId) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, VISIT_CHAT_FORBIDDEN);
    }
    return {
      viewerId: ctx.plebId,
      viewerRole: "ph",
      counterpartId: ctx.customerId,
      counterpartRole: "c",
      counterpartName: ctx.customerName,
    };
  }

  throw new RouteError(HttpStatusCodes.FORBIDDEN, VISIT_CHAT_FORBIDDEN);
}

async function assertAccess(
  sessionUser: ISessionUser,
  orderId: number
): Promise<{ ctx: IOrderChatContext; viewer: IViewerContext }> {
  const ctx = await getOrderChatContext(orderId);
  if (!ctx) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, VISIT_CHAT_ORDER_NOT_FOUND);
  }
  const viewer = resolveViewer(sessionUser, ctx);
  return { ctx, viewer };
}

async function markThreadRead(
  orderId: number,
  viewerId: number,
  viewerRole: string
): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM visit_chat_messages
     WHERE order_id = ? AND sent_to = ? AND sent_to_role = ? AND is_read = 0`,
    [orderId, viewerId, viewerRole]
  );
  const ids = rows.map((row) => Number(row.id)).filter((id) => id > 0);
  if (ids.length === 0) return [];

  await pool.query<ResultSetHeader>(
    `UPDATE visit_chat_messages
     SET is_read = 1
     WHERE id IN (?)`,
    [ids]
  );
  return ids;
}

async function markMessagesReadByIds(
  orderId: number,
  viewerId: number,
  viewerRole: string,
  messageIds: number[]
): Promise<number[]> {
  const ids = messageIds.filter((id) => id > 0);
  if (ids.length === 0) return [];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM visit_chat_messages
     WHERE order_id = ?
       AND id IN (?)
       AND sent_to = ?
       AND sent_to_role = ?
       AND is_read = 0`,
    [orderId, ids, viewerId, viewerRole]
  );
  const marked = rows.map((row) => Number(row.id)).filter((id) => id > 0);
  if (marked.length === 0) return [];

  await pool.query<ResultSetHeader>(
    `UPDATE visit_chat_messages SET is_read = 1 WHERE id IN (?)`,
    [marked]
  );
  return marked;
}

async function getThread(
  sessionUser: ISessionUser,
  orderId: number
): Promise<{
  messages: IVisitChatMessage[];
  meta: IVisitChatThreadMeta;
  markedReadIds: number[];
}> {
  const { ctx, viewer } = await assertAccess(sessionUser, orderId);

  const markedReadIds = await markThreadRead(
    orderId,
    viewer.viewerId,
    viewer.viewerRole
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
        m.id,
        m.order_id,
        m.job_id,
        m.sent_from,
        m.sent_from_role,
        m.sent_to,
        m.sent_to_role,
        m.message,
        m.is_read,
        m.created_at,
        CASE
          WHEN m.sent_from = ? AND m.sent_from_role = ? THEN 'You'
          WHEN m.sent_from_role = 'ph' THEN ?
          ELSE ?
        END AS display_name
      FROM visit_chat_messages m
      WHERE m.order_id = ?
      ORDER BY m.created_at ASC`,
    [
      viewer.viewerId,
      viewer.viewerRole,
      ctx.plebName,
      ctx.customerName,
      orderId,
    ]
  );

  const [unreadRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS unread_count
     FROM visit_chat_messages
     WHERE order_id = ? AND sent_to = ? AND sent_to_role = ? AND is_read = 0`,
    [orderId, viewer.viewerId, viewer.viewerRole]
  );

  const messages = rows.map((row) => row as IVisitChatMessage);
  const meta: IVisitChatThreadMeta = {
    order_id: ctx.orderId,
    job_id: ctx.jobId,
    customer_id: ctx.customerId,
    pleb_id: ctx.plebId,
    counterpart_name: viewer.counterpartName,
    unread_count: Number(unreadRows[0]?.unread_count ?? 0),
    job_status: ctx.jobStatus,
    can_send: !isJobClosedForChat(ctx.jobStatus),
  };

  return { messages, meta, markedReadIds };
}

async function getUnreadCount(
  sessionUser: ISessionUser,
  orderId: number
): Promise<number> {
  const { viewer } = await assertAccess(sessionUser, orderId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS unread_count
     FROM visit_chat_messages
     WHERE order_id = ? AND sent_to = ? AND sent_to_role = ? AND is_read = 0`,
    [orderId, viewer.viewerId, viewer.viewerRole]
  );
  return Number(rows[0]?.unread_count ?? 0);
}

async function sendMessage(
  sessionUser: ISessionUser,
  orderId: number,
  body: string
): Promise<number> {
  const text = body?.trim();
  if (!text) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Message cannot be empty");
  }

  const { ctx, viewer } = await assertAccess(sessionUser, orderId);

  if (isJobClosedForChat(ctx.jobStatus)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, VISIT_CHAT_JOB_CLOSED);
  }

  const data = {
    order_id: orderId,
    job_id: ctx.jobId,
    sent_from: viewer.viewerId,
    sent_to: viewer.counterpartId,
    sent_from_role: viewer.viewerRole,
    sent_to_role: viewer.counterpartRole,
    message: text,
  };

  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO visit_chat_messages SET ?",
    data
  );
  const messageId = result.insertId;
  return messageId;
}

async function getUnreadSummary(
  sessionUser: ISessionUser
): Promise<IVisitChatUnreadSummaryItem[]> {
  const level = normalizeLevel(sessionUser.user_level);

  if (isCustomerLevel(level)) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
          m.order_id,
          pj.id AS job_id,
          COUNT(*) AS unread_count,
          (
            SELECT vm.message
            FROM visit_chat_messages vm
            WHERE vm.order_id = m.order_id
            ORDER BY vm.created_at DESC
            LIMIT 1
          ) AS last_message,
          MAX(m.created_at) AS last_message_at
        FROM visit_chat_messages m
        INNER JOIN orders o ON o.id = m.order_id AND o.customer_id = ?
        LEFT JOIN pleb_jobs pj ON pj.order_id = m.order_id
        WHERE m.sent_to = ? AND m.sent_to_role = 'c' AND m.is_read = 0
        GROUP BY m.order_id, pj.id
        ORDER BY last_message_at DESC`,
      [sessionUser.id, sessionUser.id]
    );
    return rows.map((row) => ({
      order_id: Number(row.order_id),
      job_id: row.job_id != null ? Number(row.job_id) : null,
      unread_count: Number(row.unread_count),
      last_message: row.last_message != null ? String(row.last_message) : null,
      last_message_at:
        row.last_message_at != null ? String(row.last_message_at) : null,
    }));
  }

  if (isPhlebLevel(level)) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
          m.order_id,
          pj.id AS job_id,
          COUNT(*) AS unread_count,
          (
            SELECT vm.message
            FROM visit_chat_messages vm
            WHERE vm.order_id = m.order_id
            ORDER BY vm.created_at DESC
            LIMIT 1
          ) AS last_message,
          MAX(m.created_at) AS last_message_at
        FROM visit_chat_messages m
        INNER JOIN pleb_jobs pj ON pj.order_id = m.order_id AND pj.pleb_id = ?
        WHERE m.sent_to = ? AND m.sent_to_role = 'ph' AND m.is_read = 0
        GROUP BY m.order_id, pj.id
        ORDER BY last_message_at DESC`,
      [sessionUser.id, sessionUser.id]
    );
    return rows.map((row) => ({
      order_id: Number(row.order_id),
      job_id: row.job_id != null ? Number(row.job_id) : null,
      unread_count: Number(row.unread_count),
      last_message: row.last_message != null ? String(row.last_message) : null,
      last_message_at:
        row.last_message_at != null ? String(row.last_message_at) : null,
    }));
  }

  return [];
}

export default {
  getThread,
  getUnreadCount,
  getUnreadSummary,
  sendMessage,
  assertAccess,
  markMessagesReadByIds,
} as const;
