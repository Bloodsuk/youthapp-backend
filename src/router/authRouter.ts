import Paths from "@src/constants/Paths";
import AuthController from "@src/controllers/AuthController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";
import { Request, Response, NextFunction } from "express";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

const validate = jetValidator();

const authRouter = Router();

// Custom validation for login (handles phlebotomist flow)
function validateLogin(req: Request, res: Response, next: NextFunction) {
  const { email, isPleb } = req.body;
  
  // Email is always required
  if (!email) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      error: "The following parameter was missing or invalid: \"email\"."
    });
  }
  
  // For phlebotomist flow, password is optional
  if (!isPleb && !req.body.password) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      error: "The following parameter was missing or invalid: \"password\"."
    });
  }
  
  next();
}

// Login user
authRouter.post(
  Paths.Auth.Login,
  validateLogin,
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
  validate("password", "forgot_code"),
  AuthController.resetForgotPassword
);

// Logout user
authRouter.post(Paths.Auth.Logout, AuthController.logout);

export default authRouter;