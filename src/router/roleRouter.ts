import Paths from "@src/constants/Paths";
import RoleController from "@src/controllers/RoleController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();
const roleRouter = Router();

// Get all roles
roleRouter.get(Paths.Roles.Get, RoleController.getAll);

// Get role By Id
roleRouter.get(Paths.Roles.GetById, validate(["id", "string", "params"]), RoleController.getById);

// Add role
roleRouter.post(Paths.Roles.Add, RoleController.add);

// Update role active status
roleRouter.put(Paths.Roles.MarkActive, RoleController.markActive);

// Assign role to user
roleRouter.put(Paths.Roles.AssignRoleToUser, RoleController.assignRoleToUser);

// Assign permission to role
roleRouter.put(Paths.Roles.AssignPermissionToRole, RoleController.assignPermissionToRole);

// Update role
roleRouter.patch(Paths.Roles.Update, RoleController.update);

// Delete the role
roleRouter.delete(Paths.Roles.Delete, RoleController.delete);

export default roleRouter;
