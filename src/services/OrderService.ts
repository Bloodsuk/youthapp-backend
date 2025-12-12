import mysql from "mysql2/promise";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IOrder } from "@src/interfaces/IOrder";
import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { ISessionUser } from "@src/interfaces/ISessionUser";
import { UserLevels } from "@src/constants/enums";
import { empty, getTotalCount } from "@src/util/misc";
import { ICustomer } from "@src/interfaces/ICustomer";
import MailService from "./MailService";
import { LIMIT } from "@src/constants/pagination";
import { IPractitionerCommission } from "@src/interfaces/IPractitionerCommission";
import { IBooking } from "@src/interfaces/IBooking";
import PhlebBookingService from "./PhlebBookingService";

// **** Variables **** //

export const USER_NOT_FOUND_ERR = "Order not found";
export const INVALID_PAID_STATUS = "Invalid request, Commission paid status should be only paid or unpaid";

// **** Functions **** //

/**
 * Get all orders.
 */
interface IGetResponse<T> {
  data: T[];
  total: number;
}

async function getAll(
  sessionUser: ISessionUser | undefined,
  client_name?: string,
  search?: string,
  status?: string,
  shipping_type?: string,
  service?: string,
  page: number = 1
): Promise<IGetResponse<IOrder>> {
  page = page ? page : 1
  const user_id = sessionUser?.id;
  const user_level = sessionUser?.user_level;
  const practitioner_id = sessionUser?.practitioner_id;
  const whereClauses = ["1"];
  const params: any[] = [];

  if (user_id && user_id > 1) {
    if (user_level === UserLevels.Moderator) {
      whereClauses.push("orders.created_by = ?");
      params.push(practitioner_id);
    } else if (user_level === UserLevels.Customer) {
      whereClauses.push("orders.customer_id = ?");
      params.push(user_id);
    } else if (user_level === UserLevels.Practitioner) {
      whereClauses.push(
        "(orders.created_by = ? OR orders.practitioner_id = ?)"
      );
      params.push(user_id, user_id);
    } else {
      whereClauses.push("orders.created_by = ?");
      params.push(user_id);
    }
  }

  if (status && !empty(status)) {
    if (status === "Results Published" || status === "Result Published") {
      whereClauses.push("orders.status IN ('Results Published', 'Result Published')");
    } else if (status === "Received at the Lab" || status === "Received at Lab") {
      whereClauses.push("orders.status IN ('Received at Lab', 'Received at the Lab')");
    } else {
      whereClauses.push("orders.status = ?");
      params.push(status);
    }
  } else {
    whereClauses.push("orders.status != 'Failed'");
  }

  if (shipping_type && !empty(shipping_type)) {
    whereClauses.push("orders.shipping_type = ?");
    params.push(shipping_type);
  }

  if (service && !empty(service)) {
    whereClauses.push("orders.other_charges = ?");
    params.push(service);
  }

  // if (report && !empty(report)) {
  //   if (report === "Uploaded") {
  //     whereClauses.push("orders.attachment IS NOT NULL");
  //   } else {
  //     whereClauses.push("orders.attachment IS NULL");
  //   }
  // }

  // if (billing && !empty(billing)) {
  //   whereClauses.push("orders.checkout_type = ?");
  //   params.push(billing);
  // }

  if (search && !empty(search)) {
    whereClauses.push("(orders.client_name LIKE ? OR orders.client_id LIKE ?)");
    params.push(`%${search}%`);
    params.push(`%${search}%`);
  }
  if (client_name && !empty(client_name)) {
    whereClauses.push("(orders.client_name LIKE ? OR orders.client_id LIKE ?)");
    params.push(`%${client_name}%`);
    params.push(`%${client_name}%`);
  }

  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  const sql = `
    SELECT 
      orders.*, 
      customers.id AS customer_id,
      customers.fore_name AS customer_fore_name,
      customers.sur_name AS customer_sur_name,
      customers.email AS customer_email, 
      customers.date_of_birth AS customer_date_of_birth, 
      users.id AS practitioner_id,
      users.first_name AS practitioner_first_name,
      users.last_name AS practitioner_last_name,
      users.email AS practitioner_email,
      customer_phleb_bookings.id AS phleb_booking_id,
      customer_phleb_bookings.slot_times AS phleb_slot_times,
      customer_phleb_bookings.price AS phleb_price,
      customer_phleb_bookings.weekend_surcharge AS phleb_weekend_surcharge,
      customer_phleb_bookings.zone AS phleb_zone,
      customer_phleb_bookings.shift_type AS phleb_shift_type,
      customer_phleb_bookings.availability AS phleb_availability,
      customer_phleb_bookings.additional_preferences AS phleb_additional_preferences,
      customer_phleb_bookings.created_at AS phleb_created_at
    FROM orders 
    LEFT JOIN customers ON orders.customer_id = customers.id 
    LEFT JOIN users ON orders.created_by = users.id
    LEFT JOIN customer_phleb_bookings ON orders.id = customer_phleb_bookings.order_id
    WHERE ${whereClauses.join(" AND ")} 
    ORDER BY orders.id DESC 
    ${pagination}
  `;
  console.log(sql);
  console.log(params);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  const allOrders = rows.map((order) => {
    const orderData = {
      ...order,
      test_ids: order.test_ids,
      practitioner_id: order.practitioner_id,
    } as IOrder;
    
    // Add phleb booking if it exists
    if (order.phleb_booking_id) {
      orderData.phleb_booking = {
        id: order.phleb_booking_id,
        order_id: order.id,
        slot_times: order.phleb_slot_times,
        price: order.phleb_price,
        weekend_surcharge: order.phleb_weekend_surcharge,
        zone: order.phleb_zone,
        shift_type: order.phleb_shift_type,
        availability: order.phleb_availability,
        additional_preferences: order.phleb_additional_preferences,
        created_at: order.phleb_created_at,
      };
    }
    
    return orderData;
  });
  console.log(rows[0], "rows");
  const totalSql = `
    SELECT COUNT(*) as count
    FROM orders 
    LEFT JOIN customers ON orders.customer_id = customers.id 
    WHERE ${whereClauses.join(" AND ")}
  `;
  const [totalResult] = await pool.query<RowDataPacket[]>(totalSql, params);
  const total = totalResult[0].count;

  return {
    data: allOrders,
    total,
  };
}

