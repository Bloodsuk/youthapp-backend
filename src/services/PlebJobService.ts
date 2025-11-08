import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { IPlebJob } from "@src/interfaces/IPlebJob";
import MailService from "./MailService";
import fetch from "node-fetch";

interface IAdminContact {
  email: string;
  name: string;
}

interface IPlebJobContext {
  jobId: number;
  plebId: number | null;
  orderId: number;
  orderCode: string | null;
  plebName: string | null;
  plebEmail: string | null;
  plebPhone: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  jobStatus: string | null;
  trackingNumber: string | null;
}

const normalizeString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const converted = String(value).trim();
    return converted.length > 0 ? converted : null;
  }
  return null;
};

const buildCustomerAddress = (row: Record<string, unknown>): string | null => {
  const parts = [
    normalizeString(row["address"]),
    normalizeString(row["town"]),
    normalizeString(row["postal_code"]),
    normalizeString(row["country"]),
  ].filter((part): part is string => !!part);

  return parts.length > 0 ? parts.join(", ") : null;
};

const getActiveAdminContacts = async (): Promise<IAdminContact[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
        email, 
        TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS name
      FROM users
      WHERE user_level = 'Admin'
        AND status = 1
        AND email IS NOT NULL
        AND TRIM(email) <> ''`
  );

  return rows
    .map((row) => ({
      email: row.email as string,
      name: normalizeString(row.name) ?? "Admin",
    }))
    .filter((contact) => !!contact.email && contact.email.trim().length > 0);
};

const getPlebJobContext = async (jobId: number): Promise<IPlebJobContext | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
        pj.id AS job_id,
        pj.pleb_id,
        pj.order_id,
        pj.job_status,
        pj.tracking_number,
        orders.order_id AS order_code,
        COALESCE(CONCAT(customers.fore_name, ' ', customers.sur_name), orders.client_name, '') AS customer_name,
        customers.email AS customer_email,
        customers.telephone AS customer_phone,
        customers.address,
        customers.town,
        customers.postal_code,
        customers.country,
        pleb.full_name AS pleb_name,
        pleb.email AS pleb_email,
        pleb.phone AS pleb_phone
      FROM pleb_jobs pj
      LEFT JOIN phlebotomy_applications pleb ON pj.pleb_id = pleb.id
      LEFT JOIN orders ON pj.order_id = orders.id
      LEFT JOIN customers ON orders.customer_id = customers.id
      WHERE pj.id = ?
      LIMIT 1`,
    [jobId]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const address = buildCustomerAddress({
    address: row.address,
    town: row.town,
    postal_code: row.postal_code,
    country: row.country,
  });

  return {
    jobId: Number(row.job_id),
    plebId: row.pleb_id !== null ? Number(row.pleb_id) : null,
    orderId: Number(row.order_id),
    orderCode: normalizeString(row.order_code),
    plebName: normalizeString(row.pleb_name),
    plebEmail: normalizeString(row.pleb_email),
    plebPhone: normalizeString(row.pleb_phone),
    customerName: normalizeString(row.customer_name),
    customerEmail: normalizeString(row.customer_email),
    customerPhone: normalizeString(row.customer_phone),
    customerAddress: address,
    jobStatus: normalizeString(row.job_status),
    trackingNumber: normalizeString(row.tracking_number),
  };
};

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
  const context = await getPlebJobContext(id);
  if (!context) {
    return false;
  }

  const trimmedStatus = jobStatus.trim();
  const trimmedTracking = normalizeString(trackingNumber);

  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE pleb_jobs SET job_status = ?, tracking_number = COALESCE(?, tracking_number) WHERE id = ?",
    [trimmedStatus, trimmedTracking ?? null, id]
  );

  if (result.affectedRows === 0) {
    return false;
  }

  const updatedContext: IPlebJobContext = {
    ...context,
    jobStatus: trimmedStatus,
    trackingNumber: trimmedTracking ?? context.trackingNumber,
  };

  try {
    const adminContacts = await getActiveAdminContacts();
    const adminEmails = adminContacts.map((contact) => contact.email);
    const plebName = updatedContext.plebName ?? "Phlebotomist";
    const orderIdentifiers = {
      orderId: updatedContext.orderId,
      orderCode: updatedContext.orderCode,
    };

    const normalizedStatus = trimmedStatus.toLowerCase();
    const isCompletion = normalizedStatus === "delivered" || normalizedStatus === "completed";

    const notifications: Promise<void>[] = [];

    if (isCompletion) {
      if (adminEmails.length > 0) {
        notifications.push(
          MailService.sendAdminJobCompletionEmail(adminEmails, {
            ...orderIdentifiers,
            plebName,
            trackingNumber: updatedContext.trackingNumber,
            newStatus: trimmedStatus,
          })
        );
      }
      if (updatedContext.customerEmail) {
        notifications.push(
          MailService.sendCustomerJobCompletionEmail(updatedContext.customerEmail, {
            ...orderIdentifiers,
            plebName,
            trackingNumber: updatedContext.trackingNumber,
            customerName: updatedContext.customerName,
            newStatus: trimmedStatus,
          })
        );
      }
    } else {
      if (adminEmails.length > 0) {
        notifications.push(
          MailService.sendAdminJobStatusUpdateEmail(adminEmails, {
            ...orderIdentifiers,
            plebName,
            newStatus: trimmedStatus,
            trackingNumber: updatedContext.trackingNumber,
          })
        );
      }
      if (updatedContext.customerEmail) {
        notifications.push(
          MailService.sendCustomerJobStatusUpdateEmail(updatedContext.customerEmail, {
            ...orderIdentifiers,
            plebName,
            customerName: updatedContext.customerName,
            newStatus: trimmedStatus,
          })
        );
      }
    }

    for (const notification of notifications) {
      try {
        await notification;
      } catch (notificationError) {
        console.error(
          "❌ Failed to send pleb job status notification:",
          notificationError instanceof Error ? notificationError.message : notificationError
        );
      }
    }
  } catch (error) {
    console.error(
      "❌ Failed to send pleb job status notifications:",
      error instanceof Error ? error.message : error
    );
  }

  return true;
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
  
  const plebJob = rows[0] as IPlebJob;
  const jobContext = await getPlebJobContext(plebJob.id);

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
  if (jobContext) {
    try {
      const adminContacts = await getActiveAdminContacts();
      const adminEmails = adminContacts.map((contact) => contact.email);
      const plebName = jobContext.plebName ?? "Phlebotomist";
      const orderIdentifiers = {
        orderId: jobContext.orderId,
        orderCode: jobContext.orderCode,
      };
      const currentStatus = jobContext.jobStatus ?? jobStatus;

      const notifications: Promise<void>[] = [];

      if (adminEmails.length > 0) {
        notifications.push(
          MailService.sendAdminJobAssignmentEmail(adminEmails, {
            ...orderIdentifiers,
            plebName,
            plebPhone: jobContext.plebPhone,
            customerName: jobContext.customerName,
            customerPhone: jobContext.customerPhone,
            customerAddress: jobContext.customerAddress,
          })
        );
      }

      if (jobContext.plebEmail) {
        notifications.push(
          MailService.sendPlebJobAssignmentEmail(jobContext.plebEmail, {
            ...orderIdentifiers,
            plebName,
            customerName: jobContext.customerName,
            customerPhone: jobContext.customerPhone,
            customerAddress: jobContext.customerAddress,
            jobStatus: currentStatus,
          })
        );
      }

      if (jobContext.customerEmail) {
        notifications.push(
          MailService.sendCustomerJobAssignmentEmail(jobContext.customerEmail, {
            ...orderIdentifiers,
            customerName: jobContext.customerName,
            plebName,
            plebPhone: jobContext.plebPhone,
          })
        );
      }

      for (const notification of notifications) {
        try {
          await notification;
        } catch (notificationError) {
          console.error(
            "❌ Failed to send job assignment notification:",
            notificationError instanceof Error ? notificationError.message : notificationError
          );
        }
      }
    } catch (error) {
      console.error(
        "❌ Failed to send job assignment notifications:",
        error instanceof Error ? error.message : error
      );
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


