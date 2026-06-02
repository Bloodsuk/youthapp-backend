import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import VisitChatService from "@src/services/VisitChatService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";

async function getThread(req: IReq, res: IRes) {
  const orderId = parseInt(req.params.order_id, 10);
  const sessionUser = res.locals.sessionUser;
  if (!sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" })
      .end();
  }
  try {
    const { messages, meta } = await VisitChatService.getThread(
      sessionUser,
      orderId
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      messages,
      meta,
      total: messages.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getUnread(req: IReq, res: IRes) {
  const orderId = parseInt(req.params.order_id, 10);
  const sessionUser = res.locals.sessionUser;
  if (!sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" })
      .end();
  }
  try {
    const unread_count = await VisitChatService.getUnreadCount(
      sessionUser,
      orderId
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      unread_count,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function sendMessage(
  req: IReq<{ message: Record<string, unknown> }>,
  res: IRes
) {
  const payload = req.body.message ?? {};
  const orderId = parseInt(String(payload.order_id ?? ""), 10);
  const text = String(payload.message ?? "");
  const sessionUser = res.locals.sessionUser;
  if (!sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" })
      .end();
  }
  try {
    const id = await VisitChatService.sendMessage(
      sessionUser,
      orderId,
      text
    );
    return res.status(HttpStatusCodes.CREATED).json({ success: true, id });
  } catch (error) {
    return handleError(res, error);
  }
}

function handleError(res: IRes, error: unknown) {
  if (error instanceof RouteError) {
    return res
      .status(error.status)
      .json({ success: false, error: error.message })
      .end();
  }
  return res
    .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
    .json({ success: false, error: "Internal Error: " + error })
    .end();
}

export default {
  getThread,
  getUnread,
  sendMessage,
} as const;
