import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import CustomerService from "@src/services/CustomerService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";

// **** Functions **** //

/**
 * Get all customers.
 */
async function getAll(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";
  const { data, total } = await CustomerService.getAll(res.locals.sessionUser, page, search);
  return res.status(HttpStatusCodes.OK).json({ customers: data, total });
}
/**
 * Get all customers by userId.
 */
async function getByUserId(req: IReq, res: IRes) {
  const userId = parseInt(req.params.userId);
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const { data, total } = await CustomerService.getByUserId(userId, page);
  return res.status(HttpStatusCodes.OK).json({ customers: data, total });
}

/**
 * Get customer by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const customer = await CustomerService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        customer: customer,
      })
      .end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Add one customer.
 */
async function add(req: IReq<{ customer: Record<string, any> }>, res: IRes) {
  const { customer } = req.body;
  try {
    const id = await CustomerService.addOne(customer);
    if (id)
      return res
        .status(HttpStatusCodes.CREATED)
        .json({
          success: true,
          customer: await CustomerService.getOne(id),
        })
        .end();
    else return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }

}

/**
 * Update one customer.
 */
async function update(req: IReq<{ customer: Record<string, any> }>, res: IRes) {
  const { customer } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await CustomerService.updateOne(uid, customer);
    return res.status(HttpStatusCodes.OK).json({ success: true }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}
/**
 * Delete one customer.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await CustomerService.delete(uid);
    return res.status(HttpStatusCodes.OK).json({
      success: true
    }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Send logins to customers.
 */
interface SendLoginsReq {
  customer_id: number;
  password: string;
}
async function sendLogins(
  req: IReq<SendLoginsReq>,
  res: IRes
) {
  const { password, customer_id } = req.body;
  try {
    await CustomerService.sendLogins(password, customer_id);
    return res.status(HttpStatusCodes.OK).json({ success: true }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

// **** Export default **** //

export default {
  getAll,
  getByUserId,
  getById,
  add,
  update,
  delete: delete_,
  sendLogins
} as const;
