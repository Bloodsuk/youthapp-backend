import { Server, Socket } from "socket.io";
import { UserLevels } from "@src/constants/enums";
import { ISessionUser } from "@src/interfaces/ISessionUser";
import { RouteError } from "@src/other/classes";
import VisitChatService from "@src/services/VisitChatService";
import { getIO } from "./trackingSocket";

type ChatRole = "c" | "ph";

interface IChatMember {
  socketId: string;
  userId: number;
  role: ChatRole;
}

const chatRooms = new Map<number, Map<string, IChatMember>>();

function isCustomerLevel(userLevel: string | undefined): boolean {
  const level = (userLevel ?? "").trim().toLowerCase();
  return level === UserLevels.Customer.toLowerCase() || level === "patient";
}

function isPhlebotomistLevel(userLevel: string | undefined): boolean {
  const level = (userLevel ?? "").trim().toLowerCase();
  return (
    level === UserLevels.Phlebotomist.toLowerCase() ||
    level === "pleb" ||
    level === "phleb"
  );
}

function viewerRole(user: ISessionUser): ChatRole | null {
  if (isCustomerLevel(user.user_level)) return "c";
  if (isPhlebotomistLevel(user.user_level)) return "ph";
  return null;
}

function userInboxRoom(role: ChatRole, userId: number): string {
  return `visit_chat_user:${role}:${userId}`;
}

function orderChatRoom(orderId: number): string {
  return `visit_chat:${orderId}`;
}

function counterpartOnline(orderId: number, role: ChatRole): boolean {
  const room = chatRooms.get(orderId);
  if (!room) return false;
  const other: ChatRole = role === "c" ? "ph" : "c";
  for (const member of room.values()) {
    if (member.role === other) return true;
  }
  return false;
}

function emitChatError(socket: Socket, message: string): void {
  socket.emit("visit_chat_error", { message });
}

async function emitInboxSnapshot(socket: Socket, user: ISessionUser): Promise<void> {
  try {
    const orders = await VisitChatService.getUnreadSummary(user);
    const total_unread = orders.reduce((sum, o) => sum + o.unread_count, 0);
    socket.emit("visit_chat_inbox_snapshot", { orders, total_unread });
  } catch (error) {
    const message =
      error instanceof RouteError ? error.message : "Could not load inbox";
    emitChatError(socket, message);
  }
}

function joinUserInbox(socket: Socket, user: ISessionUser, role: ChatRole): void {
  socket.join(userInboxRoom(role, user.id));
}

function joinChatRoom(
  socket: Socket,
  user: ISessionUser,
  orderId: number,
  role: ChatRole
): void {
  if (!orderId) return;

  const roomName = orderChatRoom(orderId);
  socket.join(roomName);

  if (!chatRooms.has(orderId)) {
    chatRooms.set(orderId, new Map());
  }
  chatRooms.get(orderId)!.set(socket.id, {
    socketId: socket.id,
    userId: user.id,
    role,
  });

  socket.to(roomName).emit("visit_chat_presence", {
    order_id: orderId,
    role,
    online: true,
  });

  socket.emit("visit_chat_presence", {
    order_id: orderId,
    role: role === "c" ? "ph" : "c",
    online: counterpartOnline(orderId, role),
  });
}

function leaveChatRoom(socket: Socket, orderId: number): void {
  if (!orderId) return;

  const room = chatRooms.get(orderId);
  const member = room?.get(socket.id);
  room?.delete(socket.id);
  if (room && room.size === 0) {
    chatRooms.delete(orderId);
  }

  socket.leave(orderChatRoom(orderId));

  if (member) {
    socket.to(orderChatRoom(orderId)).emit("visit_chat_presence", {
      order_id: orderId,
      role: member.role,
      online: false,
    });
  }
}

function broadcastTyping(
  socket: Socket,
  orderId: number,
  role: ChatRole,
  typing: boolean
): void {
  if (!orderId) return;
  socket.to(orderChatRoom(orderId)).emit(
    typing ? "visit_chat_typing" : "visit_chat_stop_typing",
    { order_id: orderId, role }
  );
}

export function cleanupVisitChatSocket(socketId: string): void {
  for (const [orderId, members] of chatRooms.entries()) {
    if (members.has(socketId)) {
      const member = members.get(socketId)!;
      members.delete(socketId);
      if (members.size === 0) {
        chatRooms.delete(orderId);
      }
      getIO()
        .to(orderChatRoom(orderId))
        .emit("visit_chat_presence", {
          order_id: orderId,
          role: member.role,
          online: false,
        });
    }
  }
}

