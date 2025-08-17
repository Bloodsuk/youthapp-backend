import Paths from "@src/constants/Paths";
import CouponController from "@src/controllers/CouponController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";
import authorization from "@src/middleware/auth.middleware";

const validate = jetValidator();

const couponsRouter = Router();

// Get all couponss
couponsRouter.get(Paths.Coupons.Get, CouponController.getAll);

// Get By Id
couponsRouter.get(Paths.Coupons.GetById, CouponController.getById);

// Add one coupons
couponsRouter.post(Paths.Coupons.Add, CouponController.add);

// Update one coupons
couponsRouter.patch(
  Paths.Coupons.Update,
  // validate(["coupons", isCoupon]),
  CouponController.update
);

// Delete one coupons
couponsRouter.delete(
  Paths.Coupons.Delete,
  // validate(["id", "number", "params"]),
  CouponController.delete
);

// Validate Coupon code and Get Discount rate
couponsRouter.post(
  Paths.Coupons.GetDiscount,
  authorization, // Require authentication
  validate(["discount_code", "string", "body"]),
  CouponController.getDiscount
);

// Get all users who have used a specific coupon
couponsRouter.get(
  Paths.Coupons.GetCouponUsers,
  authorization,
  CouponController.getCouponUsers
);

// Get all coupons used by a specific user
couponsRouter.get(
  Paths.Coupons.GetUserCoupons,
  authorization,
  CouponController.getUserCoupons
);

// Check if a user has used a specific coupon
couponsRouter.get(
  Paths.Coupons.CheckUserUsage,
  authorization,
  CouponController.checkUserCouponUsage
);

export default couponsRouter;
