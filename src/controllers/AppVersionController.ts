import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import AppVersionService from "@src/services/AppVersionService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";

// **** Functions **** //

/**
 * Get all app versions.
 */
async function getAll(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  
  try {
    const result = await AppVersionService.getAll(page);
    return res
      .status(HttpStatusCodes.OK)
      .json({ 
        success: true,
        app_versions: result.data, 
        total: result.total 
      });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        });
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        });
  }
}

/**
 * Get app version by platform.
 */
async function getByPlatform(req: IReq, res: IRes) {
  const platform = req.params.platform as 'android' | 'ios' | 'web';
  
  // Validate platform
  if (!['android', 'ios', 'web'].includes(platform)) {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({
        success: false,
        error: "Invalid platform. Must be 'android', 'ios', or 'web'",
      });
  }
  
  try {
    const appVersion = await AppVersionService.getByPlatform(platform);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        app_version: appVersion,
      });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        });
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        });
  }
}

// **** Export default **** //

export default {
  getAll,
  getByPlatform,
} as const;
