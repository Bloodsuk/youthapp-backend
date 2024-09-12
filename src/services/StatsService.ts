import { UserLevels } from "@src/constants/enums";
import { ISessionUser } from "@src/interfaces/ISessionUser";
import { pool } from "@src/server";
import moment from "moment";
import { RowDataPacket } from "mysql2";

// **** Functions **** //

/**
 * Get all stats.
 */
async function getAll(sessionUser: ISessionUser) {
  const user_id = sessionUser.id;
  const isAdmin = sessionUser.user_level === UserLevels.Admin;
  const isModerator = sessionUser.user_level === UserLevels.Moderator;
  const isCustomer = sessionUser.user_level === UserLevels.Customer;
  const isPractitioner = sessionUser.user_level === UserLevels.Practitioner;
  const practitioner_id = isPractitioner ? sessionUser.id : sessionUser.practitioner_id;
  let where = '';
  // let clinic_where = '';
  const pending_check = " AND status NOT IN ('Complete', 'Results Published', 'Explanation Published', 'Failed')";
  const complete_check = " AND status IN ('Complete', 'Results Published', 'Explanation Published')";
  const failed_ignore = " AND status !='Failed'";

  if (user_id > 1 && !isAdmin) {
    // a Practitioner
    where = ' AND created_by=' + user_id;
    if (isModerator) {
      // order_placed_by should also be considered
      where = ' AND created_by=' + practitioner_id;
      // clinic_where = ' AND order_placed_by=' + user_id;
    }
  }

  const [active_users_result] = await pool.query<RowDataPacket[]>("SELECT COUNT(id) as active_users FROM users WHERE status = 1");
  const active_users = active_users_result[0]['active_users'] || 0;

  // Get pending users (status = 0)
  const [pending_users_result] = await pool.query<RowDataPacket[]>("SELECT COUNT(id) as pending_users FROM users WHERE status = 0");
  const pending_users =  pending_users_result[0]['pending_users'] || 0;

  let total_customers_sql = "SELECT COUNT(id) as total_customers from customers Where 1"
  if (isPractitioner && practitioner_id) {
    total_customers_sql += " And created_by = " + practitioner_id
  }
  if (isModerator && user_id) {
    const [clinic] = await pool.query<RowDataPacket[]>("SELECT practitioner_id from users Where id = " + user_id)
    const clinic_practitioner_id = clinic?.length ? clinic[0]?.practitioner_id :  0;
    if (clinic_practitioner_id) total_customers_sql += " And created_by = " + clinic_practitioner_id
  }
  const [total_customers] = await pool.query<RowDataPacket[]>(total_customers_sql)
  const customers = total_customers[0]['total_customers'] || 0;

  const [total_tests] = await pool.query<RowDataPacket[]>("SELECT COUNT(id) as total_tests from tests Where 1");
  const tests = total_tests[0]['total_tests'] || 0;
  const total_orders_q = "SELECT COUNT(id) as total_orders from orders Where 1" + where + failed_ignore;
  const [total_orders] = await pool.query<RowDataPacket[]>(total_orders_q);
  const orders =  total_orders[0]['total_orders'] || 0;

  let u_pending_q = "";
  let user_pending_orders: RowDataPacket[];
  let up_orders = 0;
  let u_complete_q = "";
  let user_complete_orders: RowDataPacket[];
  let uc_orders = 0;
  if (!isCustomer) {
    u_pending_q = "SELECT COUNT(id) as total_pending from orders Where 1" + where + pending_check;
    [user_pending_orders] = await pool.query<RowDataPacket[]>(u_pending_q);
    up_orders =  user_pending_orders[0]['total_pending'] || 0;

    u_complete_q = "SELECT COUNT(id) as total_complete from orders Where 1" + where + complete_check;
    [user_complete_orders] = await pool.query<RowDataPacket[]>(u_complete_q);
    uc_orders =  user_complete_orders[0]['total_complete'] || 0;
  } else {
    u_pending_q = "SELECT COUNT(id) as total_pending from orders Where customer_id = " + user_id + pending_check;
    [user_pending_orders] = await pool.query<RowDataPacket[]>(u_pending_q);
    up_orders =  user_pending_orders[0]['total_pending'] || 0;

    u_complete_q = "SELECT COUNT(id) as total_complete from orders Where customer_id = " + user_id + complete_check;
    [user_complete_orders] = await pool.query<RowDataPacket[]>(u_complete_q);
    uc_orders =  user_complete_orders[0]['total_complete'] || 0;
  }

  let cus_active_orders: RowDataPacket[] = [];
  let shipped_active_orders: RowDataPacket[] = [];
  let lab_active_orders: RowDataPacket[] = [];
  let val_active_orders: RowDataPacket[] = [];
  let thisWeek_active_orders: RowDataPacket[] = [];

  if (isCustomer) {
    [cus_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where customer_id = " + user_id + " AND status NOT IN ('Pending Validation', 'Complete', 'Ready', 'Received at the Lab', 'Shipped', 'Results Published', 'Explanation Published', 'Failed')"
    );
    [shipped_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where customer_id = " + user_id + " AND status NOT IN ('Pending Validation', 'Complete', 'Ready', 'Received at the Lab', 'Started', 'Results Published', 'Explanation Published', 'Failed')"
    );
    [lab_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where customer_id = " + user_id + " AND status IN ('Received at the Lab')"
    );
    [val_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where customer_id = " + user_id + " AND status IN ('Pending Validation')"
    );

    // Calculate the timestamp 7 days ago
    const last_week = moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss');
    const thisWeek = "SELECT order_id, status FROM orders WHERE customer_id = " + user_id + " AND created_at >= '" + last_week + "'";

    // Execute the query
    [thisWeek_active_orders]  = await pool.query<RowDataPacket[]>(thisWeek);
  }
  if (!isModerator && !isCustomer && !isAdmin) {
    [cus_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where created_by = " + user_id + " AND status NOT IN ('Pending Validation', 'Complete', 'Ready', 'Received at the Lab', 'Shipped', 'Results Published', 'Explanation Published', 'Failed')"
    );
    [shipped_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where created_by = " + user_id + " AND status NOT IN ('Pending Validation', 'Complete', 'Ready', 'Received at the Lab', 'Started', 'Results Published', 'Explanation Published', 'Failed')"
    );
    [lab_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where created_by = " + user_id + " AND status IN ('Received at the Lab')"
    );
    [val_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where created_by = " + user_id + " AND status IN ('Pending Validation')"
    );

    // Calculate the timestamp 7 days ago
    const last_week = moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss');
    const thisWeek = "SELECT order_id, status FROM orders WHERE created_by = " + user_id + " AND created_at >= '" + last_week + "'";

    // Execute the query
    [thisWeek_active_orders]  = await pool.query<RowDataPacket[]>(thisWeek);
  }
  if (isAdmin) {
    [cus_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where status NOT IN ('Pending Validation', 'Complete', 'Ready', 'Received at the Lab', 'Shipped', 'Results Published', 'Explanation Published', 'Failed')"
    );
    [shipped_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where status NOT IN ('Pending Validation', 'Complete', 'Ready', 'Received at the Lab', 'Started', 'Results Published', 'Explanation Published', 'Failed')"
    );
    [lab_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where status IN ('Received at the Lab')"
    );
    [val_active_orders] = await pool.query<RowDataPacket[]>(
      "SELECT order_id,status from orders where status IN ('Pending Validation')"
    );

    // Calculate the timestamp 7 days ago
    const last_week = moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss');
    const thisWeek = "SELECT order_id, status FROM orders WHERE  created_at >= '" + last_week + "'";

    // Execute the query
    [thisWeek_active_orders]  = await pool.query<RowDataPacket[]>(thisWeek);
  }
  return {
    users: { 
      active_users,
      pending_users
    },
    customers,
    tests,
    orders: {
      pending: up_orders,
      completed: uc_orders,
      total: orders
    },
    results: {
      pending: up_orders,
      completed: uc_orders,
      total: orders
    },
    status_updates: {
      started: cus_active_orders.length,
      shipped: shipped_active_orders.length,
      recieved_at_lab: lab_active_orders.length,
      pending_validation: val_active_orders.length,
      this_week: thisWeek_active_orders.length
    }
  };
}

// **** Export default **** //

export default {
  getAll,
} as const;
