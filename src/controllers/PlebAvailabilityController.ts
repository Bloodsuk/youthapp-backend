import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import PlebAvailabilityService from "@src/services/PlebAvailabilityService";
import {
  IPlebAvailabilityUpdateRequest,
  IPlebDateSlotCreateRequest,
  IPlebDateSlotUpdateRequest,
  IPlebDaySlotCreateRequest,
  IPlebDaySlotUpdateRequest,
} from "@src/interfaces/IPlebAvailability";
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

// **** Date-Specific Availability Handlers **** //

/**
 * Get date-specific availability slots for a pleb within a date range
 */
async function getDateAvailability(req: IReq, res: IRes) {
  const sessionUser = res.locals.sessionUser;

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  let plebId: number;

  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin || sessionUser.user_level === UserLevels.Customer) {
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
      error: "Access denied",
    }).end();
  }

  const { start_date, end_date } = req.query as { start_date?: string; end_date?: string };

  if (!start_date || !end_date) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "start_date and end_date query params are required (YYYY-MM-DD)",
    }).end();
  }

  try {
    const data = await PlebAvailabilityService.getDateAvailability(plebId, start_date, end_date);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({ success: false, error: error.message }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

/**
 * Add one or more date-specific availability slots
 */
async function addDateSlot(req: IReq<IPlebDateSlotCreateRequest>, res: IRes) {
  const sessionUser = res.locals.sessionUser;

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  let plebId: number;

  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin) {
    const bodyPlebId = (req.body as IPlebDateSlotCreateRequest).pleb_id;
    if (!bodyPlebId || isNaN(Number(bodyPlebId))) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Admin access requires pleb_id in request body",
      }).end();
    }
    plebId = Number(bodyPlebId);
  } else {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Access denied - only phlebotomists and admins can manage availability",
    }).end();
  }

  try {
    const result = await PlebAvailabilityService.addDateSlots(plebId, req.body);
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Date-specific slot(s) added successfully",
      data: { ids: result.ids },
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({ success: false, error: error.message }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

/**
 * Update a single date-specific availability slot
 */
async function updateDateSlot(req: IReq<IPlebDateSlotUpdateRequest>, res: IRes) {
  const sessionUser = res.locals.sessionUser;
  const slotId = Number(req.params.id);

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  if (!slotId || isNaN(slotId)) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Valid slot id is required",
    }).end();
  }

  let plebId: number;

  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin) {
    const bodyPlebId = (req.body as IPlebDateSlotUpdateRequest & { pleb_id?: number }).pleb_id;
    if (!bodyPlebId || isNaN(Number(bodyPlebId))) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Admin access requires pleb_id in request body",
      }).end();
    }
    plebId = Number(bodyPlebId);
  } else {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Access denied - only phlebotomists and admins can manage availability",
    }).end();
  }

  try {
    await PlebAvailabilityService.updateDateSlot(plebId, slotId, req.body);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Date-specific slot updated successfully",
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({ success: false, error: error.message }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

/**
 * Delete a single date-specific availability slot (hard delete)
 */
async function deleteDateSlot(req: IReq<{ pleb_id?: number }>, res: IRes) {
  const sessionUser = res.locals.sessionUser;
  const slotId = Number(req.params.id);

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  if (!slotId || isNaN(slotId)) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Valid slot id is required",
    }).end();
  }

  let plebId: number;

  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin) {
    const bodyPlebId = req.body.pleb_id;
    if (!bodyPlebId || isNaN(Number(bodyPlebId))) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Admin access requires pleb_id in request body",
      }).end();
    }
    plebId = Number(bodyPlebId);
  } else {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Access denied - only phlebotomists and admins can manage availability",
    }).end();
  }

  try {
    await PlebAvailabilityService.deleteDateSlot(plebId, slotId);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Date-specific slot deleted successfully",
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({ success: false, error: error.message }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

// **** Per Day (day-of-week) Availability Handlers **** //

/**
 * Get all day-of-week availability slots for a pleb
 */
async function getDayAvailability(req: IReq, res: IRes) {
  const sessionUser = res.locals.sessionUser;

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  let plebId: number;

  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin || sessionUser.user_level === UserLevels.Customer) {
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
      error: "Access denied",
    }).end();
  }

  try {
    const data = await PlebAvailabilityService.getDayAvailability(plebId);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({ success: false, error: error.message }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

/**
 * Add a single day-of-week availability slot
 */
async function addDaySlot(req: IReq<IPlebDaySlotCreateRequest>, res: IRes) {
  const sessionUser = res.locals.sessionUser;

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  let plebId: number;

  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin) {
    const bodyPlebId = (req.body as IPlebDaySlotCreateRequest).pleb_id;
    if (!bodyPlebId || isNaN(Number(bodyPlebId))) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Admin access requires pleb_id in request body",
      }).end();
    }
    plebId = Number(bodyPlebId);
  } else {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Access denied - only phlebotomists and admins can manage availability",
    }).end();
  }

  try {
    const result = await PlebAvailabilityService.addDaySlot(plebId, req.body);
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Day slot added successfully",
      data: { id: result.id },
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({ success: false, error: error.message }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

/**
 * Update a single day-of-week availability slot
 */
async function updateDaySlot(req: IReq<IPlebDaySlotUpdateRequest>, res: IRes) {
  const sessionUser = res.locals.sessionUser;
  const slotId = Number(req.params.id);

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  if (!slotId || isNaN(slotId)) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Valid slot id is required",
    }).end();
  }

  let plebId: number;

  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin) {
    const bodyPlebId = (req.body as IPlebDaySlotUpdateRequest & { pleb_id?: number }).pleb_id;
    if (!bodyPlebId || isNaN(Number(bodyPlebId))) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Admin access requires pleb_id in request body",
      }).end();
    }
    plebId = Number(bodyPlebId);
  } else {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Access denied - only phlebotomists and admins can manage availability",
    }).end();
  }

  try {
    await PlebAvailabilityService.updateDaySlot(plebId, slotId, req.body);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Day slot updated successfully",
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({ success: false, error: error.message }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

/**
 * Delete a single day-of-week availability slot (hard delete)
 */
async function deleteDaySlot(req: IReq<{ pleb_id?: number }>, res: IRes) {
  const sessionUser = res.locals.sessionUser;
  const slotId = Number(req.params.id);

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  if (!slotId || isNaN(slotId)) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Valid slot id is required",
    }).end();
  }

  let plebId: number;

  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin) {
    const bodyPlebId = req.body.pleb_id;
    if (!bodyPlebId || isNaN(Number(bodyPlebId))) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Admin access requires pleb_id in request body",
      }).end();
    }
    plebId = Number(bodyPlebId);
  } else {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Access denied - only phlebotomists and admins can manage availability",
    }).end();
  }

  try {
    await PlebAvailabilityService.deleteDaySlot(plebId, slotId);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Day slot deleted successfully",
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({ success: false, error: error.message }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

// **** Calendar View Handler **** //

/**
 * Get merged calendar view for a month
 */
async function getCalendar(req: IReq, res: IRes) {
  const sessionUser = res.locals.sessionUser;

  if (!sessionUser || !sessionUser.id) {
    return res.status(HttpStatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Unauthorized - authentication required",
    }).end();
  }

  let plebId: number;

  if (sessionUser.user_level === UserLevels.Phlebotomist) {
    plebId = sessionUser.id;
  } else if (sessionUser.user_level === UserLevels.Admin || sessionUser.user_level === UserLevels.Customer) {
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
      error: "Access denied",
    }).end();
  }

  const { month, year } = req.query as { month?: string; year?: string };

  if (!month || !year) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "month and year query params are required",
    }).end();
  }

  const monthNum = Number(month);
  const yearNum = Number(year);

  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "month must be between 1 and 12",
    }).end();
  }

  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "year must be a valid year",
    }).end();
  }

  try {
    const data = await PlebAvailabilityService.getCalendarView(plebId, monthNum, yearNum);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({ success: false, error: error.message }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

// **** Export default **** //

export default {
  getAvailability,
  updateAvailability,
  getDateAvailability,
  addDateSlot,
  updateDateSlot,
  deleteDateSlot,
  getDayAvailability,
  addDaySlot,
  updateDaySlot,
  deleteDaySlot,
  getCalendar,
} as const;