/**
 * INFO: Get customer orders by customer Id.
 */
async function getAllCustomerOrder(
  customer_id: number,
  search?: string,
  status?: string,
  shipping_type?: string,
  service?: string,
  page: number = 1
): Promise<IGetResponse<IOrder>> {
  const whereClauses = ["1"];
  const params: any[] = [];

  whereClauses.push("orders.customer_id = ?");
  params.push(customer_id);

  if (status && !empty(status)) {
    if (status === "Results Published" || status === "Result Published") {
      whereClauses.push("orders.status IN ('Results Published', 'Result Published')");
    } else if (status === "Received at the Lab" || status === "Received at Lab") {
      whereClauses.push("orders.status IN ('Received at Lab', 'Received at the Lab')");
    } else {
      whereClauses.push("orders.status = ?");
      params.push(status);
    }
  } else {
    whereClauses.push("orders.status != 'Failed'");
  }

  if (shipping_type && !empty(shipping_type)) {
    whereClauses.push("orders.shipping_type = ?");
    params.push(shipping_type);
  }

  if (service && !empty(service)) {
    whereClauses.push("orders.other_charges = ?");
    params.push(service);
  }

  if (search && !empty(search)) {
    whereClauses.push("client_name LIKE ?");
    params.push(`%${search}%`);
  }

  const pagination = `LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}`;

  const sql = `
    SELECT 
      orders.*, 
      customers.id AS customer_id,
      customers.fore_name AS customer_fore_name,
      customers.sur_name AS customer_sur_name,
      customers.email AS customer_email, 
      users.id AS practitioner_id,
      users.first_name AS practitioner_first_name,
      users.last_name AS practitioner_last_name,
      users.email AS practitioner_email,
      customer_phleb_bookings.id AS phleb_booking_id,
      customer_phleb_bookings.slot_times AS phleb_slot_times,
      customer_phleb_bookings.price AS phleb_price,
      customer_phleb_bookings.weekend_surcharge AS phleb_weekend_surcharge,
      customer_phleb_bookings.zone AS phleb_zone,
      customer_phleb_bookings.shift_type AS phleb_shift_type,
      customer_phleb_bookings.availability AS phleb_availability,
      customer_phleb_bookings.additional_preferences AS phleb_additional_preferences,
      customer_phleb_bookings.created_at AS phleb_created_at
    FROM orders 
    LEFT JOIN customers ON orders.customer_id = customers.id 
    LEFT JOIN users ON orders.created_by = users.id
    LEFT JOIN customer_phleb_bookings ON orders.id = customer_phleb_bookings.order_id
    WHERE ${whereClauses.join(" AND ")} 
    ORDER BY orders.id DESC 
    ${pagination}
  `;
  console.log(sql);
  console.log(params);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  const allOrders = rows.map((order) => {
    const orderData = {
      ...order,
      test_ids: order.test_ids,
      practitioner_id: order.practitioner_id,
    } as IOrder;
    
    // Add phleb booking if it exists
    if (order.phleb_booking_id) {
      orderData.phleb_booking = {
        id: order.phleb_booking_id,
        order_id: order.id,
        slot_times: order.phleb_slot_times,
        price: order.phleb_price,
        weekend_surcharge: order.phleb_weekend_surcharge,
        zone: order.phleb_zone,
        shift_type: order.phleb_shift_type,
        availability: order.phleb_availability,
        additional_preferences: order.phleb_additional_preferences,
        created_at: order.phleb_created_at,
      };
    }
    
    return orderData;
  });
  const totalSql = `
    SELECT COUNT(*) as count
    FROM orders 
    LEFT JOIN customers ON orders.customer_id = customers.id 
    WHERE ${whereClauses.join(" AND ")}
  `;
  const [totalResult] = await pool.query<RowDataPacket[]>(totalSql, params);
  const total = totalResult[0].count;

  return {
    data: allOrders,
    total,
  };
}

