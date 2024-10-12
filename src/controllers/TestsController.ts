import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import TestService from "@src/services/TestsService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import { ITest } from "@src/interfaces/ITest";
import { UserLevels } from "@src/constants/enums";

// **** Functions **** //

/**
 * Get all tests.
 */
async function getAll(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";
  const cate_id = (req.query.cate_id as string) || "";
  const { data, total } = await TestService.getAll(page, search, cate_id);
  return res.status(HttpStatusCodes.OK).json({ tests: data, total });
}

/**
 * Get all practitioner tests.
 */
async function getPractitionerTest(req: IReq, res: IRes) {
  const practitioner_id = parseInt(req.params.practitioner_id);
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";
  const cate_id = (req.query.cate_id as string) || "";
  const { data, total } = await TestService.getPractitionerTest(practitioner_id, page, search, cate_id);
  return res.status(HttpStatusCodes.OK).json({ tests: data, total });
}

/**
 * Get all customer tests.
 */
async function getCustomerTest(req: IReq, res: IRes) {
  const customer_id = parseInt(req.params.customer_id);
  const practitioner_id = parseInt(req.params.practitioner_id);
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";
  const cate_id = (req.query.cate_id as string) || "";
  const { data, total } = await TestService.getCustomerTest(customer_id, page, search, cate_id, practitioner_id);
  return res.status(HttpStatusCodes.OK).json({ tests: data, total });
}

/**
 * Get test by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const test = await TestService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        test: test,
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
 * Add one test.
 */
async function add(req: IReq<{ test: Partial<ITest> }>, res: IRes) {
  const { test } = req.body;

  const id = await TestService.addOne(test);
  if (id)
    return res
      .status(HttpStatusCodes.CREATED)
      .json({
        success: true,
        id: id
      })
      .end();
  else return res.status(HttpStatusCodes.BAD_REQUEST).end();
}

/**
 * Update one test.
 */
async function update(req: IReq<{ test: Record<string, any> }>, res: IRes) {
  const { test } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await TestService.updateOne(uid, test);
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
 * Update one test.
 */
async function updateCustomerPrice(req: IReq<{ practitioner_id: number, customer_cost: number }>, res: IRes) {
  const { practitioner_id, customer_cost } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await TestService.updateCustomerPrice(uid, practitioner_id, customer_cost);
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
 * Activate/Deactivate one test.
 */
async function activateDeactivate(req: IReq<{ test_id: number, is_active: number, practitioner_id: number }>, res: IRes) {
  const { test_id, is_active, practitioner_id = 0 } = req.body;
  const user_level = res.locals.sessionUser?.user_level;
  if (
    user_level !== UserLevels.Admin &&
    user_level !== UserLevels.Practitioner
  ) {
    return res
      .status(HttpStatusCodes.FORBIDDEN)
      .json({
        success: false,
        error: "You are not authorized to perform this operation",
      })
      .end();
  }

  try {
    await TestService.activateDeactivate(test_id, is_active, practitioner_id);
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
 * Delete one test.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await TestService.delete(uid);
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

// **** Export default **** //

export default {
  getAll,
  getPractitionerTest,
  getCustomerTest,
  getById,
  add,
  update,
  updateCustomerPrice,
  activateDeactivate,
  delete: delete_,
} as const;
