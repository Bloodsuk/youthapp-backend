import Paths from "@src/constants/Paths";
import MessageController from "@src/controllers/MessageController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();
const messageRouter = Router();

// Get all messages
messageRouter.get(Paths.Messages.Get, MessageController.getAll);

// Get Message By Id
messageRouter.get(Paths.Messages.GetById, validate(["id", "string", "params"]), MessageController.getById);

// Send Messages
messageRouter.post(Paths.Messages.Send, MessageController.sendMessage);

// Update Message
messageRouter.patch(Paths.Messages.Update, MessageController.update);

// Update Message read status
messageRouter.put(Paths.Messages.MarkRead, MessageController.markRead);

// Delete the message
messageRouter.delete(Paths.Messages.Delete, MessageController.delete);

export default messageRouter;
