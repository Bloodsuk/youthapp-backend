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
  IPlebDateAvailabilitySlot,
  IPlebDateSlotCreateRequest,
  IPlebDateSlotUpdateRequest,
  IPlebDaySlotCreateRequest,
  IPlebDaySlotUpdateRequest,
  IPlebCalendarDay,
  IPlebCalendarResponse,
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
  GoogleMapsNotConfigured: "Distance lookup is not available right now. Please try again later.",
  DistanceLookupFailed: "Failed to calculate distance to customer address",
  DistanceOrderNotFound: "Order not found.",
  DistancePlebLocationNotSet:
    "This phlebotomist has no map location set. Add latitude and longitude on their profile, then try again.",
  DistanceMapsNetworkError: "Could not reach the maps service. Check your connection and try again.",
  DistanceMapsHttpError: "The maps service returned an error. Please try again in a few minutes.",
  DistanceMapsInvalidResponse: "Could not read distance from the maps service. Please try again.",
  DistanceGeocodeFailed:
    "The phlebotomist's location or the customer address could not be found on the map. Check both are complete and correct.",
  DistanceNoDrivingRoute:
    "No driving route was found between the phlebotomist and this address. The address may be incomplete or not reachable by road from their location.",
  DistanceRouteTooLong: "The driving route is too long for the maps service to calculate. Check that the addresses are correct.",
  DistanceMapsQuotaOrAccess:
    "Distance lookup is temporarily limited. Please try again later or contact support if this continues.",
  DistanceMapsUnknownError: "The maps service had a problem. Please try again shortly.",
  DaySlotNotFound: "Day slot not found",
  InvalidDayOfWeek: "Invalid day_of_week. Must be Monday-Sunday",
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
  if (data.status !== "OK") {
    const top = data.status as string;
    if (
      top === "OVER_QUERY_LIMIT" ||
      top === "OVER_DAILY_LIMIT" ||
      top === "REQUEST_DENIED"
    ) {
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        Errors.DistanceMapsQuotaOrAccess
      );
    }
    if (top === "INVALID_REQUEST") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.DistanceGeocodeFailed);
    }
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      Errors.DistanceMapsUnknownError
    );
  }
  if (!data.rows?.[0]?.elements?.[0]) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      Errors.DistanceMapsInvalidResponse
    );
  }
  const elementStatus = data.rows[0].elements[0].status as string;
  if (elementStatus !== "OK") {
    if (elementStatus === "NOT_FOUND") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.DistanceGeocodeFailed);
    }
    if (elementStatus === "ZERO_RESULTS") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.DistanceNoDrivingRoute);
    }
    if (elementStatus === "MAX_ROUTE_LENGTH_EXCEEDED") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.DistanceRouteTooLong);
    }
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.DistanceLookupFailed);
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

  // Get weekly recurring availability slots (specific_date IS NULL)
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
    WHERE pleb_id = ? AND specific_date IS NULL
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
    // Delete only weekly recurring slots (preserve date-specific entries)
    await connection.query<ResultSetHeader>(
      "DELETE FROM pleb_availability WHERE pleb_id = ? AND specific_date IS NULL",
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

// **** Date-Specific Availability CRUD **** //

/**
 * Get date-specific availability slots for a pleb within a date range
 */
async function getDateAvailability(
  plebId: number,
  startDate: string,
  endDate: string
): Promise<IPlebDateAvailabilitySlot[]> {
  await validatePleb(plebId);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, pleb_id, specific_date, start_time, end_time, is_available,
            max_distance_miles, max_distance_km, unit, notes, created_at, updated_at
     FROM pleb_availability
     WHERE pleb_id = ? AND specific_date IS NOT NULL AND specific_date >= ? AND specific_date <= ?
     ORDER BY specific_date ASC, start_time ASC`,
    [plebId, startDate, endDate]
  );

  return rows.map((row) => ({
    id: row.id,
    pleb_id: row.pleb_id,
    specific_date: moment(row.specific_date).format("YYYY-MM-DD"),
    start_time: String(row.start_time).substring(0, 5),
    end_time: String(row.end_time).substring(0, 5),
    is_available: Number(row.is_available),
    max_distance_miles: Number(row.max_distance_miles),
    max_distance_km: Number(row.max_distance_km),
    unit: row.unit || "miles",
    notes: row.notes || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Add one or more date-specific availability slots
 */
async function addDateSlots(
  plebId: number,
  data: IPlebDateSlotCreateRequest
): Promise<{ ids: number[] }> {
  await validatePleb(plebId);

  const { slots, service_range } = data;

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "At least one slot is required");
  }

  if (!service_range || !service_range.max_distance || service_range.max_distance <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidDistance);
  }

  if (service_range.unit !== "miles" && service_range.unit !== "km") {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidUnit);
  }

  let maxDistanceMiles = service_range.max_distance;
  if (service_range.unit === "km") {
    maxDistanceMiles = service_range.max_distance / 1.60934;
  }

  // Validate all slots
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    if (!slot.specific_date) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, `Slot ${i + 1}: specific_date is required`);
    }

    const parsedDate = moment(slot.specific_date, "YYYY-MM-DD", true);
    if (!parsedDate.isValid()) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, `Slot ${i + 1}: Invalid date format. Use YYYY-MM-DD`);
    }

    if (!slot.start_time || !slot.end_time) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, `Slot ${i + 1}: start_time and end_time are required`);
    }

    if (!isValidTimeFormat(slot.start_time) || !isValidTimeFormat(slot.end_time)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, `Slot ${i + 1}: ${Errors.InvalidTimeFormat}`);
    }

    if (timeToMinutes(slot.start_time) >= timeToMinutes(slot.end_time)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, `Slot ${i + 1}: ${Errors.InvalidTimeRange}`);
    }
  }

  // Check for overlaps within the submitted slots (same date)
  const slotsByDate = new Map<string, Array<{ start_time: string; end_time: string; index: number }>>();
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const dateKey = slot.specific_date;
    if (!slotsByDate.has(dateKey)) {
      slotsByDate.set(dateKey, []);
    }
    slotsByDate.get(dateKey)!.push({
      start_time: normalizeTime(slot.start_time),
      end_time: normalizeTime(slot.end_time),
      index: i,
    });
  }

  for (const [dateKey, dateSlots] of slotsByDate) {
    for (let i = 0; i < dateSlots.length; i++) {
      for (let j = i + 1; j < dateSlots.length; j++) {
        if (timeRangesOverlap(
          dateSlots[i].start_time, dateSlots[i].end_time,
          dateSlots[j].start_time, dateSlots[j].end_time
        )) {
          throw new RouteError(
            HttpStatusCodes.BAD_REQUEST,
            `Slots ${dateSlots[i].index + 1} and ${dateSlots[j].index + 1} overlap on ${dateKey}`
          );
        }
      }
    }

    // Check overlaps with existing slots on same dates
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT start_time, end_time FROM pleb_availability
       WHERE pleb_id = ? AND specific_date = ? AND is_available = 1`,
      [plebId, dateKey]
    );

    for (const newSlot of dateSlots) {
      for (const existRow of existing) {
        const existStart = String(existRow.start_time).substring(0, 5);
        const existEnd = String(existRow.end_time).substring(0, 5);
        if (timeRangesOverlap(newSlot.start_time, newSlot.end_time, existStart, existEnd)) {
          throw new RouteError(
            HttpStatusCodes.BAD_REQUEST,
            `Slot ${newSlot.index + 1} overlaps with an existing slot on ${dateKey}`
          );
        }
      }
    }
  }

  // Insert all slots
  const ids: number[] = [];
  for (const slot of slots) {
    const startTime = normalizeTime(slot.start_time) + ":00";
    const endTime = normalizeTime(slot.end_time) + ":00";
    const isAvailable = slot.is_available !== false ? 1 : 0;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO pleb_availability
       (pleb_id, specific_date, start_time, end_time, is_available, max_distance_miles, unit, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plebId,
        slot.specific_date,
        startTime,
        endTime,
        isAvailable,
        maxDistanceMiles.toFixed(2),
        service_range.unit,
        slot.notes || null,
      ]
    );
    ids.push(result.insertId);
  }

  return { ids };
}

