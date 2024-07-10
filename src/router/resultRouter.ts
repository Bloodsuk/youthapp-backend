import Paths from "@src/constants/Paths";
import ResultController from "@src/controllers/ResultController";
import { Router } from "express";
// import jetValidator from "jet-validator/lib/jet-validator";

// const validate = jetValidator();

const resultRouter = Router();

// Get all results
resultRouter.get(Paths.Results.Get, ResultController.getAll);

// Get By Id
resultRouter.get(Paths.Results.GetById, ResultController.getById);

export default resultRouter;
