import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IRole } from "@src/interfaces/IRole";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { LIMIT } from "@src/constants/pagination";
import { empty, getTotalCount } from "@src/util/misc";
export const ROLE_NOT_FOUND_ERR = "Role not found!";

/**
 * INFO: response interface
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}

/**
 * INFO: Get all roles
 * @param page 
 * @param search 
 * @returns 
 */
async function getAll(
  page: number = 1,
  search?: string
): Promise<IGetResponse<IRole>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;
  let sql = `SELECT * FROM roles WHERE 1`;
  let searchSql = "";
  if (search && !empty(search)) {
    searchSql += ` AND role_name LIKE '%${search}%'`;
    sql += searchSql;
  }
  sql += ` ORDER BY created_at DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allRoles = rows.map((role) => {
    return role as IRole;
  });
  const total = await getTotalCount(pool, 'roles', `WHERE 1 ${searchSql}`);
  return { data: allRoles, total };
}

/**
 * INFO: Get particular role by Id
 * @param id 
 * @returns 
 */
async function getOne(id: number): Promise<IRole> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM roles WHERE id = ?", [id]);
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, ROLE_NOT_FOUND_ERR);
  }
  const role = rows[0];
  return role as IRole;
}

/**
 * INFO: Save the role
 * @param role 
 * @returns 
 */
async function addOne(role: Record<string, any>): Promise<number> {
  const data = {
    role_name: role.role_name,
    created_by: role.created_by,
  }
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM roles WHERE role_name LIKE '%${role.role_name}%'`);
  if (rows.length) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Role already exists!");
  }
  const [result3] = await pool.query<ResultSetHeader>("INSERT INTO roles SET ?", data);
  return result3.insertId;
}


/**
 * INFO: Mark role as active/inactive
 * @param role 
 * @returns 
 */
async function markActive(
  role: Record<string, any>
): Promise<boolean> {
  const ids = role.role_ids?.toString()?.split(',') // comma separate ids
  const sql = "UPDATE roles SET is_active = ? WHERE id IN (?)";
  const [result] = await pool.query<ResultSetHeader>(sql, [role.is_active, ids]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, ROLE_NOT_FOUND_ERR);
  }
  return true;
}

/**
 * INFO: Assign role to user
 * @param user_id 
 * @param role_id
 * @returns 
 */
async function assignRoleToUser(
  user_id: number,
  role_id: number,
): Promise<boolean> {
  const sql = "UPDATE users SET role_id = ? WHERE id = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [role_id, user_id]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found!");
  }
  return true;
}

/**
 * INFO: Assign role to user
 * @param role_id
 * @param permission_id
 * @returns 
 */
async function assignPermissionToRole(
  role_id: number,
  permission_id: string,
): Promise<boolean> {
  const data = {
    role_id,
    permission_id
  }
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM role_permissions WHERE role_id = ${role_id}`);
  if (rows.length) {
    const sql = "UPDATE role_permissions SET permission_id = ? WHERE role_id = ?";
    const [result] = await pool.query<ResultSetHeader>(sql, [permission_id, role_id]);
    return result.affectedRows != 0
  } else {
    const [result3] = await pool.query<ResultSetHeader>("INSERT INTO role_permissions SET ?", data);
    return result3.insertId > 0;
  }
}

/**
 * INFO: Update role by id
 * @param id 
 * @param role 
 * @returns 
 */
async function updateOne(
  id: number,
  role: Record<string, any>
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM roles WHERE role_name LIKE '%${role.role_name}%' And id <> ${id}`);
  if (rows.length) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Role already exists!");
  }
  const sql = "UPDATE roles SET role_name = ? WHERE id = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [role.role_name, id]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, ROLE_NOT_FOUND_ERR);
  }
  return true;
}

/**
 * INFO: Delete role by id
 * @param id 
 */
async function _delete(id: number): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM users WHERE role_id = ${id}`);
    if (rows.length) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "This role may assign to some users. By deleting it, those user will lose all given permissions. Do you want to continue?");
    }
    await pool.query<ResultSetHeader>("UPDATE roles SET is_active = 0 WHERE id = ?", [id]);
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting role: " + error);
  }
}

export default {
  getAll,
  getOne,
  addOne,
  markActive,
  assignRoleToUser,
  assignPermissionToRole,
  updateOne,
  delete: _delete,
} as const;
