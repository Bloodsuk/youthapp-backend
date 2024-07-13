import Paths from "@src/constants/Paths";
import MessageController from "@src/controllers/MessageController";
import { Router } from "express";
import jetValidator from "jet-validator/lib/jet-validator";

const validate = jetValidator();
const messageRouter = Router();

// Get all messages
messageRouter.get(Paths.Messages.Get, MessageController.getAll);

// Get messages for customer
messageRouter.get(Paths.Messages.GetCustomerMessages, MessageController.getCustomerMessages);

// Get messages for practitioner
messageRouter.get(Paths.Messages.GetPractitionerMessages, MessageController.getPractitionerMessages);

// Check if customer has unread messages
messageRouter.get(Paths.Messages.CustomerHasMessages, MessageController.customerHasMessages);

// Check if practitioner has even 1 unread message to show notificatoin on top bar
messageRouter.get(Paths.Messages.PractitionerHasMessages, MessageController.practitionerHasMessages);

// Check if practitioner has unread messages against each customers list
messageRouter.get(Paths.Messages.PractitionerHasMessagesByCustomer, MessageController.practitionerHasMessagesByCustomer);

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
