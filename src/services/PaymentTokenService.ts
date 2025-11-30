import { ResultSetHeader, RowDataPacket } from "mysql2";
import { IPaymentToken } from "@src/interfaces/IPaymentToken";
import { pool } from "@src/server";

const TABLE = "payment_tokens";

interface ISaveTokenParams {
  provider?: string;
  token: string;
  fingerprint?: string | null;
  brand?: string | null;
  last4?: string | null;
  exp_month?: string | null;
  exp_year?: string | null;
}

async function listByUser(user_id: number): Promise<IPaymentToken[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${TABLE} WHERE user_id = ? ORDER BY created_at DESC`,
    [user_id]
  );
  return rows.map((row) => row as IPaymentToken);
}

async function getByIdForUser(
  id: number,
  user_id: number
): Promise<IPaymentToken | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${TABLE} WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, user_id]
  );
  if (!rows.length) {
    return null;
  }
  return rows[0] as IPaymentToken;
}

async function saveOrUpdate(
  user_id: number,
  params: ISaveTokenParams
): Promise<IPaymentToken> {
  const values = [
    user_id,
    params.provider || "GlobalPayments",
    params.token,
    params.fingerprint || null,
    params.brand || null,
    params.last4 || null,
    params.exp_month || null,
    params.exp_year || null,
  ];
  const sql = `
    INSERT INTO ${TABLE}
      (user_id, provider, token, fingerprint, brand, last4, exp_month, exp_year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      token = VALUES(token),
      brand = VALUES(brand),
      last4 = VALUES(last4),
      exp_month = VALUES(exp_month),
      exp_year = VALUES(exp_year),
      updated_at = CURRENT_TIMESTAMP
  `;
  await pool.query<ResultSetHeader>(sql, values);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${TABLE} WHERE user_id = ? AND token = ? ORDER BY updated_at DESC LIMIT 1`,
    [user_id, params.token]
  );
  return rows[0] as IPaymentToken;
}

async function deleteToken(id: number, user_id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM ${TABLE} WHERE id = ? AND user_id = ?`,
    [id, user_id]
  );
  return result.affectedRows > 0;
}

export default {
  listByUser,
  getByIdForUser,
  saveOrUpdate,
  deleteToken,
};

