import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IPermission } from "@src/interfaces/IPermission";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { LIMIT } from "@src/constants/pagination";
import { empty, getTotalCount } from "@src/util/misc";
export const PERMISSION_NOT_FOUND_ERR = "Permission not found!";

/**
 * INFO: response interface
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}

/**
 * INFO: Get all permissions
 * @param page 
 * @param search 
 * @returns 
 */
async function getAll(
  page: number = 1,
  search?: string
): Promise<IGetResponse<IPermission>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;
  let sql = `SELECT * FROM permissions WHERE 1`;
  let searchSql = "";
  if (search && !empty(search)) {
    searchSql += ` AND permission_name LIKE '%${search}%'`;
    sql += searchSql;
  }
  sql += ` ORDER BY id`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allPermissions = rows.map((permission) => {
    return permission as IPermission;
  });
  const total = await getTotalCount(pool, 'permissions', `WHERE 1 ${searchSql}`);
  return { data: allPermissions, total };
}

/**
 * INFO: Get particular permission by Id
 * @param id 
 * @returns 
 */
async function getOne(id: number): Promise<IPermission> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM permissions WHERE id = ?", [id]);
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, PERMISSION_NOT_FOUND_ERR);
  }
  const permission = rows[0];
  return permission as IPermission;
}

/**
 * INFO: Save the permission
 * @param permission 
 * @returns 
 */
async function addOne(permission: Record<string, any>): Promise<number> {
  const data = {
    permission_name: permission.permission_name
  }
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM permissions WHERE permission_name LIKE '%${permission.permission_name}%'`);
  if (rows.length) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Permission already exists!");
  }
  const [result3] = await pool.query<ResultSetHeader>("INSERT INTO permissions SET ?", data);
  return result3.insertId;
}


/**
 * INFO: Mark permission as active/inactive
 * @param permission 
 * @returns 
 */
async function markActive(
  permission: Record<string, any>
): Promise<boolean> {
  const ids = permission.permission_ids?.toString()?.split(',') // comma separate ids
  const sql = "UPDATE permissions SET is_active = ? WHERE id IN (?)";
  const [result] = await pool.query<ResultSetHeader>(sql, [permission.is_active, ids]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, PERMISSION_NOT_FOUND_ERR);
  }
  return true;
}


/**
 * INFO: Update permission by id
 * @param id 
 * @param permission 
 * @returns 
 */
async function updateOne(
  id: number,
  permission: Record<string, any>
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM permissions WHERE permission_name LIKE '%${permission.permission_name}%' And id <> ${id}`);
  if (rows.length) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Permission already exists!");
  }
  const sql = "UPDATE permissions SET permission_name = ? WHERE id = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [permission.permission_name, id]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, PERMISSION_NOT_FOUND_ERR);
  }
  return true;
}

/**
 * INFO: Delete permission by id
 * @param id 
 */
async function _delete(id: number): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM role_permissions WHERE permission_id = ${id}`);
    if (rows.length) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "This permission is assigned to role so can't be delete for now!");
    }
    await pool.query<ResultSetHeader>("DELETE FROM permissions WHERE id = ?", [id]);
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting permission: " + error);
  }
}



export default {
  getAll,
  getOne,
  addOne,
  markActive,
  updateOne,
  delete: _delete,
} as const;
