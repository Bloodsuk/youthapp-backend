import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import fetch from "node-fetch";

interface IDistanceResult {
  distance_text: string;
  distance_value: number;
  duration_text: string;
  duration_value: number;
}

interface ILocationUpdate extends IDistanceResult {
  order_id: number;
  updated_at: string;
}

interface ILiveLocationResponse {
  pleb_lat: number;
  pleb_lng: number;
  distance_text: string;
  duration_text: string;
  distance_value: number;
  duration_value: number;
  updated_at: string;
}

// In-memory cache to avoid excessive Google Maps API calls
const distanceCache = new Map<
  string,
  { lat: number; lng: number; result: IDistanceResult; timestamp: number }
>();

const MOVEMENT_THRESHOLD_METERS = 100;
const CACHE_TTL_MS = 30_000; // 30 seconds
/** Reject stale/test GPS in another region when customer sent live coords. */
export const MAX_PLAUSIBLE_SEPARATION_METERS = 100_000;
/** Only serve GPS written by a recent phleb `update_location` event (not old DB rows). */
export const FRESH_GPS_MAX_AGE_MS = 3 * 60 * 1000;

interface ILivePhlebSnapshot {
  plebLat: number;
  plebLng: number;
  updatedAtMs: number;
}

/** Latest phleb GPS per order from socket events (source of truth while server is up). */
const livePhlebByOrder = new Map<number, ILivePhlebSnapshot>();

export function isGpsTimestampFresh(updatedAt: unknown): boolean {
  if (updatedAt == null) return false;
  const ms = new Date(updatedAt as string | Date).getTime();
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= FRESH_GPS_MAX_AGE_MS;
}

/** Called on every successful phleb `update_location` — never read stale DB over this. */
export function recordLivePhlebGps(orderId: number, lat: number, lng: number): void {
  livePhlebByOrder.set(orderId, {
    plebLat: lat,
    plebLng: lng,
    updatedAtMs: Date.now(),
  });
}

function getSessionPhlebGps(
  orderId: number
): { lat: number; lng: number; updatedAtMs: number } | null {
  const snap = livePhlebByOrder.get(orderId);
  if (!snap) return null;
  if (Date.now() - snap.updatedAtMs > FRESH_GPS_MAX_AGE_MS) return null;
  return {
    lat: snap.plebLat,
    lng: snap.plebLng,
    updatedAtMs: snap.updatedAtMs,
  };
}

export function coordsArePlausibleForTracking(
  plebLat: number,
  plebLng: number,
  custLat?: number | null,
  custLng?: number | null
): boolean {
  if (custLat == null || custLng == null) return true;
  return (
    haversineDistance(plebLat, plebLng, custLat, custLng) <=
    MAX_PLAUSIBLE_SEPARATION_METERS
  );
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance using lat/lng on both sides.
 */
async function calculateDistanceByCoords(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<IDistanceResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Google Maps API key not configured");
  }

  const origins = encodeURIComponent(`${originLat},${originLng}`);
  const destinations = encodeURIComponent(`${destLat},${destLng}`);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&units=metric&key=${apiKey}`;

  console.log("[LiveDistance] Calling Google Maps:", { originLat, originLng, destLat, destLng });

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error("Google Maps API request failed");
  }

  const data = (await resp.json()) as {
    status: string;
    rows?: { elements?: { status: string; distance?: { text: string; value: number }; duration?: { text: string; value: number } }[] }[];
  };

  if (data.status !== "OK") {
    throw new Error(`Google Maps API error: ${data.status}`);
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    throw new Error(
      `Distance calculation failed: ${element?.status || "no data"}`
    );
  }

  return {
    distance_text: element.distance!.text,
    distance_value: element.distance!.value,
    duration_text: element.duration!.text,
    duration_value: element.duration!.value,
  };
}

/**
 * Fallback: get customer text address and calculate distance.
 */
async function calculateDistanceByAddress(
  originLat: number,
  originLng: number,
  jobId: number
): Promise<IDistanceResult> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      c.address AS c_address,
      c.town AS c_town,
      c.postal_code AS c_postal_code,
      c.country AS c_country,
      o.client_name
    FROM pleb_jobs pj
    JOIN orders o ON o.id = pj.order_id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE pj.id = ?
    LIMIT 1`,
    [jobId]
  );

  if (rows.length === 0) {
    throw new Error("Job not found");
  }

  const row = rows[0];
  const parts = [row.c_address, row.c_town, row.c_postal_code, row.c_country]
    .map((s: unknown) => (s ?? "").toString().trim())
    .filter((s: string) => s.length > 0);

  const address = parts.length > 0 ? parts.join(", ") : row.client_name || "";
  if (!address) {
    throw new Error("Customer address not available");
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Google Maps API key not configured");
  }

  console.log("[LiveDistance] Fallback to text address:", address);

  const origins = encodeURIComponent(`${originLat},${originLng}`);
  const destinations = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&units=metric&key=${apiKey}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error("Google Maps API request failed");
  }

  const data = (await resp.json()) as {
    status: string;
    rows?: { elements?: { status: string; distance?: { text: string; value: number }; duration?: { text: string; value: number } }[] }[];
  };

  if (data.status !== "OK") {
    throw new Error(`Google Maps API error: ${data.status}`);
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    throw new Error(
      `Distance calculation failed: ${element?.status || "no data"}`
    );
  }

  return {
    distance_text: element.distance!.text,
    distance_value: element.distance!.value,
    duration_text: element.duration!.text,
    duration_value: element.duration!.value,
  };
}

