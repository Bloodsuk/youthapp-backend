import Paths from "@src/constants/Paths";
import ServicesController from "@src/controllers/ServicesController";
import { Router } from "express";
// import jetValidator from "jet-validator/lib/jet-validator";

// const validate = jetValidator();

const servicesRouter = Router();

// Get all servicess
servicesRouter.get(Paths.Coupons.Get, ServicesController.getAll);

// Get By Id
servicesRouter.get(Paths.Coupons.GetById, ServicesController.getById);

// Add one services
servicesRouter.post(Paths.Coupons.Add, ServicesController.add);

// Update one services
servicesRouter.patch(
  Paths.Coupons.Update,
  // validate(["services", isCoupon]),
  ServicesController.update
);

// Delete one services
servicesRouter.delete(
  Paths.Coupons.Delete,
  // validate(["id", "number", "params"]),
  ServicesController.delete
);

export default servicesRouter;
