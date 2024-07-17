import Paths from "@src/constants/Paths";
import PermissionsController from "@src/controllers/PermissionsController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();
const permissionRouter = Router();

// Get all permissions
permissionRouter.get(Paths.Permissions.Get, PermissionsController.getAll);

// Get permission By Id
permissionRouter.get(Paths.Permissions.GetById, validate(["id", "string", "params"]), PermissionsController.getById);

// Add permission
permissionRouter.post(Paths.Permissions.Add, PermissionsController.add);

// Update permission active status
permissionRouter.put(Paths.Permissions.MarkActive, PermissionsController.markActive);

// Update permission
permissionRouter.patch(Paths.Permissions.Update, PermissionsController.update);

// Delete the permission
permissionRouter.delete(Paths.Permissions.Delete, PermissionsController.delete);

export default permissionRouter;
