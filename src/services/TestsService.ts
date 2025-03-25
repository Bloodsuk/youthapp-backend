import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { ITest } from "@src/interfaces/ITest";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { LIMIT } from "@src/constants/pagination";
import { empty, getTotalCount } from "@src/util/misc";
import { UserLevels } from "@src/constants/enums";

// **** Variables **** //

export const NOT_FOUND_ERR = "Test not found";

// **** Functions **** //

/**
 * Get all tests.
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
  prices?: any
}

async function getAll(page: number = 1, search: string = "", cate_id: string = "", practitioner_id: string = "", user_level: string = ""): Promise<IGetResponse<ITest>> {
  const joinColumns =
    `,
    CONCAT(u1.first_name, ' ', u1.last_name) as practitioner_name,
    tc.customer_cost as practitioner_customer_cost
  `;
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

  if (practitioner_id && !empty(practitioner_id) && user_level == UserLevels.Moderator) {
    searchSql += ` AND tests.practitioner_id = ${practitioner_id}`;
    sql += searchSql;
  }

  sql += ` ORDER BY id DESC ${pagination}`;

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allTests = rows.map((test) => {
    return test as ITest;
  });

  const total = await getTotalCount(pool, 'tests', `WHERE 1 ${searchSql}`);
  const allTestId = [];
  for (const test of allTests) {
    allTestId.push(test.id);
  }
  const sqlForGetPractitionerPrice = `SELECT * FROM practitioner_test_price where test_id in (${allTestId.join(",")})`;
  const [rowsForGetPractitionerPrice] = await pool.query<RowDataPacket[]>(sqlForGetPractitionerPrice);

  return { data: allTests, total, prices: rowsForGetPractitionerPrice };
}

/**
 * INFO: get practitioner test
 * @param practitioner_id 
 * @param page 
 * @param search 
 * @param cate_id
 * @param sort - sorting option ('alpha' for alphabetical, default is by ID)
 * @returns 
 */
