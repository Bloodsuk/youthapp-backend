import Paths from "@src/constants/Paths";
import CategoryController from "@src/controllers/CategoryController";
import { Router } from "express";
// import jetValidator from "jet-validator/lib/jet-validator";

// const validate = jetValidator();

const categoryRouter = Router();

// Get all categorys
categoryRouter.get(Paths.Categories.Get, CategoryController.getAll);

// Get By Id
categoryRouter.get(Paths.Categories.GetById, CategoryController.getById);

// Add one category
categoryRouter.post(Paths.Categories.Add, CategoryController.add);

// Update one category
categoryRouter.patch(
  Paths.Categories.Update,
  // validate(["category", isCategory]),
  CategoryController.update
);

// Delete one category
categoryRouter.delete(
  Paths.Categories.Delete,
  // validate(["id", "number", "params"]),
  CategoryController.delete
);

export default categoryRouter;
