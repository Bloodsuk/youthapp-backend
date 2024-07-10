import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import StatsService from "@src/services/StatsService";
import { IReq, IRes } from "@src/types/express/misc";

// **** Functions **** //

/**
 * 
 * 
 * Get all tests.
 */
async function getAll(req: IReq, res: IRes) {
  if(!res.locals.sessionUser)
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({ message: 'User is not authorized to perform this action' });
  const stats = await StatsService.getAll(res.locals.sessionUser);
  return res.status(HttpStatusCodes.OK).json({ ...stats });
}


// **** Export default **** //

export default {
  getAll,
} as const;
