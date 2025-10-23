import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { IPhlebotomist } from "@src/interfaces/IPhlebotomist";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { generateUniqueString } from "@src/util/misc";
import MailService from "./MailService";

// **** Variables **** //

export const Errors = {
  PhlebotomistNotFound: "Phlebotomist not found in applications",
  EmailAlreadyExists: "Email already exists in phlebotomy applications",
  InvalidCredentials: "Invalid email or password for phlebotomist",
  AccountNotActive: "Phlebotomist account is not active",
} as const;

// **** Functions **** //

/**
 * Generate a random password for phlebotomist
 */
function generatePassword(): string {
  return generateUniqueString("pleb", 8);
}

/**
 * Hash password using MD5 (matching existing system)
 */
function generateHash(password: string): string {
  const crypto = require("crypto");
  return crypto.createHash("md5").update(password).digest("hex");
}

/**
 * Check if phlebotomist exists by email
 */
async function getPhlebotomistByEmail(email: string): Promise<IPhlebotomist | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM phlebotomy_applications WHERE email = ?",
    [email]
  );
  
  return rows.length > 0 ? (rows[0] as IPhlebotomist) : null;
}

/**
 * Create password for phlebotomist and send via email
 */
async function createPasswordForPhlebotomist(email: string): Promise<string> {
  // Check if phlebotomist exists
  const phlebotomist = await getPhlebotomistByEmail(email);
  
  if (!phlebotomist) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.PhlebotomistNotFound);
  }
  
  if (phlebotomist.is_active !== 1) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, Errors.AccountNotActive);
  }
  
  // Generate new password
  const newPassword = generatePassword();
  const hashedPassword = generateHash(newPassword);
  
  // Update password in database
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE phlebotomy_applications SET password = ?, is_email_sent = 1 WHERE email = ?",
    [hashedPassword, email]
  );
  
  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Failed to update phlebotomist password");
  }
  
  // Send password via email
  try {
    await MailService.sendPhlebotomistCredentialsEmail(
      phlebotomist.full_name,
      email,
      newPassword
    );
    console.log(`✅ Phlebotomist credentials email sent to ${email}`);
  } catch (error) {
    console.error("❌ Failed to send phlebotomist credentials email:", error.message);
    // Don't throw error here as password was already created
    // The user can still login with the generated password
  }
  
  return newPassword;
}

/**
 * Authenticate phlebotomist login
 */
async function loginPhlebotomist(email: string, password: string): Promise<IPhlebotomist> {
  const hashedPassword = generateHash(password);
  
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM phlebotomy_applications WHERE email = ? AND password = ?",
    [email, hashedPassword]
  );
  
  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, Errors.InvalidCredentials);
  }
  
  const phlebotomist = rows[0] as IPhlebotomist;
  
  if (phlebotomist.is_active !== 1) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, Errors.AccountNotActive);
  }
  
  return phlebotomist;
}

/**
 * Get all phlebotomists (for admin purposes)
 */
async function getAllPhlebotomists(): Promise<IPhlebotomist[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM phlebotomy_applications ORDER BY created_at DESC"
  );
  
  return rows as IPhlebotomist[];
}

/**
 * Update phlebotomist status
 */
async function updatePhlebotomistStatus(id: number, isActive: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE phlebotomy_applications SET is_active = ? WHERE id = ?",
    [isActive, id]
  );
  
  return result.affectedRows > 0;
}

// **** Export default **** //

export default {
  getPhlebotomistByEmail,
  createPasswordForPhlebotomist,
  loginPhlebotomist,
  getAllPhlebotomists,
  updatePhlebotomistStatus,
  generatePassword,
  generateHash,
} as const;
