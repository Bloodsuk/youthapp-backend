import Paths from "@src/constants/Paths";
import GymPhlebBookingController from "@src/controllers/GymPhlebBookingController";
import { Router } from "express";

const gymPhlebBookingRouter = Router();

gymPhlebBookingRouter.get(
  Paths.GymPhlebBookings.GetByPlebId,
  GymPhlebBookingController.getByPlebId
);

gymPhlebBookingRouter.post(
  Paths.GymPhlebBookings.UpdateStatus,
  GymPhlebBookingController.updateStatus
);

export default gymPhlebBookingRouter;
