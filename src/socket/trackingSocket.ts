import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import JwtHelper from "@src/util/JwtHelper";
import { ISessionUser } from "@src/interfaces/ISessionUser";
import { UserLevels } from "@src/constants/enums";
import PlebLiveLocationService from "@src/services/PlebLiveLocationService";

let io: Server;

// Maps order_id -> set of customer socket IDs subscribed to that order
const orderSubscriptions = new Map<number, Set<string>>();

// Maps order_id -> customer coordinates (stored in memory so it's always available)
const customerCoordinates = new Map<number, { lat: number; lng: number }>();

export function getIO(): Server {
  return io;
}

export function initTrackingSocket(httpServer: HttpServer): void {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error("Authentication token required"));
      }
      const decoded = await JwtHelper._decode<ISessionUser>(token as string);
      if (typeof decoded !== "object" || !decoded?.id) {
        return next(new Error("Invalid or expired token"));
      }
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as ISessionUser;
    console.log(
      `[Socket] Connected: ${user.email} (${user.user_level}) id=${socket.id}`
    );

    if (user.user_level === UserLevels.Phlebotomist) {
      registerPlebHandlers(socket, user);
    } else if (user.user_level === UserLevels.Customer) {
      registerCustomerHandlers(socket, user);
    }

    socket.on("disconnect", () => {
      cleanupSubscriptions(socket.id);
      if (user.user_level === UserLevels.Phlebotomist) {
        void handlePhlebDisconnect(user.id);
      }
      console.log(`[Socket] Disconnected: ${user.email} id=${socket.id}`);
    });
  });
}

function registerPlebHandlers(socket: Socket, user: ISessionUser): void {
  socket.on(
    "update_location",
    async (data: { job_id: number; lat: number; lng: number }) => {
      const { lat, lng } = data;
      if (lat == null || lng == null) {
        socket.emit("error_msg", { message: "lat, lng are required" });
        return;
      }

      try {
        // Update location for ALL active jobs of this phleb (not just the one specified)
        const results = await PlebLiveLocationService.upsertAllActiveJobs(
          user.id,
          lat,
          lng,
          customerCoordinates
        );

        if (results.length === 0) {
          console.warn(
            `[Socket] update_location: no active pleb_jobs for pleb_id=${user.id}`
          );
          socket.emit("error_msg", {
            message: "No active job found for this phlebotomist.",
          });
          return;
        }

        // Broadcast to all customers subscribed to any of this phleb's orders
        for (const result of results) {
          const subscribers = orderSubscriptions.get(result.order_id);
          if (subscribers && subscribers.size > 0) {
            const payload = {
              pleb_lat: lat,
              pleb_lng: lng,
              distance_text: result.distance_text,
              duration_text: result.duration_text,
              distance_value: result.distance_value,
              duration_value: result.duration_value,
              updated_at: result.updated_at,
            };
            for (const socketId of subscribers) {
              io.to(socketId).emit("location_update", payload);
            }
          }
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to update location";
        console.error("[Socket] update_location error:", message);
        socket.emit("error_msg", { message });
      }
    }
  );

  socket.on("stop_tracking", (data: { job_id: number }) => {
    if (data?.job_id) {
      PlebLiveLocationService.clearLocation(user.id, data.job_id).catch(
        (err) => console.error("[Socket] stop_tracking error:", err)
      );
    }
  });
}

function registerCustomerHandlers(socket: Socket, _user: ISessionUser): void {
  socket.on("track_job", async (data: { order_id: number; lat?: number; lng?: number }) => {
    const { order_id, lat, lng } = data;
    if (!order_id) {
      socket.emit("error_msg", { message: "order_id is required" });
      return;
    }

    // Store customer coordinates in memory (always available for distance calc)
    if (lat != null && lng != null) {
      customerCoordinates.set(order_id, { lat, lng });
      // Also persist to DB
      PlebLiveLocationService.saveCustomerCoordinates(order_id, lat, lng).catch(
        (err) => console.error("[Socket] save customer coords to DB error:", err)
      );
    }

    if (!orderSubscriptions.has(order_id)) {
      orderSubscriptions.set(order_id, new Set());
    }
    orderSubscriptions.get(order_id)!.add(socket.id);

    // Send current location immediately if available
    try {
      const current = await PlebLiveLocationService.getLiveLocationByOrder(
        order_id,
        customerCoordinates.get(order_id)
      );
      if (current) {
        socket.emit("location_update", current);
      }
    } catch (err) {
      console.error("[Socket] track_job initial fetch error:", err);
    }
  });

  socket.on("stop_tracking", (data: { order_id: number }) => {
    if (data?.order_id) {
      const subscribers = orderSubscriptions.get(data.order_id);
      if (subscribers) {
        subscribers.delete(socket.id);
        if (subscribers.size === 0) {
          orderSubscriptions.delete(data.order_id);
        }
      }
    }
  });
}

async function handlePhlebDisconnect(plebId: number): Promise<void> {
  try {
    const orderIds = await PlebLiveLocationService.clearAllLocationsForPleb(plebId);
    for (const orderId of orderIds) {
      const subscribers = orderSubscriptions.get(orderId);
      if (!subscribers || subscribers.size === 0) continue;
      const payload = {
        order_id: orderId,
        reason: "phlebotomist_offline",
      };
      for (const socketId of subscribers) {
        io.to(socketId).emit("tracking_ended", payload);
      }
    }
    console.log(
      `[Socket] Phleb ${plebId} disconnected — cleared live locations for orders: ${orderIds.join(", ") || "none"}`
    );
  } catch (err) {
    console.error("[Socket] handlePhlebDisconnect error:", err);
  }
}

function cleanupSubscriptions(socketId: string): void {
  for (const [orderId, subscribers] of orderSubscriptions.entries()) {
    subscribers.delete(socketId);
    if (subscribers.size === 0) {
      orderSubscriptions.delete(orderId);
    }
  }
}
