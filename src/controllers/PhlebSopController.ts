import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import {
  IPhlebSopCreateInput,
  IPhlebSopUpdateInput,
} from "@src/interfaces/IPhlebSop";
import { RouteError } from "@src/other/classes";
import PhlebSopService from "@src/services/PhlebSopService";
import { IReq, IRes } from "@src/types/express/misc";
import * as e from "express";

function requestBaseUrl(req: e.Request): string | undefined {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host");
  if (!host) return undefined;
  return `${proto}://${host}/`;
}

function requirePhlebotomist(res: IRes) {
  const sessionUser = res.locals.sessionUser;
  if (sessionUser?.user_level !== UserLevels.Phlebotomist) {
    return null;
  }
  return sessionUser;
}

function requireAdmin(res: IRes) {
  const sessionUser = res.locals.sessionUser;
  if (sessionUser?.user_level !== UserLevels.Admin) {
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

async function listMySops(req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const data = await PhlebSopService.listForPhleb(
      sessionUser.id,
      requestBaseUrl(req)
    );
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function markSopViewed(req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  const sopId = Number(req.params.id);
  if (!Number.isFinite(sopId) || sopId <= 0) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Invalid SOP id",
    }).end();
  }

  try {
    const data = await PhlebSopService.markViewed(
      sessionUser.id,
      sopId,
      requestBaseUrl(req)
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "SOP document view recorded",
      data,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function acknowledgeSop(req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  const sopId = Number(req.params.id);
  if (!Number.isFinite(sopId) || sopId <= 0) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Invalid SOP id",
    }).end();
  }

  try {
    const signedBy =
      [sessionUser.first_name, sessionUser.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      sessionUser.username?.trim() ||
      sessionUser.email?.trim() ||
      "Phlebotomist";
    const data = await PhlebSopService.acknowledge(
      sessionUser.id,
      sopId,
      signedBy,
      requestBaseUrl(req)
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "SOP acknowledged",
      data,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function listAllSops(_req: IReq, res: IRes) {
  const admin = requireAdmin(res);
  if (!admin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required",
    }).end();
  }

  try {
    const data = await PhlebSopService.listActiveDocuments();
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function listPhlebSops(req: IReq, res: IRes) {
  const admin = requireAdmin(res);
  if (!admin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required",
    }).end();
  }

  const phlebId = Number(req.params.phleb_id);
  if (!Number.isFinite(phlebId) || phlebId <= 0) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Invalid phlebotomist id",
    }).end();
  }

  try {
    const data = await PhlebSopService.listForPhleb(
      phlebId,
      requestBaseUrl(req)
    );
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function createSop(req: IReq<IPhlebSopCreateInput>, res: IRes) {
  const admin = requireAdmin(res);
  if (!admin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required",
    }).end();
  }

  try {
    const createdBy =
      admin.username?.trim() || admin.email?.trim() || "Admin";
    const data = await PhlebSopService.createDocument(req.body, createdBy);
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "SOP created",
      data,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateSop(req: IReq<IPhlebSopUpdateInput>, res: IRes) {
  const admin = requireAdmin(res);
  if (!admin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required",
    }).end();
  }

  const sopId = Number(req.params.id);
  if (!Number.isFinite(sopId) || sopId <= 0) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Invalid SOP id",
    }).end();
  }

  try {
    const data = await PhlebSopService.updateDocument(sopId, req.body);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "SOP updated",
      data,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

export default {
  listMySops,
  markSopViewed,
  acknowledgeSop,
  listAllSops,
  listPhlebSops,
  createSop,
  updateSop,
} as const;
