import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "@src/server";
import { ResultSetHeader } from "mysql2";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  }
});

// **** Functions **** //

// **** Types **** //

interface IFileUploadReq {
  order_id: number;
  customer_id: number;
  user_id: number;
  sec_token: string;
}

/**
 * Handle file upload for orders
 */
async function uploadFile(req: IReq<IFileUploadReq>, res: IRes) {
  try {
    const { order_id, customer_id, user_id, sec_token } = req.body;
    
    // Validate required fields
    if (!order_id || !customer_id || !user_id || !sec_token) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Missing required fields: order_id, customer_id, user_id, sec_token"
      });
    }

    // Validate security token (you might want to implement proper token validation)
    if (sec_token !== "Awc2b3s8k9j4f1l0k8j5s2a1b0Fv") {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Invalid security token"
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const file = req.file;
    const filePath = `uploads/${file.filename}`;

    // Update order with attachment path
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE orders SET attachment = ? WHERE id = ? AND customer_id = ?",
      [filePath, order_id, customer_id]
    );

    if (result.affectedRows === 0) {
      // Clean up uploaded file if order update failed
      fs.unlinkSync(file.path);
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Order not found or access denied"
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        order_id: order_id,
        file_name: file.originalname,
        file_path: filePath,
        file_size: file.size,
        uploaded_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("File upload error:", error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (error instanceof RouteError) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    } else {
      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "File upload failed: " + error.message
      });
    }
  }
}

// **** Export default **** //

export default {
  uploadFile,
  upload // Export multer middleware for use in routes
} as const;

