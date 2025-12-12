import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

// **** Types **** //

export type Zone = "standard" | "london";

export interface Slot {
  shift_type: string;
  slot_times: string;
  price: string;
  weekend_surcharge: string;
}

// **** Constants **** //

const LONDON_PREFIXES = ['EC', 'WC', 'E', 'N', 'NW', 'SE', 'SW', 'W'];

const STANDARD_ZONE_SLOTS: Slot[] = [
  {
    shift_type: "Early Morning",
    slot_times: "7:00 AM - 9:00 AM",
    price: "55",
    weekend_surcharge: "10"
  },
  {
    shift_type: "Daytime",
    slot_times: "9:00 AM - 4:00 PM",
    price: "45",
    weekend_surcharge: "10"
  },
  {
    shift_type: "Evening",
    slot_times: "4:00 PM - 7:30 PM",
    price: "55",
    weekend_surcharge: "10"
  }
];

const LONDON_ZONE_SLOTS: Slot[] = [
  {
    shift_type: "Early Morning",
    slot_times: "7:00 AM - 9:00 AM",
    price: "65",
    weekend_surcharge: "10"
  },
  {
    shift_type: "Daytime",
    slot_times: "9:00 AM - 4:00 PM",
    price: "55",
    weekend_surcharge: "10"
  },
  {
    shift_type: "Evening",
    slot_times: "4:00 PM - 7:30 PM",
    price: "65",
    weekend_surcharge: "10"
  }
];

// **** Functions **** //

/**
 * Normalize postcode by removing spaces and converting to uppercase
 */
function normalizePostcode(postcode: string): string {
  if (!postcode) return "";
  return postcode.replace(/\s/g, '').toUpperCase();
}

/**
 * Determine zone based on postcode
 * London Zone: Postcodes starting with EC, WC, E, N, NW, SE, SW, W
 * Standard Zone: All other UK postcodes
 */
export function getZoneByPostcode(postcode: string): Zone {
  if (!postcode || postcode.trim() === "") {
    // Default to standard if postcode is empty
    return "standard";
  }

  const normalized = normalizePostcode(postcode);

  // Check if postcode starts with any London prefix
  for (const prefix of LONDON_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return "london";
    }
  }

  // Default to standard zone
  return "standard";
}

/**
 * Get slots for a specific zone
 */
export function getSlotsByZone(zone: Zone): Slot[] {
  if (zone === "london") {
    return [...LONDON_ZONE_SLOTS];
  }
  return [...STANDARD_ZONE_SLOTS];
}

/**
 * Get slots by postcode (combines zone detection and slot retrieval)
 */
export function getSlotsByPostcode(postcode: string): { zone: Zone; slots: Slot[] } {
  const zone = getZoneByPostcode(postcode);
  const slots = getSlotsByZone(zone);
  return { zone, slots };
}

// **** Export default **** //

export default {
  getZoneByPostcode,
  getSlotsByZone,
  getSlotsByPostcode,
} as const;

