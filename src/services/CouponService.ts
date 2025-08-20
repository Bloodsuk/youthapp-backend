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
 * Get coupon discount and record usage in a single atomic operation.
 */
async function getDiscount(discount_code: string, user_id?: number): Promise<{ value: number; type: number }> {
  // Start transaction
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 1. Get coupon details with FOR UPDATE to prevent race conditions
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * from coupons where coupon_id = ? FOR UPDATE`,
      [discount_code]
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
    
    // 2. Validate coupon
    if (today.isAfter(expiry_date, "d")) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Coupon Expired");
    }
    if (max_users <= used) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Code Usage Limit Reached");
    }
    
    // 3. If user is authenticated, record usage (allow multiple uses)
    if (user_id) {
      // Record usage in tracking table (allow duplicates)
      await connection.query<ResultSetHeader>(
        "INSERT INTO user_coupon_usage (user_id, coupon_id) VALUES (?, ?)",
        [user_id, discount_code]
      );
      
      // Update usage count in coupons table
      await connection.query<ResultSetHeader>(
        "UPDATE coupons SET used = used + 1 WHERE coupon_id = ?",
        [discount_code]
      );
    }
    
    await connection.commit();
    return { value, type };
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Record that a user has used a coupon (kept for backward compatibility)
 */
async function recordCouponUsage(user_id: number, coupon_id: string): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      "INSERT INTO user_coupon_usage (user_id, coupon_id) VALUES (?, ?)",
      [user_id, coupon_id]
    );
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "You have already used this coupon");
    }
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error recording coupon usage: " + error);
  }
}

/**
 * Get all users who have used a specific coupon
 */
async function getCouponUsers(coupon_id: string): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT user_id FROM user_coupon_usage WHERE coupon_id = ?",
    [coupon_id]
  );
  return rows.map(row => row.user_id);
}

/**
 * Get all coupons used by a specific user
 */
async function getUserCoupons(user_id: number): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT coupon_id FROM user_coupon_usage WHERE user_id = ?",
    [user_id]
  );
  return rows.map(row => row.coupon_id);
}

/**
 * Check how many times a user has used a specific coupon
 */
async function getUserCouponUsageCount(user_id: number, coupon_id: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM user_coupon_usage WHERE user_id = ? AND coupon_id = ?",
    [user_id, coupon_id]
  );
  return rows[0].count;
}

// **** Export default **** //

export default {
  getAll,
  getOne,
  addOne,
  updateOne,
  delete: _delete,
  getDiscount,
  recordCouponUsage,
  getCouponUsers,
  getUserCoupons,
  getUserCouponUsageCount,
} as const;
