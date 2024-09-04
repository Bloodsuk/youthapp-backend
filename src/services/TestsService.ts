import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { ITest } from "@src/interfaces/ITest";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { LIMIT } from "@src/constants/pagination";
import { empty, getTotalCount } from "@src/util/misc";

// **** Variables **** //

export const NOT_FOUND_ERR = "Test not found";

// **** Functions **** //

/**
 * Get all tests.
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}

async function getAll(page: number = 1, search: string = "", cate_id: string = ""): Promise<IGetResponse<ITest>> {
  const joinColumns =
    ", CONCAT(u1.first_name, ' ', u1.last_name) as practitioner_name, tc.customer_cost as practitioner_customer_cost";
  const join = ` LEFT JOIN users u1 ON (u1.id = tests.practitioner_id)
                 LEFT JOIN tests_cost_by_practitioner tc ON (tc.tests_id = tests.id And tc.practitioner_id = tests.practitioner_id)`;

  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  let sql = `SELECT tests.* ${joinColumns} from tests ${join} WHERE 1`;
  // If there's a search term, add the search condition
  let searchSql = "";
  if (search && !empty(search)) {
    searchSql += ` AND test_name LIKE '%${search}%'`;
    sql += searchSql;
  }
  if (cate_id && !empty(cate_id)) {
    searchSql += ` AND cate_id = ${cate_id}`;
    sql += searchSql;
  }

  sql += ` ORDER BY id DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allTests = rows.map((test) => {
    return test as ITest;
  });

  const total = await getTotalCount(pool, 'tests', `WHERE 1 ${searchSql}`);

  return { data: allTests, total };
}

/**
 * INFO: get practitioner test
 * @param practitioner_id 
 * @param page 
 * @param search 
 * @returns 
 */
async function getPractitionerTest(practitioner_id: number, page: number = 1, search: string = "", cate_id: string = ""): Promise<IGetResponse<ITest>> {
  const joinColumns =
    ", CONCAT(u1.first_name, ' ', u1.last_name) as practitioner_name, tc.customer_cost as practitioner_customer_cost";
  const join = ` LEFT JOIN users u1 ON (u1.id = tests.practitioner_id)
                 LEFT JOIN tests_cost_by_practitioner tc ON (tc.tests_id = tests.id And tc.practitioner_id = tests.practitioner_id)`;

  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  let sql = `SELECT tests.* ${joinColumns} from tests ${join} WHERE 
  (tests.practitioner_id IS NULL OR tests.practitioner_id = 0 OR tests.practitioner_id = ${practitioner_id})`;
  // If there's a search term, add the search condition
  let searchSql = "";
  if (search && !empty(search)) {
    searchSql += ` AND test_name LIKE '%${search}%'`;
    sql += searchSql;
  }
  if (cate_id && !empty(cate_id)) {
    searchSql += ` AND cate_id = ${cate_id}`;
    sql += searchSql;
  }

  sql += ` ORDER BY id DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allTests = rows.map((test) => {
    return test as ITest;
  });

  const total = await getTotalCount(pool, 'tests', `WHERE (tests.practitioner_id IS NULL OR tests.practitioner_id = 0 OR tests.practitioner_id = ${practitioner_id}) ${searchSql}`);

  return { data: allTests, total };
}

/**
 * INFO: Get all customer test
 * @param customer_id 
 * @param page 
 * @param search 
 * @returns 
 */
async function getCustomerTest(customer_id: number, page: number = 1, search: string = "", cate_id: string = ""): Promise<IGetResponse<ITest>> {
  const joinColumns =
    ", CONCAT(u1.first_name, ' ', u1.last_name) as practitioner_name, tc.customer_cost as practitioner_customer_cost";
  const join = ` LEFT JOIN users u1 ON (u1.id = tests.practitioner_id)
                 LEFT JOIN tests_cost_by_practitioner tc ON (tc.tests_id = tests.id And tc.practitioner_id = tests.practitioner_id)
                 LEFT JOIN customers c ON (c.created_by = tests.practitioner_id)`;

  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  let sql = `SELECT tests.* ${joinColumns} from tests ${join} WHERE 
  (tests.practitioner_id IS NULL OR tests.practitioner_id = 0 OR c.id = ${customer_id})`;
  // If there's a search term, add the search condition
  let searchSql = "";
  if (search && !empty(search)) {
    searchSql += ` AND test_name LIKE '%${search}%'`;
    sql += searchSql;
  }
  if (cate_id && !empty(cate_id)) {
    searchSql += ` AND cate_id = ${cate_id}`;
    sql += searchSql;
  }

  sql += ` ORDER BY id DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allTests = rows.map((test) => {
    return test as ITest;
  });

  const total = await getTotalCount(pool, 'tests', `WHERE 1 ${searchSql}`);

  return { data: allTests, total };
}

/**
 * Get one test.
 */
async function getOne(id: number): Promise<ITest> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM tests WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  const test = rows[0];
  return test as ITest;
}

/**
 * Add one test.
 */
async function addOne(test: Partial<ITest>): Promise<number> {
  const data = {
    test_name: test.test_name || '',
    cate_id: test.cate_id || '',
    practitioner_id: test.practitioner_id || null,
    description: test.description || '',
    test_sku: test.test_sku || '',
    test_biomarker: test.test_biomarker || '',
    price: test.price || '',
    discount_type: test.discount_type || '',
    cost: test.cost || '',
    customer_cost: test.customer_cost || '',
  };
  const [result3] = await pool.query<ResultSetHeader>("INSERT INTO tests SET ?", data);
  return result3.insertId;
}

/**
 * Update one test.
 */
async function updateOne(
  id: number,
  test: Record<string, any>
): Promise<boolean> {
  let sql = "UPDATE tests SET ";
  const values = [];
  for (const key in test) {
    const value = test[key];
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
 * Update one test.
 */
async function updateCustomerPrice(
  id: number,
  practitioner_id: number,
  customer_cost: number
): Promise<boolean> {
  let sql = `INSERT INTO tests_cost_by_practitioner (practitioner_id, tests_id, customer_cost)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
      customer_cost = VALUES(customer_cost);`

  const [result] = await pool.query<ResultSetHeader>(sql, [practitioner_id, id, customer_cost]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  return true;
}

/**
 * Update one test.
 */
async function activateDeactivate(
  test_id: number,
  is_active: number,
): Promise<boolean> {
  const sql = `UPDATE tests set status = ? where id = ?`;
  const status = is_active == 1 ? "Active" : "Inactive"
  const [result] = await pool.query<ResultSetHeader>(sql, [status, test_id]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
  }
  return true;
}

/**
 * Delete a test by their id.
 */
async function _delete(testId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>("DELETE FROM tests WHERE id = ?", [testId]);
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error deleting test: " + error);
  }
}

// **** Export default **** //

export default {
  getAll,
  getPractitionerTest,
  getCustomerTest,
  getOne,
  addOne,
  updateOne,
  updateCustomerPrice,
  activateDeactivate,
  delete: _delete,
} as const;
