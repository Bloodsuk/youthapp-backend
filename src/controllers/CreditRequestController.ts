import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import CreditRequestsService from "@src/services/CreditRequestService";
import { ICreditRequest } from "@src/interfaces/ICreditRequest";
import { CreditRequestStatus } from "@src/constants/enums";

// **** Functions **** //

/**
 * Get all creditRequests.
 */
async function getAll(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const { data, total } = await CreditRequestsService.getAll(page);
  return res.status(HttpStatusCodes.OK).json({ creditRequests: data, total });
}
/**
 * Get creditRequests by user_id.
 */
async function getByUserId(req: IReq, res: IRes) { 
  const id = parseInt(req.params.user_id);
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const { data, total } = await CreditRequestsService.getByUserId(id, page);
  return res.status(HttpStatusCodes.OK).json({ creditRequests: data, total });
}

/**
 * Get pending creditRequests.
 */
async function getPending(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;

  const { data, total } = await CreditRequestsService.getPending(page);
  return res.status(HttpStatusCodes.OK).json({ creditRequests: data, total });
}
/**
 * Get approved creditRequests.
 */
async function getApproved(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const { data, total } = await CreditRequestsService.getApproved(page);
  return res.status(HttpStatusCodes.OK).json({ creditRequests: data, total });
}

/**
 * Get users balance.
 */
async function getUsersBalance(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  console.log("page",page);
  const { data, total } = await CreditRequestsService.getUsersBalances(page);
  return res.status(HttpStatusCodes.OK).json({ userBalances: data, total });
}

/**
 * Get creditRequest by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const creditRequest = await CreditRequestsService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        creditRequest: creditRequest,
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
 * Add one creditRequest.
 */
async function add(req: IReq<{ credit_request: Partial<ICreditRequest> }>, res: IRes) {
  const { credit_request } = req.body;
  if (!credit_request.user_id)
    credit_request.user_id = res.locals.sessionUser?.id;

  const id = await CreditRequestsService.addOne(credit_request);
  if (id)
    return res
      .status(HttpStatusCodes.CREATED)
      .json({
        success: true,
        id: id
      })
      .end();
  else return res.status(HttpStatusCodes.BAD_REQUEST).end();
}

/**
 * Update creditRequest status.
 */
async function update(
  req: IReq<{ credit_request: Partial<ICreditRequest> }>,
  res: IRes
) {
  const { credit_request } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await CreditRequestsService.updateOne(uid, credit_request);
    return res.status(HttpStatusCodes.OK).json({ success: true }).end();
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
 * Update creditRequest status.
 */
async function updateStatus(req: IReq<{ status: CreditRequestStatus }>, res: IRes) {
  const { status } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await CreditRequestsService.updateStatus(uid, status.valueOf());
    return res.status(HttpStatusCodes.OK).json({ success: true }).end();
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
 * Delete one creditRequest.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await CreditRequestsService.delete(uid);
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
  getByUserId,
  getPending,
  getApproved,
  getUsersBalance,
  add,
  update,
  updateStatus,
  delete: delete_,
} as const;
