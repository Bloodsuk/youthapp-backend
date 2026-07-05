import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import { IPhlebContractInput, IPhlebContractReview } from "@src/interfaces/IPhlebContract";
import { RouteError } from "@src/other/classes";
import PhlebContractService from "@src/services/PhlebContractService";
import { IReq, IRes } from "@src/types/express/misc";

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

async function getMyContracts(_req: IReq, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const data = await PhlebContractService.getContractsByPhlebId(sessionUser.id);
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function submitContract(req: IReq<IPhlebContractInput>, res: IRes) {
  const sessionUser = requirePhlebotomist(res);
  if (!sessionUser) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Phlebotomist access required",
    }).end();
  }

  try {
    const data = await PhlebContractService.createContract(sessionUser.id, req.body);
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Contract submitted successfully",
      data,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function listAllContracts(req: IReq, res: IRes) {
  const admin = requireAdmin(res);
  if (!admin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required",
    }).end();
  }

  try {
    const limit = Number(req.query.limit ?? 50);
    const data = await PhlebContractService.listAllContracts(limit);
    return res.status(HttpStatusCodes.OK).json({ success: true, data }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function reviewContract(req: IReq, res: IRes) {
  const admin = requireAdmin(res);
  if (!admin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required",
    }).end();
  }

  const contractId = Number(req.params.id);
  if (!Number.isFinite(contractId) || contractId <= 0) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Invalid contract id",
    }).end();
  }

  const body = req.body as unknown as IPhlebContractReview;
  if (body?.status !== "approved" && body?.status !== "rejected") {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "status must be approved or rejected",
    }).end();
  }

  try {
    const reviewerName =
      admin.username?.trim() || admin.email?.trim() || "Admin";
    const data = await PhlebContractService.reviewContract(
      contractId,
      body,
      reviewerName
    );

    if (!data) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        error: "Contract not found",
      }).end();
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message:
        body.status === "approved"
          ? "Contract approved"
          : "Contract rejected",
      data,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

export default {
  getMyContracts,
  submitContract,
  listAllContracts,
  reviewContract,
} as const;
