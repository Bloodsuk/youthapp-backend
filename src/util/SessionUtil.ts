import { Request, Response } from "express";

import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { RouteError } from "@src/other/classes";

import EnvVars from "../constants/EnvVars";
import JwtHelper from "./JwtHelper";

// **** Variables **** //

// Errors
const Errors = {
  ParamFalsey: "Param is falsey",
  Validation: "JSON-web-token validation failed.",
} as const;


// **** Functions **** //

/**
 * Get session data from request object (i.e. ISessionUser)
 */
function getSessionData<T>(req: Request): Promise<string | T | undefined> {
  const { Key } = EnvVars.CookieProps,
    jwt = req.signedCookies[Key];
  return JwtHelper._decode(jwt as string);
}

/**
 * Add a JWT to the response
 */
async function addSessionData(
  res: Response,
  data: string | object
): Promise<Response> {
  if (!res || !data) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.ParamFalsey);
  }
  // Setup JWT
  const jwt = await JwtHelper._sign(data),
    { Key, Options } = EnvVars.CookieProps;
  // Return
  return res.cookie(Key, jwt, Options);
}

/**
 * Remove cookie
 */
function clearCookie(res: Response): Response {
  const { Key, Options } = EnvVars.CookieProps;
  return res.clearCookie(Key, Options);
}


// **** Export default **** //

export default {
  addSessionData,
  getSessionData,
  clearCookie,
} as const;
