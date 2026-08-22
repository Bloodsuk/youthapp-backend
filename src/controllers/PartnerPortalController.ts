import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import { RouteError } from "@src/other/classes";
import PhlebotomistService from "@src/services/PhlebotomistService";
import * as PartnerPortalService from "@src/services/PartnerPortalService";
import * as PhlebApplicationFormService from "@src/services/PhlebApplicationFormService";
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

async function getSubmitContractAccess(req: IReq, res: IRes) {
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

    const result = await PhlebApplicationFormService.getSubmitContractAccess(
      sessionUser.id,
      profile.email
    );
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

async function uploadSubmitContractDocuments(req: IReq, res: IRes) {
  const sessionUser = res.locals.sessionUser;
  if (sessionUser?.user_level !== UserLevels.Phlebotomist) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const files = req.files as
      | { [field: string]: Express.Multer.File[] }
      | undefined;

    const uploaded: Partial<
      Record<(typeof PhlebApplicationFormService.WP_CONTRACT_FILE_FIELDS)[number], string>
    > = {};

    for (const field of PhlebApplicationFormService.WP_CONTRACT_FILE_FIELDS) {
      const file = files?.[field]?.[0];
      if (file?.filename) {
        uploaded[field] = `/uploads/${file.filename}`;
      }
    }

    const contract =
      await PhlebApplicationFormService.updateWpContractDocuments(
        sessionUser.id,
        uploaded
      );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Documents uploaded to your contract",
      submitted: true,
      status: contract.status,
      status_label: contract.status_label,
      contract,
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
  getSubmitContractAccess,
  uploadSubmitContractDocuments,
  consumeSsoToken,
};
