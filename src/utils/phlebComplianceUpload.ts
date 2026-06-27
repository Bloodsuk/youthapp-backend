import fs from "fs";
import multer, { File } from "multer";
import path from "path";

const uploadDir = path.join(process.cwd(), "public", "uploads");

const ALLOWED_EXTENSIONS = new Set([
  ".jpeg",
  ".jpg",
  ".png",
  ".gif",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
]);

/** MIME types commonly sent by mobile clients (incl. octet-stream when type omitted). */
const ALLOWED_MIME_PREFIXES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream",
];

function isAllowedUpload(file: File): boolean {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return false;
  }
  const mime = (file.mimetype || "").toLowerCase();
  if (!mime) {
    return true;
  }
  return ALLOWED_MIME_PREFIXES.some(
    (allowed) => mime === allowed || mime.startsWith(`${allowed};`)
  );
}

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
    if (isAllowedUpload(file)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images, PDFs, and documents are allowed."));
    }
  },
});
