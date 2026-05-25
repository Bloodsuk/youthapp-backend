import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import JwtHelper from "@src/util/JwtHelper";
import { ISessionUser } from "@src/interfaces/ISessionUser";
import { UserLevels } from "@src/constants/enums";
import PlebLiveLocationService, {
  coordsArePlausibleForTracking,
  isGpsTimestampFresh,
} from "@src/services/PlebLiveLocationService";

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

    if (isPhlebotomistLevel(user.user_level)) {
      registerPlebHandlers(socket, user);
      socket.emit("tracking_auth_ok", { role: "phlebotomist" });
    } else if (isCustomerLevel(user.user_level)) {
      registerCustomerHandlers(socket, user);
      socket.emit("tracking_auth_ok", { role: "customer" });
    } else {
      console.warn(
        `[Socket] No tracking handlers for user_level="${user.user_level}" (${user.email}). ` +
          `Customer tracking requires "Customer" (or "Patient"); phleb requires "Phlebotomist".`
      );
      socket.emit("error_msg", {
        message:
          "This account cannot use live tracking. Sign in as the patient (Customer) or phlebotomist app.",
        user_level: user.user_level ?? null,
        hint:
          !user.user_level || String(user.user_level).trim() === ""
            ? "Your login token is outdated. Log out, use Sign in as Phleb, then sign in again."
            : `Token role "${user.user_level}" is not valid for GPS. Phlebotomist app needs user_level Phlebotomist.`,
      });
    }

    socket.on("disconnect", () => {
      cleanupSubscriptions(socket.id);
      if (isPhlebotomistLevel(user.user_level)) {
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

        console.log(
          `[Socket] update_location pleb_id=${user.id} lat=${lat} lng=${lng} jobs=${results.map((r) => r.order_id).join(",")}`
        );

        // Broadcast only plausible GPS (socket-only path for customers).
        for (const result of results) {
          const orderId = result.order_id;
          const subscribers = orderSubscriptions.get(orderId);
          if (!subscribers || subscribers.size === 0) continue;

          const customerCoords = customerCoordinates.get(orderId);
          if (
            customerCoords &&
            !coordsArePlausibleForTracking(
              lat,
              lng,
              customerCoords.lat,
              customerCoords.lng
            )
          ) {
            console.warn(
              `[Socket] skip location_update broadcast order ${orderId} — phleb GPS not near customer device`
            );
            socket.emit("error_msg", {
              message:
                "Your GPS is too far from the patient (simulator default location?). Use a real device or set custom location in the simulator near the patient.",
            });
            continue;
          }

          if (result.distance_value === 0 && result.distance_text === "Unavailable") {
            console.warn(
              `[Socket] skip broadcast order ${orderId} — no valid distance yet`
            );
            continue;
          }

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

    // Optional snapshot: only fresh event-driven GPS (not old test coordinates in DB).
    try {
      const customerCoords = customerCoordinates.get(order_id);
      const current = await PlebLiveLocationService.getLiveLocationByOrder(
        order_id,
        customerCoords
      );
      if (current && isGpsTimestampFresh(current.updated_at)) {
        const skipStale =
          customerCoords != null &&
          !coordsArePlausibleForTracking(
            current.pleb_lat,
            current.pleb_lng,
            customerCoords.lat,
            customerCoords.lng
          );
        if (!skipStale) {
          console.log(
            `[Socket] track_job snapshot order_id=${order_id} pleb=${current.pleb_lat},${current.pleb_lng}`
          );
          socket.emit("location_update", current);
        }
      } else {
        console.log(
          `[Socket] track_job order_id=${order_id} — no fresh phleb GPS yet; waiting for update_location`
        );
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
  // Do not DELETE pleb_live_locations on brief mobile disconnects — that leaves
  // stale rows or empty snapshots while the phleb app is still sharing GPS.
  console.log(
    `[Socket] Phleb ${plebId} disconnected — keeping last GPS in DB until stop_tracking or job ends`
  );
}

/** Customers table may use "Customer" or "Patient" depending on environment. */
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

function cleanupSubscriptions(socketId: string): void {
  for (const [orderId, subscribers] of orderSubscriptions.entries()) {
    subscribers.delete(socketId);
    if (subscribers.size === 0) {
      orderSubscriptions.delete(orderId);
    }
  }
}
