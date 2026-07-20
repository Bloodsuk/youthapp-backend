import fetch from "node-fetch";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";

const EARTH_RADIUS_MILES = 3959;

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(a)) * EARTH_RADIUS_MILES;
}

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS home_visit_draft_messages (
      id int NOT NULL AUTO_INCREMENT,
      order_id int NOT NULL,
      phleb_ids text,
      distances text,
      postal_code varchar(20) DEFAULT NULL,
      address text,
      lat decimal(10,7) DEFAULT NULL,
      lng decimal(10,7) DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_home_visit_draft_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

async function geocode(
  addressQuery: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressQuery)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url);
  const data = (await resp.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
  };

  if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) {
    console.warn(
      "[HomeVisitDraft] geocode failed:",
      data.status ?? "unknown",
      addressQuery
    );
    return null;
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

export interface IHomeVisitDraftPayload {
  orderId: number;
  postalCode?: string | null;
  address?: string | null;
}

/**
 * Same logic as site draft-messages-entry.php:
 * geocode customer → top 5 nearest phlebs → save home_visit_draft_messages.
 * Non-fatal: logs and returns on failure.
 */
async function createDraftForOrder(payload: IHomeVisitDraftPayload): Promise<void> {
  const orderId = Number(payload.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) return;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[HomeVisitDraft] skipped: GOOGLE_MAPS_API_KEY not set");
    return;
  }

  try {
    await ensureTable();

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM home_visit_draft_messages WHERE order_id = ? LIMIT 1",
      [orderId]
    );
    if (existing.length > 0) {
      return;
    }

    const postal = (payload.postalCode || "").trim();
    const address = (payload.address || "").trim();
    const locationQuery = postal || address;
    if (!locationQuery) {
      console.warn("[HomeVisitDraft] skipped: no postcode/address");
      return;
    }

    const coords = await geocode(locationQuery, apiKey);
    if (!coords) return;

    const [plebRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, lat, lng
       FROM phlebotomy_applications
       WHERE lat IS NOT NULL AND lng IS NOT NULL`
    );

    if (!plebRows.length) {
      console.warn("[HomeVisitDraft] no phlebs with lat/lng");
      return;
    }

    const ranked = plebRows
      .map((row) => {
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: Number(row.id),
          distance: haversineMiles(coords.lat, coords.lng, lat, lng),
        };
      })
      .filter((p): p is { id: number; distance: number } => !!p)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    if (!ranked.length) return;

    const phlebIds = ranked.map((p) => p.id).join(",");
    const distances = ranked.map((p) => p.distance.toFixed(2)).join(",");

    await pool.query<ResultSetHeader>(
      `INSERT INTO home_visit_draft_messages
        (order_id, phleb_ids, distances, postal_code, address, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        phlebIds,
        distances,
        postal || null,
        address || null,
        coords.lat,
        coords.lng,
      ]
    );

    console.log(
      `[HomeVisitDraft] saved order=${orderId} phlebs=${phlebIds}`
    );
  } catch (error) {
    console.error(
      "[HomeVisitDraft] failed:",
      error instanceof Error ? error.message : error
    );
  }
}

export default {
  createDraftForOrder,
} as const;
