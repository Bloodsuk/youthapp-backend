import { pool } from "@src/server";
import { RowDataPacket } from "mysql2";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

// **** Interfaces **** //

export interface IExtraDiscountUser {
  id: number;
  practitioner_id: number;
  created_at: string;
}

// **** Functions **** //

/**
 * Get all practitioner IDs from extra_discount_to_users table
 */
async function getPractitionerIds(): Promise<number[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT practitioner_id FROM extra_discount_to_users ORDER BY created_at DESC"
    );
    
    const practitionerIds = rows.map((row) => {
      const id = parseInt(row.practitioner_id);
      if (isNaN(id)) {
        return null;
      }
      return id;
    }).filter(id => id !== null);
    
    return practitionerIds as number[];
  } catch (error) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to fetch practitioner IDs: " + error
    );
  }
}

/**
 * Get all extra discount users with full details
 */
async function getAllExtraDiscountUsers(): Promise<IExtraDiscountUser[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, practitioner_id, created_at FROM extra_discount_to_users ORDER BY created_at DESC"
    );
    
    const users = rows.map((row) => ({
      id: parseInt(row.id),
      practitioner_id: parseInt(row.practitioner_id),
      created_at: row.created_at,
    })) as IExtraDiscountUser[];
    
    return users;
  } catch (error) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to fetch extra discount users: " + error
    );
  }
}

// **** Export default **** //

export default {
  getPractitionerIds,
  getAllExtraDiscountUsers,
} as const;
