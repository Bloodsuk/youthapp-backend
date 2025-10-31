import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { IPlebJob } from "@src/interfaces/IPlebJob";
import MailService from "./MailService";

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

async function updateStatus(id: number, jobStatus: string, trackingNumber: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE pleb_jobs SET job_status = ?, tracking_number = ? WHERE id = ?",
    [jobStatus, trackingNumber, id]
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

export default {
  getAll,
  getByPlebId,
  updateStatus,
  assignJob,
} as const;


