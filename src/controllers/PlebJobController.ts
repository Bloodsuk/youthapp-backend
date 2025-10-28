import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import PlebJobService from "@src/services/PlebJobService";

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
 * Update pleb job status
 */
async function updateStatus(req: IReq<{ id: number; job_status: string }>, res: IRes) {
  const { id } = req.params;
  const { job_status } = req.body;

  try {
    const updated = await PlebJobService.updateStatus(Number(id), job_status);
    
    if (updated) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Pleb job status updated successfully"
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

// **** Export default **** //

export default {
  getAll,
  getByPlebId,
  updateStatus,
} as const;
