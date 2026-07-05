import fs from "fs";
import multer from "multer";
import path from "path";
import { isAllowedUpload, UPLOAD_INVALID_TYPE_MESSAGE } from "@src/utils/uploadFileFilter";

const uploadDir = path.join(process.cwd(), "public", "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const phlebId = (req as Express.Request & { phlebId?: number }).phlebId ?? "unknown";
    const field = file.fieldname.replace(/[^a-z0-9_]/gi, "").slice(0, 40);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `phleb-contract-${phlebId}-${field}-${Date.now()}${ext}`);
  },
});

export const CONTRACT_FILE_FIELDS = [
  "cv_file",
  "hep_b_proof",
  "occupational_health_records",
  "dbs_adults",
  "dbs_children",
  "right_to_work",
  "utr_file",
] as const;

export const phlebContractUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUpload(file)) {
      cb(null, true);
    } else {
      cb(new Error(UPLOAD_INVALID_TYPE_MESSAGE));
    }
  },
});

export const phlebContractUploadFields = phlebContractUpload.fields(
  CONTRACT_FILE_FIELDS.map((name) => ({ name, maxCount: 1 }))
);
