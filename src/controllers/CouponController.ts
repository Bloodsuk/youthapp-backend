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
async function getDiscount(req: IReq<{ discount_code: string; userData?: any }>, res: IRes) {
  const { discount_code, userData } = req.body;
  
  try {
    // Validate coupon without consuming it
    const { type, value, apply_on } = await CouponService.validateCoupon(discount_code);
    
    return res
      .status(HttpStatusCodes.OK)
      .json({
        type: type === 1 ? "Percent" : "Fixed",
        value: value,
        apply_on: apply_on,
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
 * Get all users who have used a specific coupon
 */
async function getCouponUsers(req: IReq, res: IRes) {
  const coupon_id = req.params.coupon_id;
  try {
    const users = await CouponService.getCouponUsers(coupon_id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        coupon_id,
        users,
        count: users.length
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
 * Get all coupons used by a specific user
 */
async function getUserCoupons(req: IReq, res: IRes) {
  const user_id = parseInt(req.params.user_id);
  try {
    const coupons = await CouponService.getUserCoupons(user_id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        user_id,
        coupons,
        count: coupons.length
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
 * Check how many times a user has used a specific coupon
 */
async function checkUserCouponUsage(req: IReq, res: IRes) {
  const user_id = parseInt(req.params.user_id);
  const coupon_id = req.params.coupon_id;
  try {
    const usageCount = await CouponService.getUserCouponUsageCount(user_id, coupon_id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        user_id,
        coupon_id,
        usage_count: usageCount
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
  getCouponUsers,
  getUserCoupons,
  checkUserCouponUsage,
} as const;