/**
 * Update a single date-specific availability slot
 */
async function updateDateSlot(
  plebId: number,
  slotId: number,
  data: IPlebDateSlotUpdateRequest
): Promise<void> {
  await validatePleb(plebId);

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, specific_date, start_time, end_time FROM pleb_availability WHERE id = ? AND pleb_id = ? AND specific_date IS NOT NULL",
    [slotId, plebId]
  );

  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Date slot not found");
  }

  const existing = rows[0];
  const newDate = data.specific_date || moment(existing.specific_date).format("YYYY-MM-DD");
  const newStartTime = data.start_time ? normalizeTime(data.start_time) : String(existing.start_time).substring(0, 5);
  const newEndTime = data.end_time ? normalizeTime(data.end_time) : String(existing.end_time).substring(0, 5);

  if (data.specific_date) {
    const parsedDate = moment(data.specific_date, "YYYY-MM-DD", true);
    if (!parsedDate.isValid()) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid date format. Use YYYY-MM-DD");
    }
  }

  if (data.start_time && !isValidTimeFormat(data.start_time)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidTimeFormat);
  }
  if (data.end_time && !isValidTimeFormat(data.end_time)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidTimeFormat);
  }

  if (timeToMinutes(newStartTime) >= timeToMinutes(newEndTime)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidTimeRange);
  }

  // Check overlap with other date slots (exclude current)
  const [otherSlots] = await pool.query<RowDataPacket[]>(
    `SELECT start_time, end_time FROM pleb_availability
     WHERE pleb_id = ? AND specific_date = ? AND id != ? AND is_available = 1`,
    [plebId, newDate, slotId]
  );

  for (const row of otherSlots) {
    const existStart = String(row.start_time).substring(0, 5);
    const existEnd = String(row.end_time).substring(0, 5);
    if (timeRangesOverlap(newStartTime, newEndTime, existStart, existEnd)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.OverlappingSlots);
    }
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (data.specific_date) {
    updates.push("specific_date = ?");
    values.push(data.specific_date);
  }
  if (data.start_time) {
    updates.push("start_time = ?");
    values.push(newStartTime + ":00");
  }
  if (data.end_time) {
    updates.push("end_time = ?");
    values.push(newEndTime + ":00");
  }
  if (data.is_available !== undefined) {
    updates.push("is_available = ?");
    values.push(data.is_available ? 1 : 0);
  }
  if (data.notes !== undefined) {
    updates.push("notes = ?");
    values.push(data.notes || null);
  }
  if (data.service_range) {
    if (data.service_range.max_distance <= 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidDistance);
    }
    let miles = data.service_range.max_distance;
    if (data.service_range.unit === "km") {
      miles = data.service_range.max_distance / 1.60934;
    }
    updates.push("max_distance_miles = ?");
    values.push(miles.toFixed(2));
    updates.push("unit = ?");
    values.push(data.service_range.unit);
  }

  if (updates.length === 0) {
    return;
  }

  values.push(slotId, plebId);
  await pool.query<ResultSetHeader>(
    `UPDATE pleb_availability SET ${updates.join(", ")} WHERE id = ? AND pleb_id = ? AND specific_date IS NOT NULL`,
    values
  );
}

