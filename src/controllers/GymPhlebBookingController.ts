import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { UserLevels } from "@src/constants/enums";
import { RouteError } from "@src/other/classes";
import GymPhlebBookingService from "@src/services/GymPhlebBookingService";
import { IReq, IRes } from "@src/types/express/misc";

function actingPlebId(res: IRes): number | undefined {
  const session = res.locals.sessionUser;
  if (session?.user_level === UserLevels.Phlebotomist) {
    return Number(session.id);
  }
  return undefined;
}

/**
 * GET /gym_phleb_bookings/pleb/:pleb_id
 */
async function getByPlebId(req: IReq, res: IRes) {
  const plebId = Number(req.params.pleb_id);
  if (!Number.isFinite(plebId) || plebId <= 0) {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ success: false, error: "Invalid pleb_id" })
      .end();
  }

  const session = res.locals.sessionUser;
  if (
    session?.user_level === UserLevels.Phlebotomist &&
    Number(session.id) !== plebId
  ) {
    return res
      .status(HttpStatusCodes.FORBIDDEN)
      .json({
        success: false,
        error: "You can only view your own gym bookings",
      })
      .end();
  }

  try {
    const data = await GymPhlebBookingService.getByPlebId(plebId);
    return res
      .status(HttpStatusCodes.OK)
      .json({ success: true, data })
      .end();
  } catch (error) {
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
}

/**
 * POST /gym_phleb_bookings/update_status/:id
 * Body: { job_status: "Assigned" | "Pickup" | "Delivered" | "Cancelled" }
 */
async function updateStatus(
  req: IReq<{ job_status: string }>,
  res: IRes
) {
  const id = Number(req.params.id);
  const jobStatus = (req.body?.job_status ?? "").toString();

  if (!Number.isFinite(id) || id <= 0) {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ success: false, error: "Invalid gym booking id" })
      .end();
  }

  if (!jobStatus.trim()) {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ success: false, error: "job_status is required" })
      .end();
  }

  try {
    const booking = await GymPhlebBookingService.updateStatus(
      id,
      jobStatus,
      actingPlebId(res)
    );
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        message: "Gym booking status updated successfully",
        data: booking,
      })
      .end();
  } catch (error) {
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
}

export default {
  getByPlebId,
  updateStatus,
} as const;
