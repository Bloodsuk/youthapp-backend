import Paths from "@src/constants/Paths";
import CreditRequestController from "@src/controllers/CreditRequestController";
import { isCreditReqStatus } from "@src/util/misc";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();

const creditRequestRouter = Router();

// Get all creditRequests
creditRequestRouter.get(Paths.CreditRequests.Get, CreditRequestController.getAll);

// Get pending creditRequests
creditRequestRouter.get(Paths.CreditRequests.Pending, CreditRequestController.getPending);

// Get approved creditRequests
creditRequestRouter.get(Paths.CreditRequests.Approved, CreditRequestController.getApproved);

// Get User Balance
creditRequestRouter.get(
  Paths.CreditRequests.GetUserBalances,
  CreditRequestController.getUsersBalance
);

// Get By Id
creditRequestRouter.get(Paths.CreditRequests.GetById, CreditRequestController.getById);

// Get By User Id
creditRequestRouter.get(Paths.CreditRequests.GetByUserId, CreditRequestController.getByUserId);


// Add one creditRequest
creditRequestRouter.post(Paths.CreditRequests.Add, CreditRequestController.add);

// Update one creditRequest
creditRequestRouter.patch(
  Paths.CreditRequests.Update,
  // validate(["creditRequest", isCreditRequest]),
  CreditRequestController.update
);
// Update one creditRequest
creditRequestRouter.post(
  Paths.CreditRequests.UpdateStatus,
  validate(["status", isCreditReqStatus, "body"]),
  CreditRequestController.updateStatus
);

// Delete one creditRequest
creditRequestRouter.delete(
  Paths.CreditRequests.Delete,
  // validate(["id", "number", "params"]),
  CreditRequestController.delete
);

export default creditRequestRouter;
