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

// Update pleb job status
plebJobRouter.post(
  Paths.PlebJobs.UpdateStatus,
  validate("job_status"),
  PlebJobController.updateStatus
);

export default plebJobRouter;
