import Paths from "@src/constants/Paths";
import PlebJobController from "@src/controllers/PlebJobController";
import PlebAvailabilityController from "@src/controllers/PlebAvailabilityController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();

const plebJobRouter = Router();

// Get all pleb jobs
plebJobRouter.get(
  Paths.PlebJobs.Get,
  PlebJobController.getAll
);

// Get pleb jobs by pleb_id
plebJobRouter.get(
  Paths.PlebJobs.GetByPlebId,
  PlebJobController.getByPlebId
);

// Update pleb job status (requires tracking_number from pleb)
plebJobRouter.post(
  Paths.PlebJobs.UpdateStatus,
  PlebJobController.updateStatus
);

// Get all plebs with id and name (Admin only)
plebJobRouter.get(
  Paths.PlebJobs.GetAllPlebs,
  PlebJobController.getAllPlebs
);

// Assign job to pleb (Admin only)
plebJobRouter.post(
  Paths.PlebJobs.AssignJob,
  PlebJobController.assignJob
);

// Get distance between pleb and customer
plebJobRouter.post(
  Paths.PlebJobs.Distance,
  PlebJobController.getDistance
);

// Get merged calendar view (monthly) — must be before /availability/:pleb_id?
plebJobRouter.get(
  Paths.PlebJobs.GetCalendar,
  PlebAvailabilityController.getCalendar
);

// Get date-specific availability slots — must be before /availability/:pleb_id?
plebJobRouter.get(
  Paths.PlebJobs.GetDateAvailability,
  PlebAvailabilityController.getDateAvailability
);

// Add date-specific slot(s)
plebJobRouter.post(
  Paths.PlebJobs.AddDateSlot,
  PlebAvailabilityController.addDateSlot
);

// Update a date-specific slot
plebJobRouter.put(
  Paths.PlebJobs.UpdateDateSlot,
  PlebAvailabilityController.updateDateSlot
);

// Delete a date-specific slot
plebJobRouter.delete(
  Paths.PlebJobs.DeleteDateSlot,
  PlebAvailabilityController.deleteDateSlot
);

// Get day-of-week (Per Day) availability slots — must be before /availability/:pleb_id?
plebJobRouter.get(
  Paths.PlebJobs.GetDayAvailability,
  PlebAvailabilityController.getDayAvailability
);

// Add a day-of-week slot
plebJobRouter.post(
  Paths.PlebJobs.AddDaySlot,
  PlebAvailabilityController.addDaySlot
);

// Update a day-of-week slot
plebJobRouter.put(
  Paths.PlebJobs.UpdateDaySlot,
  PlebAvailabilityController.updateDaySlot
);

// Delete a day-of-week slot
plebJobRouter.delete(
  Paths.PlebJobs.DeleteDaySlot,
  PlebAvailabilityController.deleteDaySlot
);

// Get availability and range for a pleb (weekly recurring)
plebJobRouter.get(
  Paths.PlebJobs.GetAvailability,
  PlebAvailabilityController.getAvailability
);

// Update availability and range for a pleb (bulk replace weekly recurring)
plebJobRouter.put(
  Paths.PlebJobs.UpdateAvailability,
  PlebAvailabilityController.updateAvailability
);

export default plebJobRouter;
