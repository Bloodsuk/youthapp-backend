import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import ResultService from "@src/services/ResultService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import { ISessionUser } from "@src/interfaces/ISessionUser";

// **** Functions **** //

/**
 * Get all results.
 */
async function getAll(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";
  const status = (req.query.status as string) || "";
  const shipping = (req.query.shipping as string) || "";
  const report = (req.query.report as string) || "";
  const billing = (req.query.billing as string) || "";
  const showAll = req.query.showAll === "true";
  const reportThisWeek = req.query.thisWeek === "true";
  const { data, total } = await ResultService.getAll(
    res.locals.sessionUser,
    page,
    search,
    status,
    shipping,
    report,
    billing,
    showAll,
    reportThisWeek
  );
  return res.status(HttpStatusCodes.OK).json({ results: data, total });
}

/**
 * Get result by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const result = await ResultService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        result: result,
      })
      .end();
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
 * Delete one Result.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const type = req.params.type as string;
  if (!["basic_explain", "attachment"].includes(type)) {
    return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Invalid type!",
        })
        .end();
  }
  const uid = parseInt(id);
  try {
    await ResultService.delete(uid, type);
    return res.status(HttpStatusCodes.OK).json({
      success: true
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
  getById,
  delete: delete_,
} as const;
