import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import SessionUtil from "@src/util/SessionUtil";
import AuthService from "@src/services/AuthService";

import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import UserService from "@src/services/UserService";
import { trim } from "@src/util/misc";
import { UserLevels } from "@src/constants/enums";
import JwtHelper from "@src/util/JwtHelper";

// **** Types **** //

interface ILoginReq {
  email: string;
  password: string;
}


// **** Functions **** //

/**
 * Login a user.
 */
async function login(req: IReq<ILoginReq>, res: IRes) {
  const { email, password } = req.body;
  // Login
  try {
    const user = await AuthService.login(email, password);
    console.log("user", user);

    // Setup Admin Cookie
    // await SessionUtil.addSessionData(res, {
    //   id: user.id,
    //   email: user.email,
    //   username: user.username,
    //   first_name: user.first_name,
    //   last_name: user.last_name,
    //   user_level: user.user_level,
    //   practitioner_id: user['user_level'] && user['user_level'] === UserLevels.Moderator ? user.practitioner_id : undefined,
    // });
    // Return
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        user,
        token: await JwtHelper._sign({
          id: user.id,
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          user_level: user.user_level,
          practitioner_id: user['user_level'] && user['user_level'] === UserLevels.Moderator ? user.practitioner_id : undefined,
        }),
      })
      .end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          message: "Login Error: " + JSON.stringify(error),
        })
        .end();
  }
}

/**
 * Register a user.
 */
interface ISignupReq {
    first_name: string;
    last_name: string;
    email: string;
    username: string;
    phone: string;
    user_level?: string;
    created_by?: number;
    company_name: string;
    area_of_business: string;
    number_of_clients: string;
    test_per_month: string;
    comments_box: string;
    password: string;
    con_pass: string;
    address: string;
    town: string;
    country: string;
    postal_code: string;
    cus_notification_types: any;
    mail_sent: string;
    date_of_birth: string;
    gender: string;
}

async function register(req: IReq<ISignupReq>, res: IRes) {
  const first_name = (req.body['first_name']) ? trim(req.body['first_name']) : '';
  const last_name = (req.body['last_name']) ? trim(req.body['last_name']) : '';
  const email = (req.body['email']) ? trim(req.body['email']) : '';
  const username = (req.body['username']) ? trim(req.body['username']) : (email ? email.split("@")[0]: '');
  const phone = (req.body['phone']) ? trim(req.body['phone']) : '';
  const user_level = (req.body['user_level']) ? trim(req.body['user_level']) : null;
  const created_by = (req.body['created_by']) ? req.body['created_by'] : 1;
  const company_name = (req.body['company_name']) ? trim(req.body['company_name']) : '';
  const area_of_business = (req.body['area_of_business']) ? trim(req.body['area_of_business']) : '';
  const number_of_clients = (req.body['number_of_clients']) ? trim(req.body['number_of_clients']) : '';
  const test_per_month = (req.body['test_per_month']) ? trim(req.body['test_per_month']) : '';
  const comments_box = (req.body['comments_box']) ? trim(req.body['comments_box']) : '';
  const password = (req.body['password']) ? trim(req.body['password']) : '';
  const con_pass = (req.body['con_pass']) ? trim(req.body['con_pass']) : '';
  const address = (req.body['address']) ? trim(req.body['address']) : '';
  const town = (req.body['town']) ? trim(req.body['town']) : '';
  const country = (req.body['country']) ? trim(req.body['country']) : '';
  const postal_code = (req.body['postal_code']) ? trim(req.body['postal_code']) : '';
  const cus_notification_types = req.body['cus_notification_types']
  const mail_sent = (req.body['mail_sent']) ? trim(req.body['mail_sent']) : '';
  const date_of_birth = (req.body['date_of_birth']) ? trim(req.body['date_of_birth']) : '';
  const gender = (req.body['gender']) ? trim(req.body['gender']) : '';

  try {
    const user = await AuthService.register(
      first_name,
      last_name,
      email,
      phone,
      company_name,
      area_of_business,
      number_of_clients,
      test_per_month,
      comments_box,
      password,
      con_pass,
      user_level,
      created_by,
      address,
      town,
      country,
      postal_code,
      cus_notification_types,
      mail_sent,
      date_of_birth,
      gender,
      username,
    );
    console.log("user", user);

    // Setup Admin Cookie
    // await SessionUtil.addSessionData(res, {
    //   id: user.id,
    //   email: user.email,
    //   username: user.username,
    //   first_name: user.first_name,
    //   last_name: user.last_name,
    //   user_level: user.user_level,
    //   practitioner_id:
    //     user["user_level"] && user["user_level"] === UserLevels.Moderator
    //       ? user.practitioner_id
    //       : undefined,
    // });
    // Return
    return res
      .status(HttpStatusCodes.OK)
      .json({
        user,
        success: true,
        message: "Signup Successfully! Login to continue!!!",
      })
      .end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          message: "Register Error: " + JSON.stringify(error),
        })
        .end();
  }
}

/**
 *  Forget Password
 */

interface IForgetPasswordReq {
  email: string;
}
async function forgetPassword(req: IReq<IForgetPasswordReq>, res: IRes) {
  const { email } = req.body;
  try {
    if(await UserService.updateForgotCode(email))
      return res
        .status(HttpStatusCodes.OK)
        .json({
          success: true,
          message: "Please enter the new password to continue!!!",
        })
        .end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          message: "Forget Password Error: " + JSON.stringify(error),
        })
        .end();
  }
}

/**
 *  Reset Forgot Password
 */
interface IResetForgotPasswordReq {
  password: string;
  forgot_code: string;
}

async function resetForgotPassword(req: IReq<IResetForgotPasswordReq>, res: IRes) {
  const { password, forgot_code } = req.body;
  try {
    if (!(password && forgot_code)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Password not matched!!"
      );
    }
    const email = await UserService.getEmailFromForgotCode(forgot_code)
    if(email)
      if(await UserService.updatePassword(email, password))
        return res
          .status(HttpStatusCodes.OK)
          .json({
            success: true,
            message: "Please click login to continue!!!",
          })
          .end();
      else 
        throw new RouteError(
          HttpStatusCodes.CONFLICT,
          "Oops! An error occurred, please contact admin."
        );
    else 
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "Oops! please pass correct forgot code."
      );
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          message: "Forget Password Error: " + JSON.stringify(error),
        })
        .end();
  }
}

/**
 *  Reset Password
 */
interface IResetPasswordReq {
  email: string;
  password: string;
  con_pass: string;
}

async function resetPassword(req: IReq<IResetPasswordReq>, res: IRes) {
  const { email, password, con_pass } = req.body;
  try {
    if (!(password && con_pass) || password != con_pass) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Password not matched!!"
      );
    }
    if(await UserService.updatePassword(email, password))
      return res
        .status(HttpStatusCodes.OK)
        .json({
          success: true,
          message: "Please click login to continue!!!",
        })
        .end();
    else 
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "Oops! An error occurred, please contact admin."
      );
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          message: "Forget Password Error: " + JSON.stringify(error),
        })
        .end();
  }
}

/**
 * Logout the user.
 */
function logout(_: IReq, res: IRes) {
  SessionUtil.clearCookie(res);
  return res.status(HttpStatusCodes.OK).end();
}

// **** Export default **** //

export default {
  login,
  register,
  forgetPassword,
  resetPassword,
  resetForgotPassword,
  logout,
} as const;