/**
 * INFO: Get outstanding credit orders
 * @param page 
 * @returns 
 */
async function getOutstandingCreditOrders(
  page: number = 1
): Promise<IGetResponse<IOrder>> {
  const sql = `
  SELECT 
    orders.*, 
    customers.id AS customer_id,
    customers.fore_name AS customer_fore_name,
    customers.sur_name AS customer_sur_name,
    customers.email AS customer_email, 
    users.id AS practitioner_id,
    users.first_name AS practitioner_first_name,
    users.last_name AS practitioner_last_name,
    users.email AS practitioner_email,
    customer_phleb_bookings.id AS phleb_booking_id,
    customer_phleb_bookings.slot_times AS phleb_slot_times,
    customer_phleb_bookings.price AS phleb_price,
    customer_phleb_bookings.weekend_surcharge AS phleb_weekend_surcharge,
    customer_phleb_bookings.zone AS phleb_zone,
    customer_phleb_bookings.shift_type AS phleb_shift_type,
    customer_phleb_bookings.availability AS phleb_availability,
    customer_phleb_bookings.additional_preferences AS phleb_additional_preferences,
    customer_phleb_bookings.created_at AS phleb_created_at
  FROM orders 
  LEFT JOIN customers ON orders.customer_id = customers.id 
  LEFT JOIN users ON orders.practitioner_id = users.id
  LEFT JOIN customer_phleb_bookings ON orders.id = customer_phleb_bookings.order_id
  WHERE payment_status = 'Pending' AND checkout_type='Credit'
  ORDER BY orders.id DESC 
  LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}
`;
  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allOrders = rows.map((order) => {
    const orderData = {
      ...order,
      test_ids: order.test_ids,
      practitioner_id: order.practitioner_id,
    } as IOrder;
    
    // Add phleb booking if it exists
    if (order.phleb_booking_id) {
      orderData.phleb_booking = {
        id: order.phleb_booking_id,
        order_id: order.id,
        slot_times: order.phleb_slot_times,
        price: order.phleb_price,
        weekend_surcharge: order.phleb_weekend_surcharge,
        zone: order.phleb_zone,
        shift_type: order.phleb_shift_type,
        availability: order.phleb_availability,
        additional_preferences: order.phleb_additional_preferences,
        created_at: order.phleb_created_at,
      };
    }
    
    return orderData;
  });
  const total = await getTotalCount(
    pool,
    "orders",
    "WHERE payment_status = 'Pending' AND checkout_type='Credit'"
  );
  return {
    data: allOrders,
    total,
  };
}

