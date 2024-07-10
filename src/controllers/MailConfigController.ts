import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import MailService from "@src/services/MailService";
import { IMailConfig } from "@src/interfaces/IMailConfig";

// **** Functions **** //

/**
 * Get mail config.
 */
async function getMailConfig(_: IReq, res: IRes) {
  const config = await MailService.getMailConfig();
  return res.status(HttpStatusCodes.OK).json({ ...config }).end();
}
/**
 * Add mail config.
 */
async function addMailConfig(req: IReq<IMailConfig>, res: IRes) {
  const config = req.body;
  try {
    const ifExists = await MailService.getMailConfig() != null;
    if (ifExists) {
      const updated = await MailService.updateMailConfig(config);
      return res.status(HttpStatusCodes.OK).json({ success: updated }).end();
    } else {
      const id = await MailService.addMailConfig(config);
      if (id)
        return res
          .status(HttpStatusCodes.CREATED)
          .json({
            success: true,
          })
          .end();
      else return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false }).end();
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
 * Add mail config.
 */
async function updateMailConfig(req: IReq<IMailConfig>, res: IRes) {
  const config = req.body;
  try {
    const updated = await MailService.updateMailConfig(config);
    return res.status(HttpStatusCodes.OK).json({ success: updated }).end();
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
  getMailConfig,
  addMailConfig,
  updateMailConfig,
} as const;