/**
 * Delete a single date-specific availability slot (hard delete)
 */
async function deleteDateSlot(plebId: number, slotId: number): Promise<void> {
  await validatePleb(plebId);

  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM pleb_availability WHERE id = ? AND pleb_id = ? AND specific_date IS NOT NULL",
    [slotId, plebId]
  );

  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Date slot not found");
  }
}

// **** Per Day (day-of-week) Availability CRUD **** //

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Get all day-of-week (Per Day) availability slots for a pleb
 */
async function getDayAvailability(
  plebId: number
): Promise<IPlebAvailabilitySlot[]> {
  await validatePleb(plebId);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, pleb_id, day_of_week, start_time, end_time, is_available,
            max_distance_miles, max_distance_km, unit, created_at, updated_at
     FROM pleb_availability
     WHERE pleb_id = ? AND specific_date IS NULL
     ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'),
              start_time ASC`,
    [plebId]
  );

  return rows.map((row) => ({
    id: row.id,
    pleb_id: row.pleb_id,
    day_of_week: row.day_of_week,
    start_time: String(row.start_time).substring(0, 5),
    end_time: String(row.end_time).substring(0, 5),
    is_available: Number(row.is_available),
    max_distance_miles: Number(row.max_distance_miles),
    max_distance_km: Number(row.max_distance_km),
    unit: row.unit || "miles",
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Add a single day-of-week availability slot
 */
async function addDaySlot(
  plebId: number,
  data: IPlebDaySlotCreateRequest
): Promise<{ id: number }> {
  await validatePleb(plebId);

  const { day_of_week, start_time, end_time, is_available, service_range } = data;

  if (!day_of_week || !VALID_DAYS.includes(day_of_week)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidDayOfWeek);
  }

  if (!start_time || !end_time) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "start_time and end_time are required");
  }

  if (!isValidTimeFormat(start_time) || !isValidTimeFormat(end_time)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidTimeFormat);
  }

  const normStart = normalizeTime(start_time);
  const normEnd = normalizeTime(end_time);

  if (timeToMinutes(normStart) >= timeToMinutes(normEnd)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidTimeRange);
  }

  if (!service_range || !service_range.max_distance || service_range.max_distance <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidDistance);
  }

  if (service_range.unit !== "miles" && service_range.unit !== "km") {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidUnit);
  }

  let maxDistanceMiles = service_range.max_distance;
  if (service_range.unit === "km") {
    maxDistanceMiles = service_range.max_distance / 1.60934;
  }

  // Check overlap with existing day slots on same day_of_week
  const [existing] = await pool.query<RowDataPacket[]>(
    `SELECT start_time, end_time FROM pleb_availability
     WHERE pleb_id = ? AND specific_date IS NULL AND day_of_week = ? AND is_available = 1`,
    [plebId, day_of_week]
  );

  for (const row of existing) {
    const existStart = String(row.start_time).substring(0, 5);
    const existEnd = String(row.end_time).substring(0, 5);
    if (timeRangesOverlap(normStart, normEnd, existStart, existEnd)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.OverlappingSlots);
    }
  }

  const isAvail = is_available !== false ? 1 : 0;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO pleb_availability
     (pleb_id, day_of_week, start_time, end_time, is_available, max_distance_miles, unit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [plebId, day_of_week, normStart + ":00", normEnd + ":00", isAvail, maxDistanceMiles.toFixed(2), service_range.unit]
  );

  return { id: result.insertId };
}

/**
 * Update a single day-of-week availability slot
 */
async function updateDaySlot(
  plebId: number,
  slotId: number,
  data: IPlebDaySlotUpdateRequest
): Promise<void> {
  await validatePleb(plebId);

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, day_of_week, start_time, end_time FROM pleb_availability WHERE id = ? AND pleb_id = ? AND specific_date IS NULL",
    [slotId, plebId]
  );

  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.DaySlotNotFound);
  }

  const existing = rows[0];
  const newDayOfWeek = data.day_of_week || existing.day_of_week;
  const newStartTime = data.start_time ? normalizeTime(data.start_time) : String(existing.start_time).substring(0, 5);
  const newEndTime = data.end_time ? normalizeTime(data.end_time) : String(existing.end_time).substring(0, 5);

  if (data.day_of_week && !VALID_DAYS.includes(data.day_of_week)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidDayOfWeek);
  }

  if (data.start_time && !isValidTimeFormat(data.start_time)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidTimeFormat);
  }
  if (data.end_time && !isValidTimeFormat(data.end_time)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidTimeFormat);
  }

  if (timeToMinutes(newStartTime) >= timeToMinutes(newEndTime)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidTimeRange);
  }

  // Check overlap with other day slots on the same day_of_week (exclude current)
  const [otherSlots] = await pool.query<RowDataPacket[]>(
    `SELECT start_time, end_time FROM pleb_availability
     WHERE pleb_id = ? AND specific_date IS NULL AND day_of_week = ? AND id != ? AND is_available = 1`,
    [plebId, newDayOfWeek, slotId]
  );

  for (const row of otherSlots) {
    const existStart = String(row.start_time).substring(0, 5);
    const existEnd = String(row.end_time).substring(0, 5);
    if (timeRangesOverlap(newStartTime, newEndTime, existStart, existEnd)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.OverlappingSlots);
    }
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (data.day_of_week) {
    updates.push("day_of_week = ?");
    values.push(data.day_of_week);
  }
  if (data.start_time) {
    updates.push("start_time = ?");
    values.push(newStartTime + ":00");
  }
  if (data.end_time) {
    updates.push("end_time = ?");
    values.push(newEndTime + ":00");
  }
  if (data.is_available !== undefined) {
    updates.push("is_available = ?");
    values.push(data.is_available ? 1 : 0);
  }
  if (data.service_range) {
    if (data.service_range.max_distance <= 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, Errors.InvalidDistance);
    }
    let miles = data.service_range.max_distance;
    if (data.service_range.unit === "km") {
      miles = data.service_range.max_distance / 1.60934;
    }
    updates.push("max_distance_miles = ?");
    values.push(miles.toFixed(2));
    updates.push("unit = ?");
    values.push(data.service_range.unit);
  }

  if (updates.length === 0) {
    return;
  }

  values.push(slotId, plebId);
  await pool.query<ResultSetHeader>(
    `UPDATE pleb_availability SET ${updates.join(", ")} WHERE id = ? AND pleb_id = ? AND specific_date IS NULL`,
    values
  );
}

/**
 * Delete a single day-of-week availability slot (hard delete)
 */
async function deleteDaySlot(plebId: number, slotId: number): Promise<void> {
  await validatePleb(plebId);

  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM pleb_availability WHERE id = ? AND pleb_id = ? AND specific_date IS NULL",
    [slotId, plebId]
  );

  if (result.affectedRows === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.DaySlotNotFound);
  }
}

// **** Calendar View **** //

/**
 * Get merged calendar view for a month (date-specific overrides weekly recurring)
 */
async function getCalendarView(
  plebId: number,
  month: number,
  year: number
): Promise<IPlebCalendarResponse> {
  await validatePleb(plebId);

  const startOfMonth = moment({ year, month: month - 1, day: 1 });
  const endOfMonth = startOfMonth.clone().endOf("month");
  const daysInMonth = endOfMonth.date();

  // Fetch weekly recurring slots (where specific_date IS NULL)
  const [weeklyRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, day_of_week, start_time, end_time, is_available, max_distance_miles, max_distance_km, unit
     FROM pleb_availability WHERE pleb_id = ? AND specific_date IS NULL
     ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), start_time ASC`,
    [plebId]
  );

  // Group weekly slots by day name
  const weeklyByDay = new Map<string, Array<{ id: number; start_time: string; end_time: string; is_available: boolean }>>();
  let serviceRange = { max_distance_miles: 0, max_distance_km: 0, unit: "miles" as "miles" | "km" };

  for (const row of weeklyRows) {
    const day = row.day_of_week as string;
    if (!weeklyByDay.has(day)) {
      weeklyByDay.set(day, []);
    }
    weeklyByDay.get(day)!.push({
      id: row.id,
      start_time: String(row.start_time).substring(0, 5),
      end_time: String(row.end_time).substring(0, 5),
      is_available: Number(row.is_available) === 1,
    });
    if (serviceRange.max_distance_miles === 0) {
      serviceRange = {
        max_distance_miles: Number(row.max_distance_miles),
        max_distance_km: Number(row.max_distance_km),
        unit: row.unit || "miles",
      };
    }
  }

  // Fetch date-specific slots for this month (where specific_date IS NOT NULL)
  const [dateRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, specific_date, start_time, end_time, is_available, max_distance_miles, max_distance_km, unit, notes
     FROM pleb_availability
     WHERE pleb_id = ? AND specific_date IS NOT NULL AND specific_date >= ? AND specific_date <= ?
     ORDER BY specific_date ASC, start_time ASC`,
    [plebId, startOfMonth.format("YYYY-MM-DD"), endOfMonth.format("YYYY-MM-DD")]
  );

  // Group date-specific slots by date
  const dateByDay = new Map<string, Array<{ id: number; start_time: string; end_time: string; is_available: boolean; notes: string | null }>>();
  for (const row of dateRows) {
    const dateKey = moment(row.specific_date).format("YYYY-MM-DD");
    if (!dateByDay.has(dateKey)) {
      dateByDay.set(dateKey, []);
    }
    dateByDay.get(dateKey)!.push({
      id: row.id,
      start_time: String(row.start_time).substring(0, 5),
      end_time: String(row.end_time).substring(0, 5),
      is_available: Number(row.is_available) === 1,
      notes: row.notes || null,
    });
    if (serviceRange.max_distance_miles === 0) {
      serviceRange = {
        max_distance_miles: Number(row.max_distance_miles),
        max_distance_km: Number(row.max_distance_km),
        unit: row.unit || "miles",
      };
    }
  }

  // Build calendar days
  const days: IPlebCalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const currentDate = startOfMonth.clone().date(d);
    const dateStr = currentDate.format("YYYY-MM-DD");
    const dayOfWeek = currentDate.format("dddd");

    if (dateByDay.has(dateStr)) {
      days.push({
        date: dateStr,
        day_of_week: dayOfWeek,
        source: "date_specific",
        slots: dateByDay.get(dateStr)!,
      });
    } else if (weeklyByDay.has(dayOfWeek) && weeklyByDay.get(dayOfWeek)!.length > 0) {
      days.push({
        date: dateStr,
        day_of_week: dayOfWeek,
        source: "weekly_recurring",
        slots: weeklyByDay.get(dayOfWeek)!.map((s) => ({ ...s, notes: null })),
      });
    } else {
      days.push({
        date: dateStr,
        day_of_week: dayOfWeek,
        source: "none",
        slots: [],
      });
    }
  }

  return {
    pleb_id: plebId,
    month,
    year,
    service_range: serviceRange,
    days,
  };
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
 * Find active plebs who are available for a specific booking slot and within their travel range.
 * Checks date-specific availability first; falls back to weekly recurring if no date entries exist.
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
  const dateStr = bookingDate.format("YYYY-MM-DD");

  // Step 1: Check date-specific availability for the exact date
  const [dateRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      pleb.id AS pleb_id,
      pleb.full_name,
      pleb.email,
      pleb.phone,
      pleb.lat,
      pleb.lng,
      ? AS day_of_week,
      avail.start_time,
      avail.end_time,
      avail.max_distance_miles
    FROM phlebotomy_applications pleb
    INNER JOIN pleb_availability avail ON pleb.id = avail.pleb_id
    WHERE pleb.is_active = 1
      AND avail.is_available = 1
      AND avail.specific_date = ?
      AND avail.start_time <= ?
      AND avail.end_time > ?`,
    [dayOfWeek, dateStr, sqlTime, sqlTime]
  );

  // Track which plebs have date-specific entries (even if not matching time)
  const [plebsWithDateEntries] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT pleb_id FROM pleb_availability WHERE specific_date = ?`,
    [dateStr]
  );
  const plebsWithDateOverrides = new Set(plebsWithDateEntries.map((r) => Number(r.pleb_id)));

  // Step 2: Check weekly recurring for plebs that DON'T have date-specific entries
  const [weeklyRows] = await pool.query<RowDataPacket[]>(
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
      AND avail.specific_date IS NULL
      AND avail.day_of_week = ?
      AND avail.start_time <= ?
      AND avail.end_time > ?`,
    [dayOfWeek, sqlTime, sqlTime]
  );

  // Merge: date-specific rows + weekly rows (only for plebs without date overrides)
  const allRows = [
    ...dateRows,
    ...weeklyRows.filter((row) => !plebsWithDateOverrides.has(Number(row.pleb_id))),
  ];

  const uniqueRows = new Map<number, IPlebAvailabilityRow>();
  allRows.forEach((row) => {
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
  getDateAvailability,
  addDateSlots,
  updateDateSlot,
  deleteDateSlot,
  getDayAvailability,
  addDaySlot,
  updateDaySlot,
  deleteDaySlot,
  getCalendarView,
  getAvailablePlebsForBooking,
  Errors,
} as const;