/**
 * INFO: Get order for Practitioner so that they can see that from which order they got the commission and from which order commission is pending
 * @param page 
 * @returns 
 */
async function getPractitionersCommission(
  page: number = 1,
  paid_status: string = "",
  search: string = "",
  practitioner_id: number | undefined
): Promise<IGetResponse<IPractitionerCommission>> {
  if (paid_status && !["unpaid", "paid"].includes(paid_status?.toLowerCase())) {
    throw new RouteError(HttpStatusCodes.CONFLICT, INVALID_PAID_STATUS);
  }
  let where = " 1 "
  if (practitioner_id) {
    where += ` AND practitioner_commission.practitioner_id = ${practitioner_id} `
  }

  if (paid_status?.toLowerCase() == "paid") {
    where += ` AND is_paid = 1 `
  }
  if (paid_status?.toLowerCase() == "unpaid") {
    where += ` AND is_paid = 0 `
  }
  // if (search && !empty(search)) {
  //   if (search.split(" ").length >= 2) {
  //     const [first_name, last_name] = search.split(" ");
  //     where += ` AND (first_name LIKE '%${first_name}%' AND last_name LIKE '%${last_name}%')`;
  //   } else
  //     where += ` AND (email LIKE '%${search}%' OR username LIKE '%${search}%' OR first_name LIKE '%${search}%' OR last_name LIKE '%${search}%')`;
  // }
  const sql = `
  SELECT 
    practitioner_commission.*, 
    users.id AS practitioner_id,
    users.first_name AS practitioner_first_name,
    users.last_name AS practitioner_last_name,
    users.email AS practitioner_email
  FROM practitioner_commission 
  LEFT JOIN users ON practitioner_commission.practitioner_id = users.id
  WHERE ${where}
  ORDER BY practitioner_commission.created_at DESC 
  LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}
`;
  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allOrders = rows.map((order) => {
    return {
      ...order
    } as IPractitionerCommission;
  });
  const total = await getTotalCount(
    pool,
    "practitioner_commission",
    `WHERE ${where}`
  );
  return {
    data: allOrders,
    total,
  };
}

/**
 * INFO: Get loggedin Practitioners Commission
 * @param page 
 * @returns 
 */
async function getPractitionerOutstandingCredits(
  page: number = 1,
  paid_status: string = "",
  search: string = "",
  practitioner_id: number
): Promise<IGetResponse<IPractitionerCommission>> {
  if (paid_status && !["unpaid", "paid"].includes(paid_status?.toLowerCase())) {
    throw new RouteError(HttpStatusCodes.CONFLICT, INVALID_PAID_STATUS);
  }
  let where = ` practitioner_commission.practitioner_id = ${practitioner_id} `
  if (paid_status?.toLowerCase() == "paid") {
    where += ` And is_paid = 1 `
  }
  if (paid_status?.toLowerCase() == "unpaid") {
    where += ` And is_paid = 0 `
  }
  if (search && !empty(search)) {
    where += ` AND (tests.test_name LIKE '%${search}%' OR orders.client_name LIKE '%${search}%' OR practitioner_commission.order_id LIKE '%${search}%')`;
  }
  const sql = `
  SELECT 
    practitioner_commission.*, 
    users.id AS practitioner_id,
    users.first_name AS practitioner_first_name,
    users.last_name AS practitioner_last_name,
    users.email AS practitioner_email,
    orders.client_id,
    orders.client_name,
    orders.created_at as order_date,
    tests.test_name,
    tests.test_sku
  FROM practitioner_commission 
  LEFT JOIN users ON practitioner_commission.practitioner_id = users.id
  LEFT JOIN orders ON practitioner_commission.order_id = orders.id
  LEFT JOIN tests ON FIND_IN_SET(tests.id, orders.test_ids)
  WHERE ${where}
  ORDER BY practitioner_commission.created_at DESC 
  LIMIT ${LIMIT} OFFSET ${LIMIT * (page - 1)}
`;
  const [rows] = await pool.query<RowDataPacket[]>(sql);
  const allOrders = rows.map((order) => {
    return {
      ...order
    } as IPractitionerCommission;
  });
  const total = await getTotalCount(
    pool,
    "practitioner_commission",
    `WHERE ${where}`
  );
  return {
    data: allOrders,
    total,
  };
}

