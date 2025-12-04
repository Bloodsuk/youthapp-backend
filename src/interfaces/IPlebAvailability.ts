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
