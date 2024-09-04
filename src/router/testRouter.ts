import Paths from "@src/constants/Paths";
import TestController from "@src/controllers/TestsController";
import { Router } from "express";
// import jetValidator from "jet-validator/lib/jet-validator";

// const validate = jetValidator();

const testRouter = Router();

// Get all tests
testRouter.get(Paths.Tests.Get, TestController.getAll);

// Get all practitioner tests
testRouter.get(Paths.Tests.GetPractitionerTest, TestController.getPractitionerTest);

// Get all customer tests
testRouter.get(Paths.Tests.GetCustomerTest, TestController.getCustomerTest);

// Get By Id
testRouter.get(Paths.Tests.GetById, TestController.getById);

// Add one test
testRouter.post(Paths.Tests.Add, TestController.add);

// Update one test
testRouter.patch(
  Paths.Tests.Update,
  // validate(["test", isTest]),
  TestController.update
);

// Set customer price for test by practitioner
testRouter.patch(
  Paths.Tests.UpdateCustomerPrice,
  // validate(["test", isTest]),
  TestController.updateCustomerPrice
);

// Update test status
testRouter.put(
  Paths.Tests.Activate,
  TestController.activateDeactivate
);

// Delete one test
testRouter.delete(
  Paths.Tests.Delete,
  // validate(["id", "number", "params"]),
  TestController.delete
);

export default testRouter;
