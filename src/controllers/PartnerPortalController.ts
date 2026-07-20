import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import { RouteError } from "@src/other/classes";
import PhlebotomistService from "@src/services/PhlebotomistService";
import * as PartnerPortalService from "@src/services/PartnerPortalService";
import { IReq, IRes } from "@src/types/express/misc";

async function getPortalAccess(req: IReq, res: IRes) {
  const sessionUser = res.locals.sessionUser;
  if (sessionUser?.user_level !== UserLevels.Phlebotomist) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const profile = await PhlebotomistService.getProfileById(sessionUser.id);
    if (!profile?.email) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        error: "Phlebotomist email not found",
      }).end();
    }

    const result = await PartnerPortalService.getPartnerPortalAccess(profile.email);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      ...result,
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
      }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

interface IConsumeSsoBody {
  token?: string;
}

async function consumeSsoToken(req: IReq<IConsumeSsoBody>, res: IRes) {
  try {
    PartnerPortalService.verifyPartnerSsoSecret(
      req.headers["x-yr-partner-secret"] as string | undefined
    );
    const token = req.body?.token?.trim();
    if (!token) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Token is required",
      }).end();
    }

    const email = await PartnerPortalService.consumeSsoToken(token);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      email,
    }).end();
  } catch (error) {
    if (error instanceof RouteError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
      }).end();
    }
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal Error: " + error,
    }).end();
  }
}

export default {
  getPortalAccess,
  consumeSsoToken,
};
