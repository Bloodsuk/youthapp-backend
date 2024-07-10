import Paths from "@src/constants/Paths";
import ShippingsController from "@src/controllers/ShippingsController";
import { Router } from "express";
// import jetValidator from "jet-validator/lib/jet-validator";

// const validate = jetValidator();

const shippingsRouter = Router();

// Get all shippingss
shippingsRouter.get(Paths.Shippings.Get, ShippingsController.getAll);

// Get By Id
shippingsRouter.get(Paths.Shippings.GetById, ShippingsController.getById);

// Add one shippings
shippingsRouter.post(Paths.Shippings.Add, ShippingsController.add);

// Update one shippings
shippingsRouter.patch(
  Paths.Shippings.Update,
  // validate(["shippings", isCoupon]),
  ShippingsController.update
);

// Delete one shippings
shippingsRouter.delete(
  Paths.Shippings.Delete,
  // validate(["id", "number", "params"]),
  ShippingsController.delete
);

export default shippingsRouter;
