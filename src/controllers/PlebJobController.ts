import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import PlebJobService from "@src/services/PlebJobService";
import PhlebotomistService from "@src/services/PhlebotomistService";
import { UserLevels } from "@src/constants/enums";

// **** Functions **** //

/**
 * Get all pleb jobs
 */
async function getAll(req: IReq, res: IRes) {
  try {
    const plebJobs = await PlebJobService.getAll();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: plebJobs
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

/**
 * Get pleb jobs by pleb_id
 */
async function getByPlebId(req: IReq<{ pleb_id: number }>, res: IRes) {
  const { pleb_id } = req.params;

  try {
    const plebJobs = await PlebJobService.getByPlebId(Number(pleb_id));
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: plebJobs
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

/**
 * Update pleb job status (requires tracking number from pleb)
 */
async function updateStatus(req: IReq<{ id: number; job_status: string; tracking_number: string }>, res: IRes) {
  const { id } = req.params;
  const { job_status, tracking_number } = req.body;

  if (!tracking_number || tracking_number.trim() === '') {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "tracking_number is required"
    }).end();
  }

  if (!job_status || job_status.trim() === '') {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "job_status is required"
    }).end();
  }

  try {
    const updated = await PlebJobService.updateStatus(Number(id), job_status, tracking_number);
    
    if (updated) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Pleb job status and tracking number updated successfully"
      }).end();
    } else {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        error: "Pleb job not found"
      }).end();
    }
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
 * Get all plebs with id and name (Admin only)
 */
async function getAllPlebs(req: IReq, res: IRes) {
  const isAdmin = res.locals.sessionUser?.user_level === UserLevels.Admin;
  
  if (!isAdmin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required"
    }).end();
  }

  try {
    const plebs = await PhlebotomistService.getAllPlebsIdAndName();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: plebs
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

/**
 * Assign a job to a pleb (Admin only)
 */
async function assignJob(req: IReq<{ pleb_id: number; order_id: number; job_status?: string }>, res: IRes) {
  const isAdmin = res.locals.sessionUser?.user_level === UserLevels.Admin;
  
  if (!isAdmin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required"
    }).end();
  }

  const { pleb_id, order_id, job_status } = req.body;

  if (!pleb_id || !order_id) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "pleb_id and order_id are required"
    }).end();
  }

  try {
    const assignedJob = await PlebJobService.assignJob(
      Number(pleb_id), 
      Number(order_id), 
      job_status || "Assigned"
    );
    
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Job assigned successfully",
      data: assignedJob
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

/**
 * Get distance between pleb and customer's address (by order)
 */
async function getDistance(req: IReq<{ pleb_id: number; order_id: number }>, res: IRes) {
  const { pleb_id, order_id } = req.body;

  if (!pleb_id || !order_id) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "pleb_id and order_id are required"
    }).end();
  }

  try {
    const result = await PlebJobService.getDistanceBetweenPlebAndCustomer(Number(pleb_id), Number(order_id));
    return res.status(HttpStatusCodes.OK).json({ success: true, data: result }).end();
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
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({
          success: false,
          error: "Error calculating distance: " + (error as Error).message,
        })
        .end();
  }
}

// **** Export default **** //

export default {
  getAll,
  getByPlebId,
  updateStatus,
  getAllPlebs,
  assignJob,
  getDistance,
} as const;
