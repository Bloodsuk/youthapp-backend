import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import {
  IPlebAvailabilitySchedule,
  IPlebAvailabilityUpdateRequest,
  IPlebAvailabilityResponse,
} from "@src/interfaces/IPlebAvailability";

// **** Variables **** //

export const Errors = {
  PlebNotFound: "Pleb not found",
  PlebNotActive: "Pleb account is not active",
  InvalidAvailabilityFormat: "Invalid availability schedule format",
  InvalidTimeFormat: "Invalid time format. Use HH:mm format (e.g., 09:00)",
  InvalidTimeRange: "Start time must be before end time",
  InvalidDistance: "Distance must be greater than 0",
  InvalidUnit: "Unit must be 'miles' or 'km'",
  MissingAvailabilityDays: "All 7 days of the week must be provided",
} as const;

// **** Validation Functions **** //

/**
 * Validate time format (HH:mm)
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Convert time string to minutes since midnight for comparison
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Validate availability schedule structure
 */
function validateAvailabilitySchedule(
  availability: IPlebAvailabilitySchedule
): void {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Check all days are present
  for (const day of days) {
    if (!availability[day as keyof IPlebAvailabilitySchedule]) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `${Errors.MissingAvailabilityDays}: Missing ${day}`
      );
    }
  }

  // Validate each day
  for (const day of days) {
    const daySchedule = availability[day as keyof IPlebAvailabilitySchedule];

    if (!daySchedule || typeof daySchedule.available !== "boolean") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `${Errors.InvalidAvailabilityFormat}: ${day} must have 'available' boolean`
      );
    }

    // If available, validate time format and range
    if (daySchedule.available) {
      if (!daySchedule.start || !daySchedule.end) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `${Errors.InvalidAvailabilityFormat}: ${day} must have start and end times when available`
        );
      }

      // Validate time format
      if (!isValidTimeFormat(daySchedule.start)) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `${Errors.InvalidTimeFormat}: ${day} start time`
        );
      }

      if (!isValidTimeFormat(daySchedule.end)) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `${Errors.InvalidTimeFormat}: ${day} end time`
        );
      }

      // Validate start < end
      if (timeToMinutes(daySchedule.start) >= timeToMinutes(daySchedule.end)) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `${Errors.InvalidTimeRange}: ${day}`
        );
      }
    }
  }
}

/**
 * Validate service range
 */
function validateServiceRange(serviceRange: {
  max_distance: number;
  unit: string;
}): void {
  if (!serviceRange.max_distance || serviceRange.max_distance <= 0) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      Errors.InvalidDistance
    );
  }

  if (serviceRange.unit !== "miles" && serviceRange.unit !== "km") {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidUnit);
  }
}

/**
 * Check if pleb exists and is active
 */
async function validatePleb(plebId: number): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, is_active FROM phlebotomy_applications WHERE id = ?",
    [plebId]
  );

  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.PlebNotFound);
  }

  if (rows[0].is_active !== 1) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, Errors.PlebNotActive);
  }
}

// **** Main Functions **** //

/**
 * Get availability and range for a pleb
 */
async function getAvailabilityAndRange(
  plebId: number
): Promise<IPlebAvailabilityResponse> {
  // Validate pleb exists and is active
  await validatePleb(plebId);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      id,
      availability_schedule,
      max_distance_miles,
      max_distance_km,
      distance_unit
    FROM phlebotomy_applications 
    WHERE id = ?`,
    [plebId]
  );

  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.PlebNotFound);
  }

  const row = rows[0];

  // Parse JSON availability schedule
  let availability: IPlebAvailabilitySchedule | null = null;
  if (row.availability_schedule) {
    try {
      availability =
        typeof row.availability_schedule === "string"
          ? JSON.parse(row.availability_schedule)
          : row.availability_schedule;
    } catch (error) {
      console.error(
        `Failed to parse availability_schedule for pleb ${plebId}:`,
        error
      );
      availability = null;
    }
  }

  return {
    pleb_id: Number(row.id),
    availability,
    service_range: {
      max_distance_miles:
        row.max_distance_miles !== null
          ? Number(row.max_distance_miles)
          : null,
      max_distance_km:
        row.max_distance_km !== null ? Number(row.max_distance_km) : null,
      unit: row.distance_unit || null,
    },
  };
}

/**
 * Update availability and range for a pleb
 */
async function updateAvailabilityAndRange(
  plebId: number,
  data: IPlebAvailabilityUpdateRequest
): Promise<IPlebAvailabilityResponse> {
  // Validate pleb exists and is active
  await validatePleb(plebId);

  // Validate input data
  validateAvailabilitySchedule(data.availability);
  validateServiceRange(data.service_range);

  // Convert distance to miles if needed
  let maxDistanceMiles: number = data.service_range.max_distance;
  if (data.service_range.unit === "km") {
    maxDistanceMiles = data.service_range.max_distance / 1.60934;
  }

  // Prepare availability JSON
  const availabilityJson = JSON.stringify(data.availability);

  // Update database
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE phlebotomy_applications 
    SET 
      availability_schedule = ?,
      max_distance_miles = ?,
      distance_unit = ?
    WHERE id = ?`,
    [
      availabilityJson,
      maxDistanceMiles.toFixed(2),
      data.service_range.unit,
      plebId,
    ]
  );

  if (result.affectedRows === 0) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to update availability and range"
    );
  }

  // Return updated data
  return await getAvailabilityAndRange(plebId);
}

// **** Export default **** //

export default {
  getAvailabilityAndRange,
  updateAvailabilityAndRange,
  Errors,
} as const;


