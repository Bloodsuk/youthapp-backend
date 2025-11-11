import Paths from "@src/constants/Paths";
import PhlebotomistController from "@src/controllers/PhlebotomistController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();

const phlebotomistRouter = Router();

// Get all phlebotomists (Admin only)
phlebotomistRouter.get(
  Paths.Phlebotomists.Get,
  PhlebotomistController.getAll
);

// Update phlebotomist status (Admin only)
phlebotomistRouter.post(
  Paths.Phlebotomists.UpdateStatus,
  validate("id", "is_active"),
  PhlebotomistController.updateStatus
);

// Resend credentials to phlebotomist (Admin only)
phlebotomistRouter.post(
  Paths.Phlebotomists.ResendCredentials,
  validate("email"),
  PhlebotomistController.resendCredentials
);

export default phlebotomistRouter;
