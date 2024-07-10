import Paths from "@src/constants/Paths";
import UserController from "@src/controllers/UserController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();

const userRouter = Router();

// Get all users
userRouter.get(Paths.Users.Get, UserController.getAll);

// Get all practitioners
userRouter.get(Paths.Users.GetPractitioners, UserController.getAllPractitioners);

// Get all clinics
userRouter.get(Paths.Users.GetClinics, UserController.getAllClinics);

// Get By Id
userRouter.get(Paths.Users.GetById, validate(["id", "string", "params"]), UserController.getById);

// Add one user
userRouter.post(Paths.Users.Add, UserController.add);

// Update one user
userRouter.patch(
  Paths.Users.Update,
  // validate(["user", isUser]),
  UserController.update
);

// Update many users
// userRouter.post(
//   Paths.Users.UpdateMany,
//   // validate(["users", "array"]),
//   UserController.updateMany
// );
// Update user's status
userRouter.post(
  Paths.Users.Activate,
  // validate(["users", "array"]),
  UserController.activate
);
// Update user's status
userRouter.post(
  Paths.Users.Deactivate,
  // validate(["users", "array"]),
  UserController.deactivate
);
// Update user's email
userRouter.post(
  Paths.Users.UpdateEmail,
  // validate(["users", "array"]),
  UserController.updateEmail
);
// Update user's password
userRouter.post(
  Paths.Users.UpdatePass,
  // validate(["users", "array"]),
  UserController.updatePassword
);

// Delete one user
userRouter.delete(
  Paths.Users.Delete,
  // validate(["id", "number", "params"]),
  UserController.delete
);

export default userRouter;
