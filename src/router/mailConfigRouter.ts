import Paths from "@src/constants/Paths";
import MailConfigController from "@src/controllers/MailConfigController";
import { Router } from "express";
// import jetValidator from "jet-validator/lib/jet-validator";

// const validate = jetValidator();

const mailConfigRouter = Router();

// Get all mailConfigs
mailConfigRouter.get(Paths.MailConfig.Get, MailConfigController.getMailConfig);

// Add one mailConfig
mailConfigRouter.post(Paths.MailConfig.Add, MailConfigController.addMailConfig);

// Update one mailConfig
mailConfigRouter.patch(Paths.MailConfig.Update, MailConfigController.updateMailConfig);


export default mailConfigRouter;
