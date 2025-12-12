import { pool } from "@src/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import {
  IPlebAvailabilitySlot,
  IPlebWeeklyAvailability,
  IPlebAvailabilityUpdateRequest,
  IPlebAvailabilityResponse,
  IPlebAvailableForBooking,
} from "@src/interfaces/IPlebAvailability";
import fetch from "node-fetch";
import moment from "moment";

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
  MissingBookingDate: "booking_date is required",
  MissingBookingTime: "booking_time is required",
  MissingCustomerAddress: "A valid customer address is required",
  GoogleMapsNotConfigured: "GOOGLE_MAPS_API_KEY is not configured",
  DistanceLookupFailed: "Failed to calculate distance to customer address",
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
 * Normalize booking time (accepts HH:mm, HH:mm:ss or h:mm A) to HH:mm
 */
function normalizeBookingTime(time: string): string {
  const parsed = moment(time, ["HH:mm", "H:mm", "HH:mm:ss", "H:mm:ss", "h:mm A", "h:mmA"], true);
  if (!parsed.isValid()) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      Errors.InvalidTimeFormat
    );
  }
  return parsed.format("HH:mm");
}

/**
 * Calculate distance between a pleb's coordinates and a destination address
 */
async function getDistanceToAddress(
  plebLat: number,
  plebLng: number,
  customerAddress: string
): Promise<{ distance_text: string; distance_value: number }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      Errors.GoogleMapsNotConfigured
    );
  }

  const origins = encodeURIComponent(`${plebLat},${plebLng}`);
  const destinations = encodeURIComponent(customerAddress);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&units=metric&key=${apiKey}`;

  let resp;
  try {
    resp = await fetch(url);
  } catch (error) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      `${Errors.DistanceLookupFailed}: network error`
    );
  }

  if (!resp.ok) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      `${Errors.DistanceLookupFailed}: ${resp.statusText}`
    );
  }

  const data = await resp.json();
  if (
    data.status !== "OK" ||
    !data.rows?.[0]?.elements?.[0] ||
    data.rows[0].elements[0].status !== "OK"
  ) {
    const message =
      data.error_message ||
      data.rows?.[0]?.elements?.[0]?.status ||
      "UNKNOWN";
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      `${Errors.DistanceLookupFailed}: ${message}`
    );
  }

  const element = data.rows[0].elements[0];
  return {
    distance_text: element.distance.text,
    distance_value: element.distance.value,
  };
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

type IPlebAvailabilityRow = RowDataPacket & {
  pleb_id: number;
  full_name: string;
  email?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  max_distance_miles: number;
};

/**
 * Find active plebs who are available for a specific booking slot and within their travel range
 */
async function getAvailablePlebsForBooking(params: {
  booking_date: string;
  booking_time: string;
  customer_address: string;
}): Promise<IPlebAvailableForBooking[]> {
  const { booking_date, booking_time, customer_address } = params;

  if (!booking_date) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.MissingBookingDate);
  }
  if (!booking_time) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.MissingBookingTime);
  }
  const trimmedAddress = customer_address?.trim();
  if (!trimmedAddress) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      Errors.MissingCustomerAddress
    );
  }

  const bookingDate = moment(booking_date, ["YYYY-MM-DD", moment.ISO_8601], true);
  if (!bookingDate.isValid()) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Invalid booking_date format. Use YYYY-MM-DD"
    );
  }
  const dayOfWeek = bookingDate.format("dddd");
  const normalizedTime = normalizeBookingTime(booking_time);
  const sqlTime = `${normalizedTime}:00`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      pleb.id AS pleb_id,
      pleb.full_name,
      pleb.email,
      pleb.phone,
      pleb.lat,
      pleb.lng,
      avail.day_of_week,
      avail.start_time,
      avail.end_time,
      avail.max_distance_miles
    FROM phlebotomy_applications pleb
    INNER JOIN pleb_availability avail ON pleb.id = avail.pleb_id
    WHERE pleb.is_active = 1
      AND avail.is_available = 1
      AND avail.day_of_week = ?
      AND avail.start_time <= ?
      AND avail.end_time > ?`,
    [dayOfWeek, sqlTime, sqlTime]
  );

  const uniqueRows = new Map<number, IPlebAvailabilityRow>();
  rows.forEach((row) => {
    const plebId = Number((row as IPlebAvailabilityRow).pleb_id);
    if (!uniqueRows.has(plebId)) {
      uniqueRows.set(plebId, row as IPlebAvailabilityRow);
    }
  });

  const results: IPlebAvailableForBooking[] = [];

  for (const row of uniqueRows.values()) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const maxDistanceMiles = Number(row.max_distance_miles);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(maxDistanceMiles) ||
      maxDistanceMiles <= 0
    ) {
      continue;
    }

    const distance = await getDistanceToAddress(lat, lng, trimmedAddress);
    const distanceMiles = distance.distance_value / 1609.34;
    const distanceKm = distance.distance_value / 1000;

    if (distanceMiles <= maxDistanceMiles) {
      results.push({
        pleb_id: Number(row.pleb_id),
        full_name: String(row.full_name),
        email: row.email ?? null,
        phone: row.phone ?? null,
        max_distance_miles: maxDistanceMiles,
        slot: {
          day_of_week: String(row.day_of_week),
          start_time: String(row.start_time).substring(0, 5),
          end_time: String(row.end_time).substring(0, 5),
        },
        distance_miles: Number(distanceMiles.toFixed(2)),
        distance_km: Number(distanceKm.toFixed(2)),
        distance_text: distance.distance_text,
      });
    }
  }

  results.sort((a, b) => a.distance_miles - b.distance_miles);
  return results;
}

// **** Export default **** //

export default {
  getAvailabilityAndRange,
  updateAvailabilityAndRange,
  getAvailablePlebsForBooking,
  Errors,
} as const;
