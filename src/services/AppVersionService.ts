import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IAppVersion } from "@src/interfaces/IAppVersion";
import { pool } from "@src/server";
import { RowDataPacket } from "mysql2";

// **** Variables **** //

export const APP_VERSION_NOT_FOUND_ERR = "App version not found";

// **** Functions **** //

/**
 * Get all app versions.
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}

async function getAll(page: number = 1): Promise<IGetResponse<IAppVersion>> {
  const LIMIT = 10;
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;
  const sql = `SELECT * FROM app_versions ORDER BY created_at DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const appVersions = rows.map((version) => {
    return version as IAppVersion;
  });

  // Get total count
  const [countRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM app_versions");
  const total = countRows[0].count;

  return { data: appVersions, total };
}

/**
 * Get app version by platform.
 */
async function getByPlatform(platform: 'android' | 'ios' | 'web'): Promise<IAppVersion> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM app_versions WHERE platform = ? ORDER BY created_at DESC LIMIT 1",
    [platform]
  );
  
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, APP_VERSION_NOT_FOUND_ERR);
  }
  
  return rows[0] as IAppVersion;
}

// **** Export default **** //

export default {
  getAll,
  getByPlatform,
} as const;
