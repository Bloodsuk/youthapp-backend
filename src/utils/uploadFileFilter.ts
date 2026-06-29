import path from "path";

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

export const UPLOAD_INVALID_TYPE_MESSAGE =
  "Invalid file type. Only images, PDFs, and documents are allowed.";

/** Extension-first check; tolerates missing/octet-stream MIME from mobile multipart uploads. */
export function isAllowedUpload(file: {
  originalname: string;
  mimetype: string;
}): boolean {
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