/**
 * Get one order.
 */
async function getOneForTestAndCustomer(customerId: number, testId: number): Promise<IOrder> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM orders WHERE customer_id = ? AND FIND_IN_SET(?, test_ids)",
    [customerId, testId]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  const order = rows[0] as IOrder;
  if (order.customer_id) {
    const [rows2] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM customers WHERE id = ?",
      [order.customer_id]
    );
    if (rows2.length > 0) {
      order.customer = rows2[0] as ICustomer;
    }
  }
  return order;
}

/**
 * Get one order.
 */
async function getOne(id: number): Promise<IOrder> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM orders WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  const order = rows[0] as IOrder;
  if (order.customer_id) {
    const [rows2] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM customers WHERE id = ?",
      [order.customer_id]
    );
    if (rows2.length > 0) {
      order.customer = rows2[0] as ICustomer;
    }
  }
  
  // Fetch phleb booking if it exists
  const phlebBooking = await PhlebBookingService.getBookingByOrderId(id);
  if (phlebBooking) {
    order.phleb_booking = phlebBooking;
  }
  
  return order;
}

/**
 * Add one order.
 */
async function addOne(order: Record<string, any>, booking: Record<string, any>): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO orders SET ?",
    order
  );
  if (result.insertId) {
    await pool.query("INSERT INTO order_logs(order_id, status) VALUES(?,?)", [
      order.order_id,
      "Started",
    ]);
    await pool.query(
      `UPDATE users SET credit_balance = credit_balance + ${order.total_val} WHERE id=${order.created_by}`
    );
    await pool.query(
      `UPDATE users SET total_credit_balance = total_credit_balance - ${order.total_val} WHERE id=${order.created_by}`
    );

    if (booking && booking.booking_date && booking.booking_time) {

      // booking_date	booking_time	order_id	user_id	date_created
      const bookingData = {
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        order_id: order.order_id,
        user_id: order.customer_id,
      }

      await pool.query<ResultSetHeader>("INSERT INTO bookings_listing SET ?", bookingData);
    }

  }
  return result.insertId;
}

/**
 * Update one order.
 */
async function updateOne(
  id: number,
  order: Record<string, any>
): Promise<boolean> {
  const sql = "UPDATE orders SET name = ? WHERE id = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [order.name, id]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  return true;
}
/**
 * Update one order.
 */
