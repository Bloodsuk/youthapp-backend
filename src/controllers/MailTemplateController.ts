import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import MailService from "@src/services/MailService";
import { UserLevels } from "@src/constants/enums";

// **** Functions **** //

/**
 * Get mail template.
 */
async function getMailTemplates(req: IReq, res: IRes) {
  const isAdmin = res.locals.sessionUser?.user_level === UserLevels.Admin;
  if (!isAdmin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin user is authorized to perform this action",
    }).end();
  }
  const templates = await MailService.getMailTemplates();
  return res.status(HttpStatusCodes.OK).json({ templates }).end();
}
/**
 * Add mail template.
 */
interface IUpdateMailTemplateBody {
  type: number;
  subject: string;
  title: string;
  content: string;
}
async function addMailTemplate(req: IReq<IUpdateMailTemplateBody>, res: IRes) {
  const { type, subject, title, content } = req.body;
  try {
    const id = await MailService.addMailTemplate(type, subject, title, content);
    if (id)
      return res
        .status(HttpStatusCodes.CREATED)
        .json({
          success: true,
        })
        .end();
    else return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false }).end();
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
 * Update mail template.
 */
interface IUpdateMailTemplateBody {
  subject: string;
  title: string;
  content: string;
}
async function updateMailTemplate(req: IReq<IUpdateMailTemplateBody>, res: IRes) {
  const { subject, title, content } = req.body;
  const { type } = req.params;
  try {
    const id = await MailService.updateMailTemplate(+type, subject, title, content);
    if (id)
      return res
        .status(HttpStatusCodes.OK)
        .json({
          success: true,
        })
        .end();
    else return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false }).end();
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
  getMailTemplates,
  addMailTemplate,
  updateMailTemplate,
} as const;
