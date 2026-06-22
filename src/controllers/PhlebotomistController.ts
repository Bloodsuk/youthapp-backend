import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import PhlebotomistService from "@src/services/PhlebotomistService";
import { UserLevels } from "@src/constants/enums";
import { IPhlebProfileUpdate } from "@src/interfaces/IPhlebProfile";

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

/**
 * Get logged-in phlebotomist profile (profile fields from phlebotomy_applications).
 */
async function getProfile(req: IReq, res: IRes) {
  const sessionUser = res.locals.sessionUser;
  if (sessionUser?.user_level !== UserLevels.Phlebotomist) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const profile = await PhlebotomistService.getProfileById(sessionUser.id);
    if (!profile) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        error: "Phlebotomist not found",
      }).end();
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: profile,
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
 * Update logged-in phlebotomist profile.
 */
async function updateProfile(req: IReq<IPhlebProfileUpdate>, res: IRes) {
  const sessionUser = res.locals.sessionUser;
  if (sessionUser?.user_level !== UserLevels.Phlebotomist) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  const { full_name, email, phone, home_address, city, home_postcode, password } =
    req.body;

  if (!full_name?.trim() || !email?.trim()) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Full name and email are required",
    }).end();
  }

  try {
    const profile = await PhlebotomistService.updateProfile(sessionUser.id, {
      full_name,
      email,
      phone: phone ?? "",
      home_address: home_address ?? "",
      city,
      home_postcode,
      password,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Profile updated successfully",
      data: profile,
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
  getAll,
  updateStatus,
  resendCredentials,
  getProfile,
  updateProfile,
} as const;
