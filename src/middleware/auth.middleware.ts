/**
 * Middleware to verify user logged in.
 */

import { Request, Response, NextFunction } from 'express';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { ISessionUser } from '@src/interfaces/ISessionUser';
import JwtHelper from '@src/util/JwtHelper';

// **** Variables **** //

const USER_UNAUTHORIZED_ERR = 'User not authorized to perform this action';

// **** Functions **** //

/**
 * See note at beginning of file.
 */
async function authorization(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Get session data
  if(req.path.includes("/auth")) return next();
  // const authHeader = req.headers.authorization;
  // if (!authHeader) {
  //   return res
  //     .status(HttpStatusCodes.UNAUTHORIZED)
  //     .json({ error: "Authorization header not found"});
  // }
  // const token = authHeader.split(' ')[1];
  // if (!token) {
  //   return res
  //     .status(HttpStatusCodes.UNAUTHORIZED)
  //     .json({ error: "JWT token not found" });
  // }
  const userData = { id: 1 } // await JwtHelper._decode<ISessionUser>(token);

  // const sessionData = await SessionUtil.getSessionData<TSessionData>(req);
  // console.log('sessionData: ', sessionData);
  console.log('userData: ', userData);
  
  // Set user data to locals
  if(typeof userData === 'object' && userData.id) {
    res.locals.sessionUser = userData;
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
