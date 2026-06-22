import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import { IPhlebComplianceDocumentReview } from "@src/interfaces/IPhlebCompliance";
import { RouteError } from "@src/other/classes";
import PhlebComplianceService from "@src/services/PhlebComplianceService";
import { IReq, IRes } from "@src/types/express/misc";
import fs from "fs";
import * as e from "express";

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

function requestBaseUrl(req: e.Request): string | undefined {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host");
  if (!host) return undefined;
  return `${proto}://${host}/`;
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

async function getOverview(req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const data = await PhlebComplianceService.getOverviewByPhlebId(
      sessionUser.id,
      requestBaseUrl(req)
    );
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function getItems(req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const data = await PhlebComplianceService.getItemsByPhlebId(
      sessionUser.id,
      requestBaseUrl(req)
    );
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

interface IPhlebComplianceUploadBody {
  item_key?: string;
  expiry_date?: string;
  notes?: string;
}

async function uploadDocument(req: IReq<IPhlebComplianceUploadBody>, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const itemKey = String(req.body?.item_key ?? "").trim();
    if (!itemKey) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "item_key is required",
      }).end();
    }

    if (!req.file) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "No file uploaded — use field name attachment",
      }).end();
    }

    const expiryRaw = req.body?.expiry_date;
    const expiryDate =
      expiryRaw != null && String(expiryRaw).trim() !== ""
        ? String(expiryRaw).trim().slice(0, 10)
        : null;

    const data = await PhlebComplianceService.uploadDocument(
      sessionUser.id,
      itemKey,
      req.file,
      {
        expiryDate,
        notes: req.body?.notes ? String(req.body.notes) : null,
      },
      requestBaseUrl(req)
    );

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Document uploaded — pending admin review",
      data,
    }).end();
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return handleError(res, error);
  }
}

async function reviewDocument(req: IReq, res: IRes) {
  const admin = requireAdmin(res);
  if (!admin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required",
    }).end();
  }

  const documentId = Number(req.params.id);
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Invalid document id",
    }).end();
  }

  const body = req.body as unknown as IPhlebComplianceDocumentReview;
  const status = body?.status;
  if (status !== "approved" && status !== "rejected") {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "status must be approved or rejected",
    }).end();
  }

  try {
    const reviewerName =
      admin.username?.trim() || admin.email?.trim() || "Admin";
    const data = await PhlebComplianceService.reviewDocument(
      documentId,
      {
        status,
        notes: body?.notes,
        signed_off_by: body?.signed_off_by,
      },
      reviewerName,
      requestBaseUrl(req)
    );

    if (!data) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        error: "Document not found",
      }).end();
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message:
        status === "approved"
          ? "Document approved and sign-off recorded"
          : "Document rejected",
      data,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

export default {
  getOverview,
  getItems,
  uploadDocument,
  reviewDocument,
} as const;
