import Paths from "@src/constants/Paths";
import EventBookingController from "@src/controllers/EventBookingController";
import { Router } from "express";

const eventBookingRouter = Router();

eventBookingRouter.get(
  Paths.EventBookings.GetByPlebId,
  EventBookingController.getByPlebId
);

eventBookingRouter.post(
  Paths.EventBookings.UpdateStatus,
  EventBookingController.updateStatus
);

export default eventBookingRouter;
