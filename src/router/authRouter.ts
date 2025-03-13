import Paths from "@src/constants/Paths";
import AuthController from "@src/controllers/AuthController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();

const authRouter = Router();

// Login user
authRouter.post(
  Paths.Auth.Login,
  validate("email", "password"),
  AuthController.login
);
// Register user
authRouter.post(
  Paths.Auth.Register,
  AuthController.register
);

// Forgot Password
authRouter.post(
  Paths.Auth.ForgotPassword,
  validate("email"),
  AuthController.forgetPassword
);

// Reset Password
authRouter.post(
  Paths.Auth.ResetPassword,
  AuthController.resetPassword
);

authRouter.post(
  Paths.Auth.ResetForgotPassword,
  AuthController.resetPassword
);

// Logout user
authRouter.post(Paths.Auth.Logout, AuthController.logout);

export default authRouter;