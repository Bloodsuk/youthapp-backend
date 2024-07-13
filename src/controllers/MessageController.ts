import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import MessageService from "@src/services/MessageService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";


/**
 * INFO: Get all the messages
 * @param req 
 * @param res 
 * @returns 
 */
async function getAll(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";

  const { data, total } = await MessageService.getAll(page, search);
  return res.status(HttpStatusCodes.OK).json({ messages: data, total });
}

/**
 * INFO: Get message by id
 * @param req 
 * @param res 
 * @returns 
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const message = await MessageService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        message,
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
 * INFO: Get messages for customer
 * @param req 
 * @param res 
 * @returns 
 */
async function getCustomerMessages(req: IReq, res: IRes) {
  const customer_id = parseInt(req.params.customer_id);
  const practitioner_id = parseInt(req.params.practitioner_id);
  try {
    const { data, total } = await MessageService.getCustomerMessages(customer_id, practitioner_id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        messages: data,
        total
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
 * INFO: Get messages for practitioner
 * @param req 
 * @param res 
 * @returns 
 */
async function getPractitionerMessages(req: IReq, res: IRes) {
  const customer_id = parseInt(req.params.customer_id);
  const practitioner_id = parseInt(req.params.practitioner_id);
  try {
    const { data, total } = await MessageService.getPractitionerMessages(customer_id, practitioner_id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        messages: data,
        total
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
 * INFO: Check if customer has unread messages
 * @param req 
 * @param res 
 * @returns 
 */
async function customerHasMessages(req: IReq, res: IRes) {
  const customer_id = parseInt(req.params.customer_id);
  const practitioner_id = parseInt(req.params.practitioner_id);
  try {
    const messages = await MessageService.customerHasMessages(customer_id, practitioner_id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        messages,
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
 * INFO: Check if practitioner has even 1 unread message to show notificatoin on top bar
 * @param req 
 * @param res 
 * @returns 
 */
async function practitionerHasMessages(req: IReq, res: IRes) {
  const practitioner_id = parseInt(req.params.practitioner_id);
  try {
    const messages = await MessageService.practitionerHasMessages(practitioner_id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        messages,
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
 * INFO: Check if practitioner has unread messages against each customers list
 * @param req 
 * @param res 
 * @returns 
 */
async function practitionerHasMessagesByCustomer(req: IReq, res: IRes) {
  const practitioner_id = parseInt(req.params.practitioner_id);
  try {
    const { data, total } = await MessageService.practitionerHasMessagesByCustomer(practitioner_id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        messages: data,
        total
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
 * INFO: Send message
 * @param req 
 * @param res 
 * @returns 
 */
async function sendMessage(req: IReq<{ message: Record<string, any> }>, res: IRes) {
  const { message } = req.body;

  const id = await MessageService.addOne(message);
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
 * INFO: Update message
 * @param req 
 * @param res 
 * @returns 
 */
async function update(req: IReq<{ message: Record<string, any> }>, res: IRes) {
  const { message } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await MessageService.updateOne(uid, message);
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
 * INFO: Mark message as read
 * @param req 
 * @param res 
 * @returns 
 */
async function markRead(req: IReq<{ message: Record<string, any> }>, res: IRes) {
  const { message } = req.body;
  try {
    await MessageService.markRead(message);
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
 * INFO: Delete message 
 * @param req 
 * @param res 
 * @returns 
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await MessageService.delete(uid);
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

export default {
  getAll,
  getById,
  getCustomerMessages,
  getPractitionerMessages,
  customerHasMessages,
  practitionerHasMessages,
  practitionerHasMessagesByCustomer,
  sendMessage,
  update,
  markRead,
  delete: delete_,
} as const;
