import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { IPlebJob } from "@src/interfaces/IPlebJob";

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

async function updateStatus(id: number, jobStatus: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE pleb_jobs SET job_status = ? WHERE id = ?",
    [jobStatus, id]
  );
  return result.affectedRows > 0;
}

export default {
  getAll,
  getByPlebId,
  updateStatus,
} as const;


