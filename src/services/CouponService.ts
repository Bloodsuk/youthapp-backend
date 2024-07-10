import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { ICoupon } from "@src/interfaces/ICoupon";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import moment from "moment";

// **** Variables **** //

export const NOT_FOUND_ERR = "Coupon not found";

// **** Functions **** //

/**
 * Get all coupons.
 */
async function getAll(): Promise<ICoupon[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * from coupons WHERE 1 order by id desc"
  );
  const allCoupons = rows.map((coupon) => {
    return coupon as ICoupon;
  });
  return allCoupons;
}

/**
 * Get one coupon.
 */
async function getOne(id: number): Promise<ICoupon> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM coupons WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  const coupon = rows[0];
  return coupon as ICoupon;
}

/**
 * Add one coupon.
 */
async function addOne(coupon: Partial<ICoupon>): Promise<number> {
  const coupon_id = coupon.coupon_id || '';
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * from coupons where coupon_id = '${coupon_id}' `);
  if(rows.length > 0)
  {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This Coupon Code Already Exists"
    );
  }
  const data = {
    coupon_id: coupon.coupon_id || "",
    value: coupon.value || "",
    type: coupon.type || "",
    expiry_date: coupon.expiry_date || "",
    max_users: coupon.max_users || "",
  };
  const [result3] = await pool.query<ResultSetHeader>("INSERT INTO coupons SET ?", data);
  return result3.insertId;
}

/**
 * Update one coupon.
 */
async function updateOne(
  id: number,
  coupon: Record<string, any>
): Promise<boolean> {
  let sql = "UPDATE coupons SET ";
  const values = [];
  for (const key in coupon) {
    const value = coupon[key];
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
 * Delete a coupon by their id.
 */
async function _delete(couponId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>("DELETE FROM coupons WHERE id = ?", [couponId]);
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting coupon: "+error);
  }
}

/**
 * .
 */
async function getDiscount(discount_code: string): Promise<{ value: number; type: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * from coupons where coupon_id = '${discount_code}'`
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Wrong coupon code");
  }
  const coupon = rows[0] as ICoupon;
  const today = moment(new Date());
  const expiry_date = moment(coupon["expiry_date"]);
  const value = coupon["value"];
  const type = coupon["type"];
  const max_users = coupon["max_users"];
  const used = coupon["used"];
  if (today.isAfter(expiry_date, "d")) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Coupon Expired");
  }
  if (max_users <= used) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Coupon Limit Reached");
  }
  return { value, type };
}

// **** Export default **** //

export default {
  getAll,
  getOne,
  addOne,
  updateOne,
  delete: _delete,
  getDiscount,
} as const;
