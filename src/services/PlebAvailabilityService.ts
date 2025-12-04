import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import {
  IPlebAvailabilitySlot,
  IPlebWeeklyAvailability,
  IPlebAvailabilityUpdateRequest,
  IPlebAvailabilityResponse,
} from "@src/interfaces/IPlebAvailability";

// **** Variables **** //

export const Errors = {
  PlebNotFound: "Pleb not found",
  PlebNotActive: "Pleb account is not active",
  InvalidTimeFormat: "Invalid time format. Use HH:mm format (e.g., 09:00)",
  InvalidTimeRange: "Start time must be before end time",
  OverlappingSlots: "Time slots cannot overlap on the same day",
  InvalidDistance: "Distance must be greater than 0",
  InvalidUnit: "Unit must be 'miles' or 'km'",
  MissingAvailability: "Availability schedule is required",
} as const;

// **** Validation Functions **** //

/**
 * Validate time format (HH:mm or HH:mm:ss)
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:([0-5][0-9]))?$/;
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
 * Normalize time string to HH:mm format
 */
function normalizeTime(time: string): string {
  const parts = time.split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);

  return (
    (start1Min < end2Min && end1Min > start2Min) ||
    (start2Min < end1Min && end2Min > start1Min)
  );
}

/**
 * Validate and check for overlapping slots in a day
 */
function validateDaySlots(daySlots: Array<{ start_time: string; end_time: string }>): void {
  for (let i = 0; i < daySlots.length; i++) {
    const slot1 = daySlots[i];

    // Validate time format
    if (!isValidTimeFormat(slot1.start_time)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `${Errors.InvalidTimeFormat}: Slot ${i + 1} start time`
      );
    }

    if (!isValidTimeFormat(slot1.end_time)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `${Errors.InvalidTimeFormat}: Slot ${i + 1} end time`
      );
    }

    // Validate start < end
    if (timeToMinutes(slot1.start_time) >= timeToMinutes(slot1.end_time)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `${Errors.InvalidTimeRange}: Slot ${i + 1}`
      );
    }

    // Check for overlaps with other slots
    for (let j = i + 1; j < daySlots.length; j++) {
      const slot2 = daySlots[j];
      if (
        timeRangesOverlap(
          slot1.start_time,
          slot1.end_time,
          slot2.start_time,
          slot2.end_time
        )
      ) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `${Errors.OverlappingSlots}: Slot ${i + 1} overlaps with slot ${j + 1}`
        );
      }
    }
  }
}

/**
 * Validate availability schedule
 */
function validateAvailabilitySchedule(availability: IPlebWeeklyAvailability): void {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  for (const day of days) {
    const daySlots = availability[day as keyof IPlebWeeklyAvailability];
    if (!Array.isArray(daySlots)) {
      continue; // Empty day is allowed
    }

    // Filter only available slots for overlap checking
    const availableSlots = daySlots
      .filter((slot) => slot.is_available !== false)
      .map((slot) => ({
        start_time: normalizeTime(slot.start_time),
        end_time: normalizeTime(slot.end_time),
      }));

    if (availableSlots.length > 0) {
      validateDaySlots(availableSlots);
    }
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
  await validatePleb(plebId);

  // Get all availability slots
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      id,
      pleb_id,
      day_of_week,
      start_time,
      end_time,
      is_available,
      max_distance_miles,
      max_distance_km,
      unit
    FROM pleb_availability 
    WHERE pleb_id = ?
    ORDER BY 
      FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
      start_time ASC`,
    [plebId]
  );

  // Group by day of week
  const availability: IPlebWeeklyAvailability = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  let serviceRange = {
    max_distance_miles: 0,
    max_distance_km: 0,
    unit: 'miles' as 'miles' | 'km',
  };

  for (const row of rows) {
    const day = row.day_of_week as keyof IPlebWeeklyAvailability;
    const startTime = String(row.start_time).substring(0, 5); // HH:mm format
    const endTime = String(row.end_time).substring(0, 5);

    availability[day].push({
      id: Number(row.id),
      start_time: startTime,
      end_time: endTime,
      is_available: Number(row.is_available) === 1,
    });

    // Get service range from first row (same for all rows)
    if (serviceRange.max_distance_miles === 0) {
      serviceRange = {
        max_distance_miles: Number(row.max_distance_miles),
        max_distance_km: Number(row.max_distance_km),
        unit: row.unit || 'miles',
      };
    }
  }

  return {
    pleb_id: plebId,
    availability,
    service_range: serviceRange,
  };
}

/**
 * Update availability and range for a pleb
 * This replaces all existing slots with new ones
 */
async function updateAvailabilityAndRange(
  plebId: number,
  data: IPlebAvailabilityUpdateRequest
): Promise<IPlebAvailabilityResponse> {
  await validatePleb(plebId);

  // Validate input
  if (!data.availability) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.MissingAvailability);
  }

  validateAvailabilitySchedule(data.availability);

  if (!data.service_range || !data.service_range.max_distance || data.service_range.max_distance <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidDistance);
  }

  if (data.service_range.unit !== "miles" && data.service_range.unit !== "km") {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidUnit);
  }

  // Convert distance to miles if needed
  let maxDistanceMiles: number = data.service_range.max_distance;
  if (data.service_range.unit === "km") {
    maxDistanceMiles = data.service_range.max_distance / 1.60934;
  }

  // Start transaction
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // Delete all existing slots for this pleb
    await connection.query<ResultSetHeader>(
      "DELETE FROM pleb_availability WHERE pleb_id = ?",
      [plebId]
    );

    // Insert new slots
    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    for (const day of days) {
      const daySlots = data.availability[day as keyof IPlebWeeklyAvailability];
      if (!Array.isArray(daySlots) || daySlots.length === 0) {
        continue; // Skip empty days
      }

      for (const slot of daySlots) {
        const startTime = normalizeTime(slot.start_time) + ":00"; // Convert to TIME format
        const endTime = normalizeTime(slot.end_time) + ":00";
        const isAvailable = slot.is_available !== false ? 1 : 0;

        await connection.query<ResultSetHeader>(
          `INSERT INTO pleb_availability 
          (pleb_id, day_of_week, start_time, end_time, is_available, max_distance_miles, unit)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            plebId,
            day,
            startTime,
            endTime,
            isAvailable,
            maxDistanceMiles.toFixed(2),
            data.service_range.unit,
          ]
        );
      }
    }

    await connection.commit();
    connection.release();

    // Return updated data
    return await getAvailabilityAndRange(plebId);
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}

// **** Export default **** //

export default {
  getAvailabilityAndRange,
  updateAvailabilityAndRange,
  Errors,
} as const;
