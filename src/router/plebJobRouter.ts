import Paths from "@src/constants/Paths";
import PlebJobController from "@src/controllers/PlebJobController";
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

export default plebJobRouter;