/**
 * Persist customer device GPS on the tracking row only (not `customers` table).
 * Only updates an existing `pleb_live_locations` row created by phleb GPS events.
 */
async function saveCustomerCoordinates(
  orderId: number,
  customerLat: number,
  customerLng: number
): Promise<void> {
  await pool.query<ResultSetHeader>(
    `UPDATE pleb_live_locations pll
     JOIN pleb_jobs pj ON pj.id = pll.job_id AND pj.pleb_id = pll.pleb_id
     SET pll.customer_lat = ?, pll.customer_lng = ?
     WHERE pj.order_id = ? AND pj.job_status NOT IN ('Delivered', 'Cancelled')`,
    [customerLat, customerLng, orderId]
  );
}

/**
 * Main function: upsert phleb location + calculate distance.
 * Accepts customerCoordinates map from socket layer so coords are always available.
 */
async function upsertAndCalculate(
  plebId: number,
  jobId: number,
  lat: number,
  lng: number,
  customerCoordsMap?: Map<number, { lat: number; lng: number }>
): Promise<ILocationUpdate> {
  const [jobRows] = await pool.query<RowDataPacket[]>(
    "SELECT order_id FROM pleb_jobs WHERE id = ? AND pleb_id = ? LIMIT 1",
    [jobId, plebId]
  );

  if (jobRows.length === 0) {
    return {
      distance_text: "Unavailable",
      distance_value: 0,
      duration_text: "Unavailable",
      duration_value: 0,
      order_id: 0,
      updated_at: new Date().toISOString(),
    };
  }

  const orderId = jobRows[0].order_id;
  const memoryCoords = customerCoordsMap?.get(orderId);

  // Customer is on live device GPS — do not store/simulator junk (e.g. iOS default SF).
  if (
    memoryCoords &&
    !coordsArePlausibleForTracking(lat, lng, memoryCoords.lat, memoryCoords.lng)
  ) {
    console.warn(
      `[LiveDistance] skip update_location order ${orderId}: phleb ${lat},${lng} vs customer ${memoryCoords.lat},${memoryCoords.lng}`
    );
    return {
      distance_text: "Unavailable",
      distance_value: 0,
      duration_text: "Unavailable",
      duration_value: 0,
      order_id: orderId,
      updated_at: new Date().toISOString(),
    };
  }

  // Upsert phleb GPS from this event (+ customer device GPS when track_job provided it).
  await pool.query<ResultSetHeader>(
    `INSERT INTO pleb_live_locations (pleb_id, job_id, lat, lng, customer_lat, customer_lng, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       lat = VALUES(lat),
       lng = VALUES(lng),
       customer_lat = COALESCE(VALUES(customer_lat), customer_lat),
       customer_lng = COALESCE(VALUES(customer_lng), customer_lng),
       updated_at = NOW()`,
    [
      plebId,
      jobId,
      lat,
      lng,
      memoryCoords?.lat ?? null,
      memoryCoords?.lng ?? null,
    ]
  );

  recordLivePhlebGps(orderId, lat, lng);

  // Check cache — skip Google API if phleb hasn't moved significantly
  const cacheKey = `${plebId}_${jobId}`;
  const cached = distanceCache.get(cacheKey);
  const now = Date.now();

  if (cached) {
    const moved = haversineDistance(cached.lat, cached.lng, lat, lng);
    const expired = now - cached.timestamp > CACHE_TTL_MS;
    if (moved < MOVEMENT_THRESHOLD_METERS && !expired) {
      return {
        ...cached.result,
        order_id: orderId,
        updated_at: new Date().toISOString(),
      };
    }
  }

  // Customer side: prefer live track_job GPS from memory; never use old DB customer_lat for distance.
  let result: IDistanceResult;
  try {
    if (memoryCoords) {
      result = await calculateDistanceByCoords(
        lat,
        lng,
        memoryCoords.lat,
        memoryCoords.lng
      );
    } else {
      // No live customer GPS yet — order address fallback only for distance text.
      result = await calculateDistanceByAddress(lat, lng, jobId);
    }
  } catch (err) {
    console.error("[LiveDistance] Distance calculation failed:", err instanceof Error ? err.message : err);
    return {
      distance_text: "Unavailable",
      distance_value: 0,
      duration_text: "Unavailable",
      duration_value: 0,
      order_id: orderId,
      updated_at: new Date().toISOString(),
    };
  }

  // Update cache
  distanceCache.set(cacheKey, { lat, lng, result, timestamp: now });

  return {
    ...result,
    order_id: orderId,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Get live location by order (for REST endpoint and initial socket fetch).
 * Optionally accepts customer coords from memory.
 */
async function getLiveLocationByOrder(
  orderId: number,
  customerCoords?: { lat: number; lng: number }
): Promise<ILiveLocationResponse | null> {
  const session = getSessionPhlebGps(orderId);
  let plebLat: number;
  let plebLng: number;
  let updatedAt: string;

  if (session) {
    plebLat = session.lat;
    plebLng = session.lng;
    updatedAt = new Date(session.updatedAtMs).toISOString();
  } else {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pll.lat, pll.lng, pll.updated_at
       FROM pleb_live_locations pll
       JOIN pleb_jobs pj ON pj.id = pll.job_id AND pj.pleb_id = pll.pleb_id
       WHERE pj.order_id = ? AND pj.job_status NOT IN ('Delivered', 'Cancelled')
       ORDER BY pll.updated_at DESC
       LIMIT 1`,
      [orderId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    if (!isGpsTimestampFresh(row.updated_at)) {
      console.warn(
        `[LiveDistance] no fresh phleb GPS for order ${orderId} — waiting for update_location event`
      );
      return null;
    }

    plebLat = parseFloat(row.lat);
    plebLng = parseFloat(row.lng);
    updatedAt = row.updated_at;
  }

  const custLat = customerCoords?.lat ?? null;
  const custLng = customerCoords?.lng ?? null;

  if (!coordsArePlausibleForTracking(plebLat, plebLng, custLat, custLng)) {
    console.warn(
      `[LiveDistance] skip implausible phleb GPS for order ${orderId}: ${plebLat},${plebLng}`
    );
    return null;
  }

  try {
    let distance: IDistanceResult;
    if (custLat != null && custLng != null) {
      distance = await calculateDistanceByCoords(plebLat, plebLng, custLat, custLng);
    } else {
      const [jobRows] = await pool.query<RowDataPacket[]>(
        `SELECT pj.id as job_id FROM pleb_jobs pj
         WHERE pj.order_id = ? AND pj.job_status NOT IN ('Delivered', 'Cancelled')
         LIMIT 1`,
        [orderId]
      );
      if (jobRows.length === 0) {
        throw new Error("No active job");
      }
      distance = await calculateDistanceByAddress(plebLat, plebLng, jobRows[0].job_id);
    }
    return {
      pleb_lat: plebLat,
      pleb_lng: plebLng,
      ...distance,
      updated_at: updatedAt,
    };
  } catch (err) {
    console.error(
      "[LiveDistance] getLiveLocationByOrder error:",
      err instanceof Error ? err.message : err
    );
    return {
      pleb_lat: plebLat,
      pleb_lng: plebLng,
      distance_text: "Unavailable",
      duration_text: "Unavailable",
      distance_value: 0,
      duration_value: 0,
      updated_at: updatedAt,
    };
  }
}

/**
 * Upsert location for ALL active jobs of a phleb and calculate distance for each.
 * The phleb's GPS is the same regardless of which job they specified in the app.
 */
async function upsertAllActiveJobs(
  plebId: number,
  lat: number,
  lng: number,
  customerCoordsMap?: Map<number, { lat: number; lng: number }>
): Promise<ILocationUpdate[]> {
  // Get all active (non-delivered, non-cancelled) jobs for this phleb
  const [activeJobs] = await pool.query<RowDataPacket[]>(
    `SELECT id as job_id, order_id FROM pleb_jobs 
     WHERE pleb_id = ? AND job_status NOT IN ('Delivered', 'Cancelled')`,
    [plebId]
  );

  if (activeJobs.length === 0) {
    return [];
  }

  const results: ILocationUpdate[] = [];

  for (const job of activeJobs) {
    const result = await upsertAndCalculate(
      plebId,
      job.job_id,
      lat,
      lng,
      customerCoordsMap
    );
    results.push(result);
  }

  return results;
}

async function clearLocation(plebId: number, jobId: number): Promise<void> {
  await pool.query<ResultSetHeader>(
    "DELETE FROM pleb_live_locations WHERE pleb_id = ? AND job_id = ?",
    [plebId, jobId]
  );
  distanceCache.delete(`${plebId}_${jobId}`);
}

/** Clears all live rows for a phleb (logout / disconnect). Returns affected order_ids. */
async function clearAllLocationsForPleb(plebId: number): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT pj.order_id AS order_id
     FROM pleb_live_locations pll
     JOIN pleb_jobs pj ON pj.id = pll.job_id AND pj.pleb_id = pll.pleb_id
     WHERE pll.pleb_id = ?`,
    [plebId]
  );

  await pool.query<ResultSetHeader>(
    "DELETE FROM pleb_live_locations WHERE pleb_id = ?",
    [plebId]
  );

  for (const key of distanceCache.keys()) {
    if (key.startsWith(`${plebId}_`)) {
      distanceCache.delete(key);
    }
  }

  return rows
    .map((r) => Number(r.order_id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export default {
  saveCustomerCoordinates,
  upsertAndCalculate,
  upsertAllActiveJobs,
  getLiveLocationByOrder,
  clearLocation,
  clearAllLocationsForPleb,
  recordLivePhlebGps,
  isGpsTimestampFresh,
} as const;
