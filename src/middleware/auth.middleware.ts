/**
 * Middleware to verify user logged in.
 */

import { Request, Response, NextFunction } from 'express';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { ISessionUser } from '@src/interfaces/ISessionUser';
import JwtHelper from '@src/util/JwtHelper';

// **** Variables **** //

const USER_UNAUTHORIZED_ERR = 'User not authorized to perform this action';
const CHATBOT_PATHS = [/^\/api\/customers\/details$/, /^\/api\/orders\/customer\/all$/, /^\/api\/tests\/customer\/all$/, /^\/api\/tests\/customer\/[0-9]+$/]

// **** Functions **** //

/**
 * See note at beginning of file.
 */
async function authorization(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log("Auth middleware path:", req.path);
  // Get session data
  const bypassPrefixes = ["/api/auth", "/auth", "/app_versions", "/app-versions"];
  if (bypassPrefixes.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }

  // If the paths is for chatbot, check the token and allow access based on that
  const isChatbotPath = CHATBOT_PATHS.some(s => s.test(req.path))
  console.log(isChatbotPath)
  if(isChatbotPath) {
    const authHeader = req.headers.authorization;

    if(!authHeader || authHeader !== process.env.CHATBOT_ACCESS_TOKEN) {
      return res
        .status(HttpStatusCodes.UNAUTHORIZED)
        .json({ error: "Invalid chatbot access token"});
    }

    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ error: "Authorization header not found"});
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ error: "JWT token not found" });
  }
  console.log("Auth middleware token:", token);
  
  const userData = await JwtHelper._decode<ISessionUser>(token);
  console.log("Auth middleware decoded userData:", userData);

  // const sessionData = await SessionUtil.getSessionData<TSessionData>(req);
  // console.log('sessionData: ', sessionData);
  console.log('userData: ', userData);
  
  // Set user data to locals
  if(typeof userData === 'object' && userData.id) {
    res.locals.sessionUser = userData;
    req.body = { ...req.body, userData: userData };
    return next();
  }
  // Return an unauth error if token is not valid
  else {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ error: USER_UNAUTHORIZED_ERR });
  }
}


// **** Export Default **** //

export default authorization;
