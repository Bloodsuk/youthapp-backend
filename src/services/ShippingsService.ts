import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IShipping } from "@src/interfaces/IShipping";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";

// **** Variables **** //

export const NOT_FOUND_ERR = "Shipping not found";

// **** Functions **** //

/**
 * Get all shippings.
 */
async function getAll(): Promise<IShipping[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * from shiping_types WHERE 1 order by id desc"
  );
  const allShippings = rows.map((shipping_type) => {
    return shipping_type as IShipping;
  });
  return allShippings;
}

/**
 * Get one shipping_type.
 */
async function getOne(id: number): Promise<IShipping> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM shiping_types WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  const shipping_type = rows[0];
  return shipping_type as IShipping;
}

/**
 * Add one shipping_type.
 */
async function addOne(shipping_type: Partial<IShipping>): Promise<number> {
  const data = {
    name: shipping_type.name || "",
    value: shipping_type.value || "",
  };
  const [result3] = await pool.query<ResultSetHeader>(
    "INSERT INTO shiping_types SET ?",
    data
  );
  return result3.insertId;
}

/**
 * Update one shipping_type.
 */
async function updateOne(
  id: number,
  shipping_type: Record<string, any>
): Promise<boolean> {
  let sql = "UPDATE shiping_types SET ";
  const values = [];
  for (const key in shipping_type) {
    const value = shipping_type[key];
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
 * Delete a shipping_type by their id.
 */
async function _delete(shippingId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      "DELETE FROM shiping_types WHERE id = ?",
      [shippingId]
    );
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting shipping_type: "+error);
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
