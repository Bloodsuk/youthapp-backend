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

// Get extracted PDF text for an order
resultRouter.get(Paths.Results.GetPdfText, ResultController.getPdfText);

// Delete By Id
resultRouter.delete(Paths.Results.Delete, ResultController.delete);

export default resultRouter;
