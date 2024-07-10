import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IService } from "@src/interfaces/IService";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";

// **** Variables **** //

export const NOT_FOUND_ERR = "Service not found";

// **** Functions **** //

/**
 * Get all services.
 */
async function getAll(): Promise<IService[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * from other_charges WHERE 1 order by id desc"
  );
  const allServices = rows.map((service) => {
    return service as IService;
  });
  return allServices;
}

/**
 * Get one service.
 */
async function getOne(id: number): Promise<IService> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM other_charges WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  const service = rows[0];
  return service as IService;
}

/**
 * Add one service.
 */
async function addOne(service: Partial<IService>): Promise<number> {
  const data = {
    name: service.name || "",
    value: service.value || "",
  };
  const [result3] = await pool.query<ResultSetHeader>(
    "INSERT INTO other_charges SET ?",
    data
  );
  return result3.insertId;
}

/**
 * Update one service.
 */
async function updateOne(
  id: number,
  service: Record<string, any>
): Promise<boolean> {
  let sql = "UPDATE other_charges SET ";
  const values = [];
  for (const key in service) {
    const value = service[key];
    sql += ` ${key}=?,`;
    values.push(value);
  }
  sql = sql.slice(0, -1);
  sql += " WHERE id = ?";
  values.push(id);

  const [result] = await pool.query<ResultSetHeader>(sql, values);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  return true;
}
/**
 * Delete a service by their id.
 */
async function _delete(serviceId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      "DELETE FROM other_charges WHERE id = ?",
      [serviceId]
    );
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting service: "+error);
  }
}

// **** Export default **** //

export default {
  getAll,
  getOne,
  addOne,
  updateOne,
  delete: _delete,
} as const;
