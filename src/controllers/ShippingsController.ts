import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import ShippingsService from "@src/services/ShippingsService";
import { IShipping } from "@src/interfaces/IShipping";
import { ISessionUser } from "@src/interfaces/ISessionUser";
import { UserLevels } from "@src/constants/enums";

// **** Functions **** //

/**
 * Get all shipping_types.
 */
async function getAll(req: IReq, res: IRes) {
  const sessionUser = res.locals.sessionUser as ISessionUser | undefined;

  // If any Home Visit or Grimsby Clinic service is selected, shipping is not needed
  const serviceIdsParam = req.query.service_ids as string | undefined;
  const serviceIds = serviceIdsParam
    ? serviceIdsParam.split(",").map(Number)
    : [];
  const NO_SHIPPING_SERVICE_IDS = [2, 5, 6, 11, 12, 13];
  if (serviceIds.some((id) => NO_SHIPPING_SERVICE_IDS.includes(id))) {
    return res
      .status(HttpStatusCodes.OK)
      .json({ shipping_types: [], shipping_blocked: true });
  }

  const HIDDEN_SHIPPING_IDS = [3, 8, 9, 10];

  if (sessionUser?.user_level === UserLevels.Practitioner) {
    const testIdsParam = req.query.test_ids as string | undefined;
    const testIds = testIdsParam
      ? testIdsParam.split(",").map(Number)
      : [];
    const hasProduct319 = testIds.includes(319);
    const shippingIds = [2, hasProduct319 ? 9 : 7];
    const shipping_types = await ShippingsService.getByIds(shippingIds);
    return res.status(HttpStatusCodes.OK).json({ shipping_types });
  }

  const shipping_types = await ShippingsService.getAll();
  return res.status(HttpStatusCodes.OK).json({
    shipping_types: shipping_types.filter(
      (s) => !HIDDEN_SHIPPING_IDS.includes(s.id)
    ),
  });
}

/**
 * Get shipping_type by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const shipping_type = await ShippingsService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        shipping_type: shipping_type,
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
 * Add one shipping_type.
 */
async function add(
  req: IReq<{ shipping_type: Partial<IShipping> }>,
  res: IRes
) {
  const { shipping_type } = req.body;

  const id = await ShippingsService.addOne(shipping_type);
  if (id)
    return res
      .status(HttpStatusCodes.CREATED)
      .json({
        success: true,
        id: id,
      })
      .end();
  else return res.status(HttpStatusCodes.BAD_REQUEST).end();
}

/**
 * Update one shipping_type.
 */
async function update(req: IReq<{ shipping_type: Record<string, any> }>, res: IRes) {
  const { shipping_type } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await ShippingsService.updateOne(uid, shipping_type);
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
 * Delete one shipping_type.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await ShippingsService.delete(uid);
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
  getById,
  add,
  update,
  delete: delete_,
} as const;
