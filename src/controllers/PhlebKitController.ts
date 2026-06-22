import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import { IPhlebKitRequestCreate } from "@src/interfaces/IPhlebKit";
import { RouteError } from "@src/other/classes";
import PhlebKitService from "@src/services/PhlebKitService";
import { IReq, IRes } from "@src/types/express/misc";

function requirePhlebotomist(res: IRes) {
  const sessionUser = res.locals.sessionUser;
  if (sessionUser?.user_level !== UserLevels.Phlebotomist) {
    return null;
  }
  return sessionUser;
}

function handleError(res: IRes, error: unknown) {
  if (error instanceof RouteError) {
    return res.status(error.status).json({ success: false, error: error.message }).end();
  }
  return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: "Internal Error: " + error,
  }).end();
}

async function getKitTypes(_req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const types = await PhlebKitService.getActiveKitTypes();
    return res.status(HttpStatusCodes.OK).json({ success: true, data: types }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function getKitRequests(_req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const requests = await PhlebKitService.getRequestsByPhlebId(sessionUser.id);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: requests }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function getKitBalance(_req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const overview = await PhlebKitService.getOverviewByPhlebId(sessionUser.id);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: overview }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function createKitRequest(req: IReq<IPhlebKitRequestCreate>, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const created = await PhlebKitService.createRequest(sessionUser.id, req.body);
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Kit request submitted",
      data: created,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

export default {
  getKitTypes,
  getKitBalance,
  getKitRequests,
  createKitRequest,
} as const;
