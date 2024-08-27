import Paths from "@src/constants/Paths";
import ClinicController from "@src/controllers/ClinicController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();

const clinicRouter = Router();

// Get all clinics
clinicRouter.get(
  Paths.Clinics.Get, 
  ClinicController.getAll
);

// Get all practitioner clinics
clinicRouter.get(
  Paths.Clinics.GetPractitionerClinic, 
  ClinicController.getPractitionerClinic
);

// Get clinic By Id
clinicRouter.get(
  Paths.Clinics.GetById,
  validate(["id", "string", "params"]),
  ClinicController.getById
);

// Add one clinic
clinicRouter.post(
  Paths.Clinics.Add,
  ClinicController.add
);

// Update one clinic
clinicRouter.patch(
  Paths.Clinics.Update,
  ClinicController.update
);

// Update clinic status
clinicRouter.put(
  Paths.Clinics.Activate,
  ClinicController.activate
);

// Delete clinic user
clinicRouter.delete(
  Paths.Clinics.Delete,
  ClinicController.delete
);

export default clinicRouter;
