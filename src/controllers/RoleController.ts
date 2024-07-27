import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import RoleService from "@src/services/RoleService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";


/**
 * INFO: Get all the roles
 * @param req 
 * @param res 
 * @returns 
 */
async function getAll(req: IReq, res: IRes) {
  try {
    let page = parseInt(req.query.page as string);
    if (isNaN(page)) page = 1;
    const search = (req.query.search as string) || "";

    const { data, total } = await RoleService.getAll(page, search);
    return res.status(HttpStatusCodes.OK).json({ roles: data, total });
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
 * INFO: Get all assgined permission to role
 * @param req 
 * @param res 
 * @returns 
 */
async function getAssignedRolePermission(req: IReq, res: IRes) {
  try {
    const role_id = parseInt(req.params.role_id);
    const { data, total } = await RoleService.getAssignedRolePermission(role_id);
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
 * INFO: Get role by id
 * @param req 
 * @param res 
 * @returns 
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const role = await RoleService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        role,
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
 * INFO: Add role
 * @param req 
 * @param res 
 * @returns 
 */
async function add(req: IReq<{ role: Record<string, any> }>, res: IRes) {
  const { role } = req.body;
  try {
    const id = await RoleService.addOne(role);
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
 * INFO: Mark role as read
 * @param req 
 * @param res 
 * @returns 
 */
async function markActive(req: IReq<{ role: Record<string, any> }>, res: IRes) {
  const { role } = req.body;
  try {
    await RoleService.markActive(role);
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
 * INFO: Assign role to user
 * @param req 
 * @param res 
 * @returns 
 */
async function assignRoleToUser(req: IReq<{ user_id: number, role_id: number }>, res: IRes) {
  const { user_id, role_id } = req.body;
  try {
    await RoleService.assignRoleToUser(user_id, role_id);
    return res.status(HttpStatusCodes.OK).json({ success: true, message: "Role assign to user successfully!" }).end();
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
 * INFO: Assign permission to role
 * @param req 
 * @param res 
 * @returns 
 */
async function assignPermissionToRole(req: IReq<{ role_id: number, permission_id: string }>, res: IRes) {
  const { role_id, permission_id } = req.body;
  try {
    await RoleService.assignPermissionToRole(role_id, permission_id);
    return res.status(HttpStatusCodes.OK).json({ success: true, message: "Permission assign to role successfully!" }).end();
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
 * INFO: Update role
 * @param req 
 * @param res 
 * @returns 
 */
async function update(req: IReq<{ role: Record<string, any> }>, res: IRes) {
  const { role } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await RoleService.updateOne(uid, role);
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
 * INFO: Delete role 
 * @param req 
 * @param res 
 * @returns 
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await RoleService.delete(uid);
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
  assignRoleToUser,
  assignPermissionToRole,
  update,
  delete: delete_,
  getAssignedRolePermission,
} as const;
