import fs from "fs";
import multer from "multer";
import path from "path";

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
    const itemKey = String((req.body as { item_key?: string }).item_key ?? "doc")
      .replace(/[^a-z0-9_]/gi, "")
      .slice(0, 40);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `phleb-${phlebId}-${itemKey}-${Date.now()}${ext}`);
  },
});

export const phlebComplianceUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images, PDFs, and documents are allowed."));
    }
  },
});
