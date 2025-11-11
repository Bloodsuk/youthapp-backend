import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import PhlebotomistService from "@src/services/PhlebotomistService";
import { UserLevels } from "@src/constants/enums";

// **** Functions **** //

/**
 * Get all phlebotomists (Admin only)
 */
async function getAll(req: IReq, res: IRes) {
  const isAdmin = res.locals.sessionUser?.user_level === UserLevels.Admin;
  
  if (!isAdmin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required"
    }).end();
  }

  try {
    const phlebotomists = await PhlebotomistService.getAllPhlebotomists();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: phlebotomists
    }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Update phlebotomist status (Admin only)
 */
async function updateStatus(req: IReq<{ id: number; is_active: number }>, res: IRes) {
  const isAdmin = res.locals.sessionUser?.user_level === UserLevels.Admin;
  
  if (!isAdmin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required"
    }).end();
  }

  const { id, is_active } = req.body;

  try {
    const updated = await PhlebotomistService.updatePhlebotomistStatus(id, is_active);
    
    if (updated) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Phlebotomist status updated successfully"
      }).end();
    } else {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        error: "Phlebotomist not found"
      }).end();
    }
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Resend credentials to phlebotomist (Admin only)
 */
async function resendCredentials(req: IReq<{ email: string }>, res: IRes) {
  const isAdmin = res.locals.sessionUser?.user_level === UserLevels.Admin;
  
  if (!isAdmin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required"
    }).end();
  }

  const { email } = req.body;

  try {
    const newPassword = await PhlebotomistService.createPasswordForPhlebotomist(email);
    
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "New credentials have been sent to the phlebotomist's email"
    }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

// **** Export default **** //

export default {
  getAll,
  updateStatus,
  resendCredentials,
} as const;
