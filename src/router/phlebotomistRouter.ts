import Paths from "@src/constants/Paths";
import PhlebComplianceController from "@src/controllers/PhlebComplianceController";
import PhlebKitController from "@src/controllers/PhlebKitController";
import PhlebPerformanceController from "@src/controllers/PhlebPerformanceController";
import PhlebTrainingController from "@src/controllers/PhlebTrainingController";
import PhlebotomistController from "@src/controllers/PhlebotomistController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";
import { phlebComplianceUpload } from "@src/utils/phlebComplianceUpload";
import { UserLevels } from "@src/constants/enums";

const validate = jetValidator();

const phlebotomistRouter = Router();

// Logged-in phlebotomist profile (must be before admin routes with param overlap)
phlebotomistRouter.get(
  Paths.Phlebotomists.Profile,
  PhlebotomistController.getProfile
);

// Logged-in phlebotomist kits (npn_kit_types / npn_kit_requests)
phlebotomistRouter.get(
  Paths.Phlebotomists.KitTypes,
  PhlebKitController.getKitTypes
);
phlebotomistRouter.get(
  Paths.Phlebotomists.KitBalance,
  PhlebKitController.getKitBalance
);
phlebotomistRouter.get(
  Paths.Phlebotomists.KitRequests,
  PhlebKitController.getKitRequests
);
phlebotomistRouter.post(
  Paths.Phlebotomists.KitRequests,
  validate(["kit_type_id", "number"], ["quantity_requested", "number"]),
  PhlebKitController.createKitRequest
);

// Logged-in phlebotomist training (npn_phleb_training / service types / signoffs)
phlebotomistRouter.get(
  Paths.Phlebotomists.TrainingOverview,
  PhlebTrainingController.getOverview
);
phlebotomistRouter.get(
  Paths.Phlebotomists.TrainingMatrix,
  PhlebTrainingController.getMatrix
);
phlebotomistRouter.get(
  Paths.Phlebotomists.TrainingTasks,
  PhlebTrainingController.getTasks
);
phlebotomistRouter.get(
  Paths.Phlebotomists.TrainingCompetency,
  PhlebTrainingController.getCompetency
);

phlebotomistRouter.get(
  Paths.Phlebotomists.PerformanceOverview,
  PhlebPerformanceController.getOverview
);

// Logged-in phlebotomist compliance documents (npn_phleb_files + signoffs)
phlebotomistRouter.get(
  Paths.Phlebotomists.ComplianceOverview,
  PhlebComplianceController.getOverview
);
phlebotomistRouter.get(
  Paths.Phlebotomists.ComplianceItems,
  PhlebComplianceController.getItems
);
phlebotomistRouter.post(
  Paths.Phlebotomists.ComplianceDocuments,
  (req, res, next) => {
    const sessionUser = res.locals.sessionUser;
    if (sessionUser?.user_level !== UserLevels.Phlebotomist) {
      return res.status(403).json({
        success: false,
        error: "Phlebotomist access required",
      }).end();
    }
    (req as Express.Request & { phlebId?: number }).phlebId = sessionUser.id;
    next();
  },
  phlebComplianceUpload.single("attachment"),
  PhlebComplianceController.uploadDocument
);

// Admin review of phleb compliance uploads
phlebotomistRouter.patch(
  Paths.Phlebotomists.ComplianceDocumentReview,
  validate(["status", "string"]),
  PhlebComplianceController.reviewDocument
);

phlebotomistRouter.put(
  Paths.Phlebotomists.Profile,
  PhlebotomistController.updateProfile
);
phlebotomistRouter.patch(
  Paths.Phlebotomists.Profile,
  PhlebotomistController.updateProfile
);

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
