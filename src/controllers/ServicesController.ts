import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import ServicesService from "@src/services/ServicesService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import { IService } from "@src/interfaces/IService";

// **** Functions **** //

/**
 * Get all services.
 */
async function getAll(req: IReq, res: IRes) {
  const services = await ServicesService.getAll();
  return res.status(HttpStatusCodes.OK).json({ services });
}

/**
 * Get service by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const service = await ServicesService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        service: service,
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
 * Add one service.
 */
async function add(req: IReq<{ service: Partial<IService> }>, res: IRes) {
  const { service } = req.body;

  const id = await ServicesService.addOne(service);
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
 * Update one service.
 */
async function update(req: IReq<{ service: Record<string, any> }>, res: IRes) {
  const { service } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await ServicesService.updateOne(uid, service);
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
 * Delete one service.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await ServicesService.delete(uid);
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
  add,
  update,
  delete: delete_,
} as const;
