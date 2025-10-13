import Paths from "@src/constants/Paths";
import AppVersionController from "@src/controllers/AppVersionController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();

const appVersionRouter = Router();

// Get all app versions
appVersionRouter.get(Paths.AppVersions.Get, AppVersionController.getAll);

// Get app version by platform
appVersionRouter.get(Paths.AppVersions.GetByPlatform, validate(["platform", "string", "params"]), AppVersionController.getByPlatform);

export default appVersionRouter;
