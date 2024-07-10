import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import CouponService from "@src/services/CouponService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import { ICoupon } from "@src/interfaces/ICoupon";

// **** Functions **** //

/**
 * Get all coupons.
 */
async function getAll(req: IReq, res: IRes) {
  const coupons = await CouponService.getAll();
  return res.status(HttpStatusCodes.OK).json({ coupons });
}

/**
 * Get coupon by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const coupon = await CouponService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        coupon: coupon,
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
 * Add one coupon.
 */
async function add(req: IReq<{ coupon: Partial<ICoupon> }>, res: IRes) {
  const { coupon } = req.body;

  const id = await CouponService.addOne(coupon);
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
 * Update one coupon.
 */
async function update(req: IReq<{ coupon: Record<string, any> }>, res: IRes) {
  const { coupon } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await CouponService.updateOne(uid, coupon);
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
 * Delete one coupon.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await CouponService.delete(uid);
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
 * Get coupon discount.
 */
async function getDiscount(req: IReq<{ discount_code: string }>, res: IRes) {
  const { discount_code } = req.body;
  try {
    const { type, value } = await CouponService.getDiscount(discount_code);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        type: type === 1 ? "Percent" : "Fixed",
        value: value,
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

// **** Export default **** //

export default {
  getAll,
  getById,
  add,
  update,
  delete: delete_,
  getDiscount,
} as const;