async function updateStatus(id: number, status: string): Promise<boolean> {
  const sql = "UPDATE orders SET status = ? WHERE id = ?";
  const [result] = await pool.query<ResultSetHeader>(sql, [status, id]);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  await pool.query<ResultSetHeader>("INSERT INTO order_logs SET ?", {
    order_id: id,
    status,
  });

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT customer_id FROM orders WHERE id = ?",
    [id]
  );
  if (rows.length > 0) {
    const customer_id = rows[0].customer_id;
    const [rows2] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM customers WHERE id = ?`,
      [customer_id]
    );
    if (rows2.length > 0) {
      const customer = rows2[0] as ICustomer;
      const created_by = customer.created_by;
      const [rows3] = await pool.query<RowDataPacket[]>(
        `SELECT email FROM users WHERE id = ?`,
        [created_by]
      );
      if (rows3.length > 0) {
        const user = rows3[0];
        const email = user.email as string;
        const username = customer.fore_name + " " + customer.sur_name;
        await MailService.sendUserOrderStatusEmail(email, username);
      }
    }
  }
  return true;
}

/**
 * Update payment status (and optionally transaction id).
 */
async function updatePaymentStatus(
  id: number,
  payment_status: string,
  transaction_id?: string
): Promise<boolean> {
  const sets = ["payment_status = ?"];
  const values: (string | number)[] = [payment_status];
  if (transaction_id !== undefined) {
    sets.push("transaction_id = ?");
    values.push(transaction_id);
  }
  values.push(id);
  const sql = `UPDATE orders SET ${sets.join(", ")} WHERE id = ?`;
  const [result] = await pool.query<ResultSetHeader>(sql, values);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  return true;
}

async function updatePaymentFields(
  id: number,
  fields: Record<string, any>
): Promise<boolean> {
  const entries = Object.entries(fields);
  if (!entries.length) {
    return true;
  }
  const sets = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  values.push(id);
  const sql = `UPDATE orders SET ${sets} WHERE id = ?`;
  const [result] = await pool.query<ResultSetHeader>(sql, values);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  return true;
}

/**
 * Delete a order by their id.
 */
async function _delete(orderId: number): Promise<void> {
  try {
    await pool.query<ResultSetHeader>("DELETE FROM orders WHERE id = ?", [
      orderId,
    ]);
  } catch (error) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Error deleting order: " + error
    );
  }
}

/**
 * Update payment_status to 'Paid'.
 */
async function markPaid(order_ids: number[]): Promise<boolean> {
  let where = "";
  if (order_ids.length === 1) where = `where id = ${order_ids[0]}`;
  else where = `where id IN (${mysql.format(order_ids.join(","))})`;
  const sql = `UPDATE orders set payment_status = 'Paid' ${where}`;
  console.log(sql);

  const [result] = await pool.query<ResultSetHeader>(sql);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  // Add transaction
  for (const order_id of order_ids) {
    const data = {
      response: "Admin cleared outstanding credit order",
      status: 1,
      order_id,
    };
    await pool.query<ResultSetHeader>("INSERT INTO transactions SET ?", data);
  }
  return true;
}

/**
 * INFO: marked as Paid for Practitioners Commission
 * @param order_ids 
 * @returns 
 */
async function markPaidPractitionersCommission(commission_ids: number[]): Promise<boolean> {
  for (let idx of commission_ids) {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM practitioner_commission WHERE id = ?`, [idx]);
    if (rows.length > 0) {
      const commission_data = rows[0]
      const sql = `UPDATE users set total_credit_balance = total_credit_balance + ${commission_data.commission_amount} where id = ${commission_data.practitioner_id}`;
      const [result] = await pool.query<ResultSetHeader>(sql);
    }
  }
  let where = "";
  if (commission_ids.length === 1) where = `where id = ${commission_ids[0]}`;
  else where = `where id IN (${mysql.format(commission_ids.join(","))})`;
  const sql = `UPDATE practitioner_commission set is_paid = 1 ${where}`;

  const [result] = await pool.query<ResultSetHeader>(sql);
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_NOT_FOUND_ERR);
  }
  return true;
}

async function getBookedTimeSlots(
  date: string,
): Promise<IGetResponse<IBooking>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM bookings_listing WHERE booking_date = ?",
    [date]
  );
  return {
    data: rows.map((row) => row as IBooking),
    total: rows.length,
  };
}

async function getBookingDetails(
  order_id: string,
): Promise<IGetResponse<IBooking>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM bookings_listing WHERE order_id = ?",
    [order_id]
  );
  return {
    data: rows.map((row) => row as IBooking),
    total: rows.length,
  };
}

/**
 * Get order IDs with status "Started" (Admin only)
 */
async function getOrderIdsWithStartedStatus(): Promise<{ id: number; customer_name: string }[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      orders.id,
      COALESCE(CONCAT(customers.fore_name, ' ', customers.sur_name), orders.client_name, '') AS customer_name
    FROM orders 
    LEFT JOIN customers ON orders.customer_id = customers.id
    WHERE (
        FIND_IN_SET('2', orders.other_charges) > 0
      )
      AND COALESCE(orders.is_job_assigned, 0) = 0
    ORDER BY orders.id DESC`
  );
  return rows.map((row) => ({ 
    id: row.id, 
    customer_name: row.customer_name || '' 
  })) as { id: number; customer_name: string }[];
}

// **** Export default **** //

export default {
  getAll,
  getAllCustomerOrder,
  getOutstandingCreditOrders,
  getPractitionerOutstandingCredits,
  getPractitionersCommission,
  getOne,
  addOne,
  updateStatus,
  updatePaymentStatus,
  updatePaymentFields,
  updateOne,
  delete: _delete,
  markPaid,
  markPaidPractitionersCommission,
  getBookedTimeSlots,
  getBookingDetails,
  getOneForTestAndCustomer,
  getOrderIdsWithStartedStatus,
} as const;
