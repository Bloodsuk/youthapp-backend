import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import PhlebTrainingService from "@src/services/PhlebTrainingService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";

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

async function getOverview(_req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const data = await PhlebTrainingService.getOverviewByPhlebId(sessionUser.id);
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function getMatrix(_req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const data = await PhlebTrainingService.getMatrixByPhlebId(sessionUser.id);
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function getTasks(_req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const data = await PhlebTrainingService.getApprovedTasksByPhlebId(sessionUser.id);
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function getCompetency(_req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const data = await PhlebTrainingService.getCompetencyByPhlebId(sessionUser.id);
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

export default {
  getOverview,
  getMatrix,
  getTasks,
  getCompetency,
} as const;
