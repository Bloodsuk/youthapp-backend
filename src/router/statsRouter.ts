import Paths from "@src/constants/Paths";
import StatsController from "@src/controllers/StatsController";
import { Router } from "express";
// import jetValidator from "jet-validator/lib/jet-validator";

// const validate = jetValidator();

const statsRouter = Router();

// Get all statss
statsRouter.get(Paths.Stats.Get, StatsController.getAll);


export default statsRouter;
