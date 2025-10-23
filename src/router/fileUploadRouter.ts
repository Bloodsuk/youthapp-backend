import Paths from "@src/constants/Paths";
import FileUploadController from "@src/controllers/FileUploadController";
import { Router } from "express";

const fileUploadRouter = Router();

// File upload endpoint
fileUploadRouter.post(
  Paths.FileUpload.Upload,
  FileUploadController.upload.single('attachment'), // 'attachment' is the field name from Flutter
  FileUploadController.uploadFile
);

export default fileUploadRouter;

