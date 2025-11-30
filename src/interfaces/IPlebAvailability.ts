/**
 * Availability configuration for a single day
 */
export interface IPlebAvailabilityDay {
  start?: string;      // Time in "HH:mm" format (e.g., "09:00")
  end?: string;        // Time in "HH:mm" format (e.g., "17:00")
  available: boolean;  // Whether the pleb is available on this day
}

/**
 * Weekly availability schedule structure
 */
export interface IPlebAvailabilitySchedule {
  Monday: IPlebAvailabilityDay;
  Tuesday: IPlebAvailabilityDay;
  Wednesday: IPlebAvailabilityDay;
  Thursday: IPlebAvailabilityDay;
  Friday: IPlebAvailabilityDay;
  Saturday: IPlebAvailabilityDay;
  Sunday: IPlebAvailabilityDay;
}

/**
 * Service range configuration
 */
export interface IPlebServiceRange {
  max_distance: number;  // Maximum distance value
  unit: 'miles' | 'km';  // Distance unit
}

/**
 * Request body for updating availability and range
 */
export interface IPlebAvailabilityUpdateRequest {
  availability: IPlebAvailabilitySchedule;
  service_range: IPlebServiceRange;
}

/**
 * Response data structure for availability and range
 */
export interface IPlebAvailabilityResponse {
  pleb_id: number;
  availability: IPlebAvailabilitySchedule | null;
  service_range: {
    max_distance_miles: number | null;
    max_distance_km: number | null;
    unit: 'miles' | 'km' | null;
  };
}


