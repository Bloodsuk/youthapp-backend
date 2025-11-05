import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { IPlebJob } from "@src/interfaces/IPlebJob";
import MailService from "./MailService";
import fetch from "node-fetch";

async function getAll(): Promise<IPlebJob[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, tracking_number, pleb_id, order_id, job_status, created_at FROM pleb_jobs ORDER BY id DESC"
  );
  return rows as unknown as IPlebJob[];
}

async function getByPlebId(plebId: number): Promise<IPlebJob[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, tracking_number, pleb_id, order_id, job_status, created_at FROM pleb_jobs WHERE pleb_id = ? ORDER BY id DESC",
    [plebId]
  );
  return rows as unknown as IPlebJob[];
}

async function updateStatus(id: number, jobStatus: string, trackingNumber?: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE pleb_jobs SET job_status = ?, tracking_number = COALESCE(?, tracking_number) WHERE id = ?",
    [jobStatus, trackingNumber ?? null, id]
  );
  return result.affectedRows > 0;
}

/**
 * Assign a job to a pleb (create new pleb_job)
 */
async function assignJob(plebId: number, orderId: number, jobStatus: string = "Assigned"): Promise<IPlebJob> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO pleb_jobs (pleb_id, order_id, job_status, created_at) VALUES (?, ?, ?, NOW())",
    [plebId, orderId, jobStatus]
  );
  
  // Get the newly created job
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, tracking_number, pleb_id, order_id, job_status, created_at FROM pleb_jobs WHERE id = ?",
    [result.insertId]
  );
  
  // Get pleb details for email notification
  const [plebRows] = await pool.query<RowDataPacket[]>(
    "SELECT full_name, email FROM phlebotomy_applications WHERE id = ?",
    [plebId]
  );
  
  // Get customer name for email
  const [orderRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      COALESCE(CONCAT(customers.fore_name, ' ', customers.sur_name), orders.client_name, '') AS customer_name
    FROM orders 
    LEFT JOIN customers ON orders.customer_id = customers.id
    WHERE orders.id = ?`,
    [orderId]
  );
  
  const plebJob = rows[0] as IPlebJob;

  // Mark order as assigned to avoid duplicates in available list
  try {
    await pool.query<ResultSetHeader>(
      "UPDATE orders SET is_job_assigned = 1 WHERE id = ?",
      [orderId]
    );
  } catch (e) {
    console.error("❌ Failed to mark order as assigned:", e instanceof Error ? e.message : e);
    // Non-fatal
  }
  
  // Send email notification to pleb
  if (plebRows.length > 0 && plebRows[0].email) {
    try {
      const plebName = plebRows[0].full_name || 'Phlebotomist';
      const plebEmail = plebRows[0].email;
      const customerName = orderRows.length > 0 ? (orderRows[0].customer_name || null) : null;
      
      await MailService.sendJobAssignmentEmail(
        plebName,
        plebEmail,
        orderId,
        customerName,
        jobStatus
      );
      console.log(`✅ Job assignment email sent to pleb ${plebId} (${plebEmail})`);
    } catch (error) {
      console.error("❌ Failed to send job assignment email:", error instanceof Error ? error.message : error);
      // Don't throw error - job was already assigned, email is optional
    }
  }
  
  return plebJob;
}

/**
 * Calculate distance between pleb (lat,lng) and order's customer address using Google Distance Matrix
 */
async function getDistanceBetweenPlebAndCustomer(plebId: number, orderId: number): Promise<{
  distance_text: string;
  distance_value: number;
  duration_text: string;
  duration_value: number;
}> {
  // Get pleb coordinates
  const [plebRows] = await pool.query<RowDataPacket[]>(
    "SELECT lat, lng, full_name, email FROM phlebotomy_applications WHERE id = ?",
    [plebId]
  );
  if (plebRows.length === 0) throw new Error("Pleb not found");
  const pleb = plebRows[0];
  if (!pleb.lat || !pleb.lng) throw new Error("Pleb lat/lng not set");

  // Build customer address from order
  const [orderRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      customers.address AS c_address,
      customers.town AS c_town,
      customers.postal_code AS c_postal_code,
      customers.country AS c_country,
      orders.client_name AS client_name
    FROM orders 
    LEFT JOIN customers ON orders.customer_id = customers.id
    WHERE orders.id = ?`,
    [orderId]
  );
  if (orderRows.length === 0) throw new Error("Order not found");
  const cAddress = (orderRows[0].c_address ?? '').toString().trim();
  const cTown = (orderRows[0].c_town ?? '').toString().trim();
  const cPostal = (orderRows[0].c_postal_code ?? '').toString().trim();
  const cCountry = (orderRows[0].c_country ?? '').toString().trim();
  const clientName = (orderRows[0].client_name ?? '').toString().trim();
  const addressParts = [cAddress, cTown, cPostal, cCountry].filter((s) => s.length > 0);
  const customerAddress = addressParts.length > 0 ? addressParts.join(', ') : clientName || null;
  if (!customerAddress) throw new Error("Customer address not available");

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }
  const maskedKey = `${apiKey.slice(0, 3)}***${apiKey.slice(-3)}`;
  console.log("[Distance] Inputs:", JSON.stringify({
    plebId,
    orderId,
    plebLat: pleb.lat,
    plebLng: pleb.lng,
    customerAddress,
    apiKeyMask: maskedKey,
  }));
  const origins = encodeURIComponent(`${pleb.lat},${pleb.lng}`);
  const destinations = encodeURIComponent(customerAddress);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&units=metric&key=${apiKey}`;

  console.log("[Distance] Request Params:", {
    origins: `${pleb.lat},${pleb.lng}`,
    destinations: customerAddress,
    mode: "driving",
    units: "metric",
  });

  let resp;
  try {
    resp = await fetch(url);
  } catch (networkErr) {
    console.error("[Distance] Network error calling Google API:", networkErr);
    throw new Error("Network error calling Google API");
  }
  console.log("[Distance] HTTP Status:", resp.status);
  if (!resp.ok) throw new Error(`Google API error: ${resp.status}`);
  const data = await resp.json();
  console.log("[Distance] Google API status:", data.status, data.error_message || "");
  if (data.status !== 'OK') {
    const apiError = typeof data.error_message === 'string' ? `: ${data.error_message}` : '';
    throw new Error(`Google API status ${data.status}${apiError}`);
  }
  if (!data.rows?.[0]?.elements?.[0]) {
    console.error("[Distance] Malformed response, rows/elements missing:", JSON.stringify(data));
    throw new Error("No distance elements returned by Google API");
  }
  if (data.rows[0].elements[0].status !== 'OK') {
    console.warn("[Distance] Element status:", data.rows[0].elements[0].status, data.rows[0].elements[0]);
    throw new Error(`Distance element status ${data.rows[0].elements[0].status}`);
  }
  const el = data.rows[0].elements[0];
  return {
    distance_text: el.distance.text,
    distance_value: el.distance.value,
    duration_text: el.duration.text,
    duration_value: el.duration.value,
  };
}

export default {
  getAll,
  getByPlebId,
  updateStatus,
  assignJob,
  getDistanceBetweenPlebAndCustomer,
} as const;


