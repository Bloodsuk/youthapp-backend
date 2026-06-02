import Paths from "@src/constants/Paths";
import VisitChatController from "@src/controllers/VisitChatController";
import { Router } from "express";

const visitChatRouter = Router();

visitChatRouter.get(
  Paths.VisitChat.GetUnread,
  VisitChatController.getUnread
);

visitChatRouter.get(Paths.VisitChat.GetThread, VisitChatController.getThread);

visitChatRouter.post(Paths.VisitChat.Send, VisitChatController.sendMessage);

export default visitChatRouter;
