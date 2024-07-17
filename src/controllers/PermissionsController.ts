import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import PermissionService from "@src/services/PermissionService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";


/**
 * INFO: Get all the permissions
 * @param req 
 * @param res 
 * @returns 
 */
async function getAll(req: IReq, res: IRes) {
  try {
    let page = parseInt(req.query.page as string);
    if (isNaN(page)) page = 1;
    const search = (req.query.search as string) || "";

    const { data, total } = await PermissionService.getAll(page, search);
    return res.status(HttpStatusCodes.OK).json({ permissions: data, total });
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
 * INFO: Get permission by id
 * @param req 
 * @param res 
 * @returns 
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const permission = await PermissionService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        permission,
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
 * INFO: Add permission
 * @param req 
 * @param res 
 * @returns 
 */
async function add(req: IReq<{ permission: Record<string, any> }>, res: IRes) {
  const { permission } = req.body;
  try {
    const id = await PermissionService.addOne(permission);
    if (id)
      return res
        .status(HttpStatusCodes.CREATED)
        .json({
          success: true,
          id: id
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
 * INFO: Mark permission as read
 * @param req 
 * @param res 
 * @returns 
 */
async function markActive(req: IReq<{ permission: Record<string, any> }>, res: IRes) {
  const { permission } = req.body;
  try {
    await PermissionService.markActive(permission);
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
 * INFO: Update permission
 * @param req 
 * @param res 
 * @returns 
 */
async function update(req: IReq<{ permission: Record<string, any> }>, res: IRes) {
  const { permission } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await PermissionService.updateOne(uid, permission);
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
 * INFO: Delete permission 
 * @param req 
 * @param res 
 * @returns 
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await PermissionService.delete(uid);
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
  add,
  markActive,
  update,
  delete: delete_,
} as const;
