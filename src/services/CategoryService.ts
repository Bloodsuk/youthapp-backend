import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { ICategory } from "@src/interfaces/ICategory";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { LIMIT } from "@src/constants/pagination";
import { empty, getTotalCount } from "@src/util/misc";

// **** Variables **** //

export const USER_NOT_FOUND_ERR = "Category not found";

// **** Functions **** //

/**
 * Get all categories.
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}

async function getAll(
  page: number = 1,
  search?: string
): Promise<IGetResponse<ICategory>> {
  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;
  // Prepare the base SQL query
  let sql = `SELECT * FROM categories WHERE 1`;

  // If there's a search term, add the search condition
  let searchSql = "";
  if (search && !empty(search)) {
    searchSql += ` AND name LIKE '%${search}%'`;
    sql += searchSql;
  }

  sql += ` ORDER BY name DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allCategorys = rows.map((category) => {
    return category as ICategory;
  });
  const total = await getTotalCount(pool, 'categories', `WHERE 1 ${searchSql}`);
  return { data: allCategorys, total };
}

/**
 * Get one category.
 */
async function getOne(id: number): Promise<ICategory> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM categories WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  const category = rows[0];
  return category as ICategory;
}

/**
 * Add one category.
 */
async function addOne(category: Record<string,any>): Promise<number> {
  const data = {
    name: category.name,
  };
  const [result3] = await pool.query<ResultSetHeader>("INSERT INTO categories SET ?", data);
  return result3.insertId;
}

/**
 * Update one category.
 */
async function updateOne(
  id: number,
  category: Record<string, any>
): Promise<boolean> {
  const sql = "UPDATE categories SET name = ? WHERE id = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [category.name, id]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  return true;
}
/**
 * Delete a category by their id.
 */
async function _delete(categoryId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>("DELETE FROM categories WHERE id = ?", [categoryId]);
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting category: "+error);
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
