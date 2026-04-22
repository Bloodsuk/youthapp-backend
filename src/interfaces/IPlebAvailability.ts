/**
 * Availability time slot entry
 */
export interface IPlebAvailabilitySlot {
  id?: number;
  pleb_id: number;
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  start_time: string;  // Format: "HH:mm:ss" or "HH:mm" (e.g., "09:00:00" or "09:00")
  end_time: string;    // Format: "HH:mm:ss" or "HH:mm" (e.g., "17:00:00" or "17:00")
  is_available: number; // 0 or 1
  max_distance_miles: number;
  max_distance_km: number;
  unit: 'miles' | 'km';
  created_at?: string;
  updated_at?: string;
}

/**
 * Day schedule with multiple time slots
 */
export interface IPlebDaySchedule {
  day_of_week: string;
  time_slots: Array<{
    id?: number;
    start_time: string;
    end_time: string;
    is_available: boolean;
  }>;
}

/**
 * Weekly availability schedule with all days
 */
export interface IPlebWeeklyAvailability {
  Monday: IPlebDaySchedule['time_slots'];
  Tuesday: IPlebDaySchedule['time_slots'];
  Wednesday: IPlebDaySchedule['time_slots'];
  Thursday: IPlebDaySchedule['time_slots'];
  Friday: IPlebDaySchedule['time_slots'];
  Saturday: IPlebDaySchedule['time_slots'];
  Sunday: IPlebDaySchedule['time_slots'];
}

/**
 * Request body for updating availability
 */
export interface IPlebAvailabilityUpdateRequest {
  availability: IPlebWeeklyAvailability;
  service_range: {
    max_distance: number;
    unit: 'miles' | 'km';
  };
}

/**
 * Request body for creating a single time slot
 */
export interface IPlebTimeSlotCreateRequest {
  day_of_week: string;
  start_time: string;
  end_time: string;
  is_available?: boolean;
}

/**
 * Response structure for getting availability
 */
export interface IPlebAvailabilityResponse {
  pleb_id: number;
  availability: IPlebWeeklyAvailability;
  service_range: {
    max_distance_miles: number;
    max_distance_km: number;
    unit: 'miles' | 'km';
  };
}

/**
 * Result returned when looking up which plebs can cover a booking slot
 */
export interface IPlebAvailableForBooking {
  pleb_id: number;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  max_distance_miles: number;
  slot: {
    day_of_week: string;
    start_time: string;
    end_time: string;
  };
  distance_miles: number;
  distance_km: number;
  distance_text: string;
}

// **** Date-Specific Availability Interfaces **** //

/**
 * A single date-specific availability slot (DB row)
 */
export interface IPlebDateAvailabilitySlot {
  id?: number;
  pleb_id: number;
  specific_date: string; // YYYY-MM-DD
  start_time: string;    // HH:mm or HH:mm:ss
  end_time: string;      // HH:mm or HH:mm:ss
  is_available: number;  // 0 or 1
  max_distance_miles: number;
  max_distance_km?: number;
  unit: 'miles' | 'km';
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Request body for creating date-specific slot(s)
 */
export interface IPlebDateSlotCreateRequest {
  slots: Array<{
    specific_date: string; // YYYY-MM-DD
    start_time: string;
    end_time: string;
    is_available?: boolean;
    notes?: string;
  }>;
  service_range: {
    max_distance: number;
    unit: 'miles' | 'km';
  };
  pleb_id?: number; // Only required for admin
}

/**
 * Request body for updating a single date-specific slot
 */
export interface IPlebDateSlotUpdateRequest {
  specific_date?: string;
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
  notes?: string;
  service_range?: {
    max_distance: number;
    unit: 'miles' | 'km';
  };
}

// **** Per Day (day-of-week) Availability Interfaces **** //

/**
 * Request body for creating a single day-of-week slot
 */
export interface IPlebDaySlotCreateRequest {
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  start_time: string;  // HH:mm
  end_time: string;    // HH:mm
  is_available?: boolean;
  service_range: {
    max_distance: number;
    unit: 'miles' | 'km';
  };
  pleb_id?: number; // Only required for admin
}

/**
 * Request body for updating a single day-of-week slot
 */
export interface IPlebDaySlotUpdateRequest {
  day_of_week?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
  service_range?: {
    max_distance: number;
    unit: 'miles' | 'km';
  };
}

/**
 * A single day entry in the calendar view
 */
export interface IPlebCalendarDay {
  date: string;       // YYYY-MM-DD
  day_of_week: string;
  source: 'date_specific' | 'weekly_recurring' | 'none';
  slots: Array<{
    id?: number;
    start_time: string;
    end_time: string;
    is_available: boolean;
    notes?: string | null;
  }>;
}

/**
 * Response structure for the calendar view
 */
export interface IPlebCalendarResponse {
  pleb_id: number;
  month: number;
  year: number;
  service_range: {
    max_distance_miles: number;
    max_distance_km: number;
    unit: 'miles' | 'km';
  };
  days: IPlebCalendarDay[];
}