async function getPractitionerTest(practitioner_id: number, page: number = 1, search: string = "", cate_id: string = "", sort: string = ""): Promise<IGetResponse<ITest>> {
  const joinColumns =
    ", CONCAT(u1.first_name, ' ', u1.last_name) as practitioner_name, tc.customer_cost as practitioner_customer_cost";
  const join = ` LEFT JOIN users u1 ON (u1.id = tests.practitioner_id)
                 LEFT JOIN tests_cost_by_practitioner tc ON (tc.tests_id = tests.id And tc.practitioner_id = tests.practitioner_id)
                 LEFT JOIN tests_active_deactive tad ON (tad.test_id = tests.id And tad.practitioner_id = tests.practitioner_id)
                 `;

  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  let sql = `
  SELECT 
  tests.id, 
  tests.test_name, 
  tests.cate_id, 
  tests.product_model, 
  tests.test_sku, 
  tests.test_biomarker, 
  tests.product_description, 
  tests.description, 
  tests.procedure, 
  tests.side_effects, 
  tests.price, 
  tests.cost, 
  tests.customer_cost,
  tc.customer_cost AS practitioner_customer_cost, -- Practitioner cost if available, else default
  tests.discount_type, 
  tests.is_featured, 
  tests.product_unit, 
  tests.weights, 
  tests.brand_id, 
  tests.sort_id, 
  (CASE 
     WHEN tad.is_active_for_clinic IS NULL THEN tests.status  -- Default test status if not found
     WHEN tad.is_active_for_clinic = 1 THEN 'Active'
     ELSE 'Inactive' 
  END) AS status, 
  tests.template_type, 
  tests.meta_title, 
  tests.meta_keyword, 
  tests.meta_description, 
  tests.added_on, 
  tests.last_updatedon, 
  tests.added_by, 
  tests.image_url, 
  tests.image_banner, 
  tests.banner_link, 
  tests.prd_type, 
  tests.is_reorder, 
  tests.product_code, 
  tests.add_on_products, 
  tests.is_addon, 
  tests.created_at, 
  tests.practitioner_id,
  u1.id AS cost_set_practitioner_id,
  CONCAT(u1.first_name, ' ', u1.last_name) AS practitioner_name
FROM tests
LEFT JOIN tests_cost_by_practitioner tc ON (tc.tests_id = tests.id AND tc.practitioner_id = ${practitioner_id}) -- Join practitioner test cost
LEFT JOIN tests_active_deactive tad ON (tad.test_id = tests.id AND tad.practitioner_id = ${practitioner_id}) -- Join active/deactive status
LEFT JOIN users u1 ON (u1.id = tc.practitioner_id)  -- Join practitioner user details
WHERE 
  (tests.practitioner_id IS NULL OR tests.practitioner_id = 0 OR tests.practitioner_id = ${practitioner_id}) -- Use customer's created_by as practitioner_id

`;
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

  // Determine sorting order - alphabetical or default by ID
  const sortOrder = sort === 'alpha' ? 'ORDER BY tests.test_name ASC' : 'ORDER BY id DESC';

  sql += ` group by tests.id ${sortOrder} ${pagination}`;
  console.log("sql ----------- ", sql);

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
async function getCustomerTest(customer_id: number, page: number = 1, search: string = "", cate_id: string = "", practitioner_id: number = 0, sort: string = ""): Promise<IGetResponse<ITest>> {
  const joinColumns =
    ", CONCAT(u1.first_name, ' ', u1.last_name) as practitioner_name, tc.customer_cost as practitioner_customer_cost";
  const join = ` LEFT JOIN users u1 ON (u1.id = tests.practitioner_id)
                 LEFT JOIN tests_cost_by_practitioner tc ON (tc.tests_id = tests.id And tc.practitioner_id = tests.practitioner_id)
                 LEFT JOIN tests_active_deactive tad ON (tad.test_id = tests.id And tad.practitioner_id = tests.practitioner_id) 
                 LEFT JOIN customers c ON (c.created_by = tests.practitioner_id)`;

  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;
  // (CASE When tc.customer_cost IS Not NULL then tc.customer_cost When tc.customer_cost = 0
  //   then tests.cost Else tests.cost end) as practitioner_customer_cost
  console.log("practitioner_id ---------- ", practitioner_id);

  let sql = `
  SELECT 
  tests.id, 
  tests.test_name, 
  tests.cate_id, 
  tests.product_model, 
  tests.test_sku, 
  tests.test_biomarker, 
  tests.product_description, 
  tests.description, 
  tests.procedure, 
  tests.side_effects, 
  tests.price, 
  tests.cost, 
  tests.customer_cost,
  tc.customer_cost AS practitioner_customer_cost, -- Practitioner cost if available, else default
  tests.discount_type, 
  tests.is_featured, 
  tests.product_unit, 
  tests.weights, 
  tests.brand_id, 
  tests.sort_id, 
  (CASE 
     WHEN tad.is_active_for_clinic IS NULL THEN tests.status  -- Default test status if not found
     WHEN tad.is_active_for_clinic = 1 THEN 'Active'
     ELSE 'Inactive' 
  END) AS status, 
  tests.template_type, 
  tests.meta_title, 
  tests.meta_keyword, 
  tests.meta_description, 
  tests.added_on, 
  tests.last_updatedon, 
  tests.added_by, 
  tests.image_url, 
  tests.image_banner, 
  tests.banner_link, 
  tests.prd_type, 
  tests.is_reorder, 
  tests.product_code, 
  tests.add_on_products, 
  tests.is_addon, 
  tests.created_at, 
  tests.practitioner_id,
  u1.id AS cost_set_practitioner_id,
  CONCAT(u1.first_name, ' ', u1.last_name) AS practitioner_name
FROM tests
LEFT JOIN customers c ON (c.id = ${customer_id})  -- Join customer details
LEFT JOIN tests_cost_by_practitioner tc ON (tc.tests_id = tests.id AND tc.practitioner_id = ${practitioner_id}) -- Join practitioner test cost
LEFT JOIN tests_active_deactive tad ON (tad.test_id = tests.id AND tad.practitioner_id = ${practitioner_id}) -- Join active/deactive status
LEFT JOIN users u1 ON (u1.id = tc.practitioner_id)  -- Join practitioner user details
WHERE 
  (tests.practitioner_id IS NULL OR tests.practitioner_id = 0 OR tests.practitioner_id = ${practitioner_id}) -- Use customer's created_by as practitioner_id
`;
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

  const sortOrder = sort === 'alpha' ? 'ORDER BY tests.test_name ASC' : 'ORDER BY id DESC';
  sql += ` group by tests.id ${sortOrder} ${pagination}`;

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
  // Get the test details
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
  const test_id = result3.insertId;

  if (test_id && test.practitioner_prices && test.practitioner_prices.length > 0) {
    for (const item of test.practitioner_prices) {
      // insert data into practitioner_test_price table
      const data = {
        practitioner_id: item.practitioner_id,
        price: item.price,
        test_id: test_id
      };

      await pool.query<ResultSetHeader>("INSERT INTO practitioner_test_price SET ?", data);
    }
  }
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

  // now update practitioner test prices, so first delete all existing prices and create the new one
  await pool.query<ResultSetHeader>("DELETE FROM practitioner_test_price WHERE test_id = ?", [id]);
  for (const item of test.practitioner_prices) {
    const data = {
      practitioner_id: item.practitioner_id,
      price: item.price,
      test_id: id
    };

    await pool.query<ResultSetHeader>("INSERT INTO practitioner_test_price SET ?", data);
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
  practitioner_id: number,
): Promise<boolean> {
  if (practitioner_id) {
    const sql = `INSERT INTO tests_active_deactive (is_active_for_clinic, test_id, practitioner_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        is_active_for_clinic = VALUES(is_active_for_clinic);`
    const [result] = await pool.query<ResultSetHeader>(sql, [is_active, test_id, practitioner_id]);

    if (result.affectedRows === 0) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
    }
  } else {
    const sql = `UPDATE tests set status = ? where id = ?`;
    const status = is_active == 1 ? "Active" : "Inactive"
    const [result] = await pool.query<ResultSetHeader>(sql, [status, test_id]);
    if (result.affectedRows === 0) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, NOT_FOUND_ERR);
    }
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
