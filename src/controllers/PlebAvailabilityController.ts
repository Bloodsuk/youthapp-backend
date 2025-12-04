import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import PlebAvailabilityService from "@src/services/PlebAvailabilityService";
import { IPlebAvailabilityUpdateRequest } from "@src/interfaces/IPlebAvailability";
import { UserLevels } from "@src/constants/enums";

// **** Functions **** //

/**
 * Get availability and range for a pleb
 * - Plebs can get their own availability (from token)
 * - Customers can get any pleb's availability (pleb_id from params)
 * - Admins can get any pleb's availability (pleb_id from params)
 */
async function getAvailability(req: IReq, res: IRes) {
  const sessionUser = res.locals.sessionUser;

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  let plebId: number;

  // Check if user is a pleb/phlebotomist
  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    // Plebs can only get their own availability (no params needed)
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin || sessionUser.user_level === UserLevels.Customer) {
    // Admins and Customers can get any pleb's availability from params
    const { pleb_id } = req.params;
    if (!pleb_id || isNaN(Number(pleb_id))) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Valid pleb_id is required",
      }).end();
    }
    plebId = Number(pleb_id);
  } else {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Access denied - only phlebotomists, customers, and admins can access this endpoint",
    }).end();
  }

  try {
    const data = await PlebAvailabilityService.getAvailabilityAndRange(plebId);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: data,
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    } else {
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
    }
  }
}

/**
 * Update availability and range for a pleb
 * - Plebs can only update their own availability (pleb_id from token)
 * - Admins can update any pleb's availability (pleb_id in body)
 */
async function updateAvailability(
  req: IReq<IPlebAvailabilityUpdateRequest>,
  res: IRes
) {
  const sessionUser = res.locals.sessionUser;
  const { availability, service_range } = req.body;

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  if (!availability || !service_range) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "availability and service_range are required",
    }).end();
  }

  let plebId: number;

  // Check if user is a pleb/phlebotomist
  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    // Plebs can only update their own availability - get from token
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin) {
    // Admins can update any pleb's availability - check for pleb_id in body
    const bodyWithPlebId = req.body as IPlebAvailabilityUpdateRequest & { pleb_id?: number };
    if (bodyWithPlebId.pleb_id && !isNaN(Number(bodyWithPlebId.pleb_id))) {
      plebId = Number(bodyWithPlebId.pleb_id);
    } else {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Admin access requires pleb_id in request body",
      }).end();
    }
  } else {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Access denied - only phlebotomists and admins can access this endpoint",
    }).end();
  }
  try {
    const data = await PlebAvailabilityService.updateAvailabilityAndRange(
      plebId,
      {
        availability,
        service_range,
      }
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Availability and range updated successfully",
      data: data,
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    } else {
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
    }
  }
}

// **** Export default **** //

export default {
  getAvailability,
  updateAvailability,
} as const;
