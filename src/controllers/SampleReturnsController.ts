import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import { RouteError } from "@src/other/classes";
import SampleReturnsService from "@src/services/SampleReturnsService";
import { IReq, IRes } from "@src/types/express/misc";

type LookupBody = { order_number?: string; email?: string };
type TokenBody = { token?: string };
type FinalizeBody = { token?: string; intent_id?: string };
type CreateBody = { token?: string; confirmed?: boolean | string };

function requirePhlebotomist(res: IRes) {
  const sessionUser = res.locals.sessionUser;
  if (sessionUser?.user_level !== UserLevels.Phlebotomist) {
    return null;
  }
  return sessionUser;
}

function handleError(res: IRes, error: unknown) {
  if (error instanceof RouteError) {
    return res
      .status(error.status)
      .json({ success: false, data: { message: error.message } })
      .end();
  }
  console.error("[SampleReturnsController]", error);
  return res
    .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
    .json({
      success: false,
      data: {
        message:
          "Internal Error: " +
          (error instanceof Error ? error.message : String(error)),
      },
    })
    .end();
}

function forbid(res: IRes) {
  return res
    .status(HttpStatusCodes.FORBIDDEN)
    .json({ success: false, data: { message: "Phlebotomist access required" } })
    .end();
}

function parseReturnId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid return_id");
  }
  return id;
}

async function lookup(req: IReq<LookupBody>, res: IRes) {
  if (!requirePhlebotomist(res)) return forbid(res);
  try {
    const orderNumber = String(req.body?.order_number || "");
    const email = String(req.body?.email || "");
    const snapshot = await SampleReturnsService.lookupOrder(orderNumber, email);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: snapshot,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function getOne(req: IReq, res: IRes) {
  if (!requirePhlebotomist(res)) return forbid(res);
  try {
    const returnId = parseReturnId(req.params.id);
    const token = String(req.query.token || "");
    const snapshot = await SampleReturnsService.getSnapshot(returnId, token);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: snapshot,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function createPaymentIntent(req: IReq<TokenBody>, res: IRes) {
  if (!requirePhlebotomist(res)) return forbid(res);
  try {
    const returnId = parseReturnId(req.params.id);
    const token = String(req.body?.token || "");
    const result = await SampleReturnsService.createPaymentIntent(
      returnId,
      token
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        ...result.snapshot,
        client_secret: result.client_secret,
        payment_intent_id: result.payment_intent_id,
        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || null,
      },
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function finalizePayment(req: IReq<FinalizeBody>, res: IRes) {
  if (!requirePhlebotomist(res)) return forbid(res);
  try {
    const returnId = parseReturnId(req.params.id);
    const snapshot = await SampleReturnsService.finalizePayment(
      returnId,
      String(req.body?.token || ""),
      String(req.body?.intent_id || "")
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: snapshot,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function createReturn(req: IReq<CreateBody>, res: IRes) {
  if (!requirePhlebotomist(res)) return forbid(res);
  try {
    const returnId = parseReturnId(req.params.id);
    const confirmed =
      req.body?.confirmed === true ||
      req.body?.confirmed === "true" ||
      req.body?.confirmed === "1";
    const snapshot = await SampleReturnsService.confirmAndCreateReturn(
      returnId,
      String(req.body?.token || ""),
      confirmed
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: snapshot,
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

async function emailQr(req: IReq<TokenBody>, res: IRes) {
  if (!requirePhlebotomist(res)) return forbid(res);
  try {
    const returnId = parseReturnId(req.params.id);
    const token = String(req.body?.token || "");
    await SampleReturnsService.emailQr(returnId, token);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { message: "QR emailed" },
    }).end();
  } catch (error) {
    return handleError(res, error);
  }
}

export default {
  lookup,
  getOne,
  createPaymentIntent,
  finalizePayment,
  createReturn,
  emailQr,
} as const;
