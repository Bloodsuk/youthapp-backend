import { pool } from "@src/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { IPhlebotomist } from "@src/interfaces/IPhlebotomist";
import {
  IPhlebProfile,
  IPhlebProfileUpdate,
} from "@src/interfaces/IPhlebProfile";
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

/**
 * Get all plebs with id and name only (Admin only)
 */
async function getAllPlebsIdAndName(): Promise<{ id: number; name: string }[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, full_name as name FROM phlebotomy_applications ORDER BY id DESC"
  );
  return rows.map((row) => ({ id: row.id, name: row.name })) as { id: number; name: string }[];
}

const PROFILE_SELECT = `id, full_name, email, phone, home_address, city, home_postcode, is_active`;

function toPhlebProfile(
  row: RowDataPacket | IPhlebotomist
): IPhlebProfile {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    home_address: row.home_address ?? "",
    city: row.city ?? "",
    home_postcode: row.home_postcode ?? null,
    user_level: "Phlebotomist",
  };
}

async function getProfileById(id: number): Promise<IPhlebProfile | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${PROFILE_SELECT} FROM phlebotomy_applications WHERE id = ?`,
    [id]
  );
  if (rows.length === 0 || rows[0].is_active !== 1) return null;
  return toPhlebProfile(rows[0]);
}

async function updateProfile(
  id: number,
  data: IPhlebProfileUpdate
): Promise<IPhlebProfile> {
  const [existing] = await pool.query<RowDataPacket[]>(
    `SELECT id, email FROM phlebotomy_applications WHERE id = ? AND is_active = 1`,
    [id]
  );
  if (existing.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.PhlebotomistNotFound);
  }

  const email = data.email.trim();
  if (!email) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required");
  }

  if (email !== existing[0].email) {
    const [dup] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM phlebotomy_applications WHERE email = ? AND id != ?",
      [email, id]
    );
    if (dup.length > 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.EmailAlreadyExists);
    }
  }

  const fullName = data.full_name.trim();
  if (!fullName) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Full name is required");
  }

  const sets = [
    "full_name = ?",
    "email = ?",
    "phone = ?",
    "home_address = ?",
    "city = ?",
    "home_postcode = ?",
  ];
  const values: (string | number)[] = [
    fullName,
    email,
    data.phone?.trim() ?? "",
    data.home_address?.trim() ?? "",
    data.city?.trim() ?? "",
    data.home_postcode?.trim() ?? "",
  ];

  if (data.password && data.password.trim() !== "") {
    sets.push("password = ?");
    values.push(generateHash(data.password.trim()));
  }

  values.push(id);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE phlebotomy_applications SET ${sets.join(", ")} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.PhlebotomistNotFound);
  }

  const profile = await getProfileById(id);
  if (!profile) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.PhlebotomistNotFound);
  }
  return profile;
}

// **** Export default **** //

export default {
  getPhlebotomistByEmail,
  createPasswordForPhlebotomist,
  loginPhlebotomist,
  getAllPhlebotomists,
  updatePhlebotomistStatus,
  getAllPlebsIdAndName,
  getProfileById,
  updateProfile,
  toPhlebProfile,
  generatePassword,
  generateHash,
} as const;