export function registerVisitChatHandlers(socket: Socket, user: ISessionUser): void {
  const role = viewerRole(user);
  if (!role) return;

  joinUserInbox(socket, user, role);
  void emitInboxSnapshot(socket, user);

  socket.on("visit_chat_sync_inbox", () => {
    void emitInboxSnapshot(socket, user);
  });

  socket.on("visit_chat_join", async (data: { order_id: number }) => {
    const orderId = Number(data?.order_id);
    if (!orderId) {
      emitChatError(socket, "order_id is required");
      return;
    }
    try {
      joinChatRoom(socket, user, orderId, role);
      const { messages, meta, markedReadIds } =
        await VisitChatService.getThread(user, orderId);
      socket.emit("visit_chat_thread", {
        order_id: orderId,
        messages,
        meta,
        total: messages.length,
      });
      if (markedReadIds.length > 0) {
        socket.to(orderChatRoom(orderId)).emit("visit_chat_read", {
          order_id: orderId,
          message_ids: markedReadIds,
        });
      }
      void emitInboxSnapshot(socket, user);
    } catch (error) {
      const message =
        error instanceof RouteError
          ? error.message
          : "Could not load chat thread";
      emitChatError(socket, message);
    }
  });

  socket.on("visit_chat_leave", (data: { order_id: number }) => {
    leaveChatRoom(socket, Number(data?.order_id));
  });

  socket.on(
    "visit_chat_send",
    async (data: { order_id: number; message: string }) => {
      const orderId = Number(data?.order_id);
      const text = String(data?.message ?? "").trim();
      if (!orderId) {
        emitChatError(socket, "order_id is required");
        return;
      }
      if (!text) {
        emitChatError(socket, "Message cannot be empty");
        return;
      }

      try {
        const { ctx, viewer } = await VisitChatService.assertAccess(user, orderId);
        const messageId = await VisitChatService.sendMessage(user, orderId, text);
        const { messages } = await VisitChatService.getThread(user, orderId);
        const saved =
          messages.find((m) => m.id === messageId) ?? messages[messages.length - 1];

        if (!saved) {
          emitChatError(socket, "Message sent but could not be loaded");
          return;
        }

        let isRead = saved.is_read;
        const io: Server = getIO();

        if (counterpartOnline(orderId, role)) {
          const marked = await VisitChatService.markMessagesReadByIds(
            orderId,
            viewer.counterpartId,
            viewer.counterpartRole,
            [messageId]
          );
          if (marked.length > 0) {
            isRead = true;
            io.to(orderChatRoom(orderId)).emit("visit_chat_read", {
              order_id: orderId,
              message_ids: marked,
            });
          }
        }

        socket.emit("visit_chat_send_ok", {
          order_id: orderId,
          message: { ...saved, is_read: isRead },
        });

        io.to(orderChatRoom(orderId)).except(socket.id).emit("visit_chat_message", {
          order_id: orderId,
          message: {
            id: saved.id,
            order_id: saved.order_id,
            job_id: saved.job_id,
            sent_from: saved.sent_from,
            sent_from_role: saved.sent_from_role,
            sent_to: saved.sent_to,
            sent_to_role: saved.sent_to_role,
            message: saved.message,
            is_read: isRead,
            created_at: saved.created_at,
          },
        });

        const recipientRole = viewer.counterpartRole;
        const recipientId = viewer.counterpartId;

        const recipientUser: ISessionUser = {
          id: recipientId,
          email: "",
          username: "",
          first_name: "",
          user_level:
            recipientRole === "ph"
              ? UserLevels.Phlebotomist
              : UserLevels.Customer,
        };

        const summary = await VisitChatService.getUnreadSummary(recipientUser);
        const inboxItem = summary.find((o) => o.order_id === orderId);

        io.to(userInboxRoom(recipientRole, recipientId)).emit("visit_chat_inbox", {
          order_id: orderId,
          unread_count: inboxItem?.unread_count ?? 0,
          last_message: saved.message,
          last_message_at: saved.created_at,
          job_id: ctx.jobId,
        });

        void emitInboxSnapshot(socket, user);
      } catch (error) {
        const message =
          error instanceof RouteError ? error.message : "Could not send message";
        emitChatError(socket, message);
      }
    }
  );

  socket.on("visit_chat_typing", (data: { order_id: number }) => {
    broadcastTyping(socket, Number(data?.order_id), role, true);
  });

  socket.on("visit_chat_stop_typing", (data: { order_id: number }) => {
    broadcastTyping(socket, Number(data?.order_id), role, false);
  });

  socket.on(
    "visit_chat_mark_read",
    async (data: { order_id: number; message_ids: number[] }) => {
      const orderId = Number(data?.order_id);
      const rawIds = Array.isArray(data?.message_ids) ? data.message_ids : [];
      const messageIds = rawIds.map(Number).filter((id) => id > 0);
      if (!orderId || messageIds.length === 0) return;

      try {
        const { viewer } = await VisitChatService.assertAccess(user, orderId);
        const marked = await VisitChatService.markMessagesReadByIds(
          orderId,
          viewer.viewerId,
          viewer.viewerRole,
          messageIds
        );
        if (marked.length > 0) {
          socket.to(orderChatRoom(orderId)).emit("visit_chat_read", {
            order_id: orderId,
            message_ids: marked,
          });
        }
      } catch (error) {
        const message =
          error instanceof RouteError ? error.message : "Could not mark read";
        emitChatError(socket, message);
      }
    }
  );
}

export function emitVisitChatNewMessage(_options: {
  orderId: number;
  messageId: number;
  sentToRole: ChatRole;
  sentToId: number;
}): void {
  // Chat delivery is socket-driven via visit_chat_send.
}
