import Paths from "@src/constants/Paths";
import MailTemplateController from "@src/controllers/MailTemplateController";
import { Router } from "express";

// const validate = jetValidator();

const mailTemplateRouter = Router();

// Get all mailTemplates
mailTemplateRouter.get(Paths.MailTemplate.Get, MailTemplateController.getMailTemplates);

// Add one mailTemplate
mailTemplateRouter.post(Paths.MailTemplate.Add, MailTemplateController.addMailTemplate);

// Update one mailTemplate
mailTemplateRouter.patch(Paths.MailTemplate.Update, MailTemplateController.updateMailTemplate);


export default mailTemplateRouter;
