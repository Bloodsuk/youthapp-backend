import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import PlebAvailabilityService from "@src/services/PlebAvailabilityService";
import { IPlebAvailabilityUpdateRequest } from "@src/interfaces/IPlebAvailability";

// **** Functions **** //

/**
 * Get availability and range for a pleb
 */
async function getAvailability(req: IReq<{ pleb_id: number }>, res: IRes) {
  const { pleb_id } = req.params;

  if (!pleb_id || isNaN(Number(pleb_id))) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Valid pleb_id is required",
    }).end();
  }

  try {
    const data = await PlebAvailabilityService.getAvailabilityAndRange(
      Number(pleb_id)
    );

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
 */
async function updateAvailability(
  req: IReq<{ pleb_id: number }, IPlebAvailabilityUpdateRequest>,
  res: IRes
) {
  const { pleb_id } = req.params;
  const { availability, service_range } = req.body;

  if (!pleb_id || isNaN(Number(pleb_id))) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Valid pleb_id is required",
    }).end();
  }

  if (!availability || !service_range) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "availability and service_range are required",
    }).end();
  }

  try {
    const data = await PlebAvailabilityService.updateAvailabilityAndRange(
      Number(pleb_id),
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


