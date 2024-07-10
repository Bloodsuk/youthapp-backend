import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import ShippingsService from "@src/services/ShippingsService";
import { IShipping } from "@src/interfaces/IShipping";

// **** Functions **** //

/**
 * Get all shipping_types.
 */
async function getAll(req: IReq, res: IRes) {
  const shipping_types = await ShippingsService.getAll();
  return res.status(HttpStatusCodes.OK).json({ shipping_types });
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
