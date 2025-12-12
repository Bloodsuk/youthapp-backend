import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { pool } from "@src/server";
import { RowDataPacket } from "mysql2";

// **** Types **** //

export type Zone = "standard" | "london" | "out_of_area";

export interface Slot {
  shift_type: string;
  slot_times: string;
  price: string;
  weekend_surcharge: string;
}

export interface ZoneResult {
  zone: Zone;
  slots?: Slot[];
  error?: {
    message: string;
    showContactButton: boolean;
  };
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
 * Validate UK postcode format (basic validation)
 */
function isValidUKPostcode(postcode: string): boolean {
  if (!postcode || postcode.trim() === "") return false;
  
  // Basic UK postcode pattern: 1-2 letters, 1-2 numbers, optional space, number, 2 letters
  const ukPostcodePattern = /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?[0-9][A-Z]{2}$/i;
  const normalized = normalizePostcode(postcode);
  return ukPostcodePattern.test(normalized);
}

/**
 * Validate town name (basic validation - not empty, reasonable length)
 */
function isValidTown(town: string): boolean {
  if (!town || town.trim() === "") return false;
  // Town should be at least 2 characters and not too long
  const trimmed = town.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}

/**
 * Check if postcode exists in database
 */
async function postcodeExistsInDatabase(postcode: string): Promise<boolean> {
  try {
    const normalized = normalizePostcode(postcode);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM customers WHERE UPPER(REPLACE(postal_code, ' ', '')) = ? LIMIT 1",
      [normalized]
    );
    return rows.length > 0 && rows[0].count > 0;
  } catch (error) {
    console.error("Error checking postcode in database:", error);
    return false;
  }
}

/**
 * Check if town exists in database
 */
async function townExistsInDatabase(town: string): Promise<boolean> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM customers WHERE UPPER(TRIM(town)) = UPPER(TRIM(?)) LIMIT 1",
      [town]
    );
    return rows.length > 0 && rows[0].count > 0;
  } catch (error) {
    console.error("Error checking town in database:", error);
    return false;
  }
}

/**
 * Determine zone based on postcode
 * London Zone: Postcodes starting with EC, WC, E, N, NW, SE, SW, W
 * Standard Zone: Other valid UK postcodes
 * Out of Area: Invalid or non-UK postcodes
 */
export function getZoneByPostcode(postcode: string): Zone {
  if (!postcode || postcode.trim() === "") {
    return "out_of_area";
  }

  const normalized = normalizePostcode(postcode);

  // Check if postcode starts with any London prefix
  for (const prefix of LONDON_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return "london";
    }
  }

  // Check if it's a valid UK postcode format
  if (isValidUKPostcode(postcode)) {
    return "standard";
  }

  // Invalid or non-UK postcode
  return "out_of_area";
}

/**
 * Determine zone based on town name
 * London towns: Common London area names
 * Standard: Other UK towns
 * Out of Area: Non-UK or invalid towns
 */
export function getZoneByTown(town: string): Zone {
  if (!town || !isValidTown(town)) {
    return "out_of_area";
  }

  const normalizedTown = town.trim().toUpperCase();
  
  // Common London area/town names
  const londonTowns = [
    "LONDON", "WESTMINSTER", "CAMDEN", "ISLINGTON", "HACKNEY", 
    "TOWER HAMLETS", "GREENWICH", "LEWISHAM", "SOUTHWARK",
    "LAMBETH", "WANDSWORTH", "HAMMERSMITH", "KENSINGTON",
    "CHELSEA", "FULHAM", "EALING", "HOUNSLOW", "RICHMOND",
    "KINGSTON", "MERTON", "SUTTON", "CROYDON", "BROMLEY",
    "BEXLEY", "HAVERING", "BARKING", "REDBRIDGE", "NEWHAM",
    "WALTHAM FOREST", "HARINGEY", "ENFIELD", "BARNET",
    "HARROW", "BRENT", "HOUNSLOW", "HILLINGDON"
  ];

  // Check if town matches any London area
  for (const londonTown of londonTowns) {
    if (normalizedTown.includes(londonTown) || londonTown.includes(normalizedTown)) {
      return "london";
    }
  }

  // If it's a valid town format, assume standard zone
  // (This is a default - you may want to add more validation)
  return "standard";
}

/**
 * Get slots for a specific zone
 */
export function getSlotsByZone(zone: Zone): Slot[] {
  if (zone === "london") {
    return [...LONDON_ZONE_SLOTS];
  }
  if (zone === "standard") {
    return [...STANDARD_ZONE_SLOTS];
  }
  // out_of_area - return empty array (should not be called for out_of_area)
  return [];
}

/**
 * Get slots by postcode and/or town
 * Priority: 1. Check postcode in DB, 2. Check town in DB, 3. Validate format, 4. Determine zone
 */
export async function getSlotsByLocation(
  postcode?: string,
  town?: string
): Promise<ZoneResult> {
  // Out of area error message
  const outOfAreaError = {
    message: "We're not able to offer standard pricing at your location. Please send us a what's app message and we'll work out a tailored quote for your area.",
    showContactButton: true
  };

  // Step 1: Try postcode first
  if (postcode && postcode.trim() !== "") {
    // Check if postcode exists in database
    const postcodeInDb = await postcodeExistsInDatabase(postcode);
    
    if (postcodeInDb) {
      // Postcode found in DB - validate format and determine zone
      if (!isValidUKPostcode(postcode)) {
        // Invalid format but exists in DB - treat as out of area for safety
        return {
          zone: "out_of_area",
          error: outOfAreaError
        };
      }
      
      const zone = getZoneByPostcode(postcode);
      
      if (zone === "out_of_area") {
        return {
          zone: "out_of_area",
          error: outOfAreaError
        };
      }
      
      // Valid zone - return slots
      const slots = getSlotsByZone(zone);
      return { zone, slots };
    } else {
      // Postcode not in DB - validate format
      if (!isValidUKPostcode(postcode)) {
        // Invalid postcode format - try town if provided
        if (town && town.trim() !== "") {
          return await checkTownForSlots(town, outOfAreaError);
        }
        // No town provided or invalid - return error
        return {
          zone: "out_of_area",
          error: outOfAreaError
        };
      }
      
      // Valid format but not in DB - determine zone by format
      const zone = getZoneByPostcode(postcode);
      
      if (zone === "out_of_area") {
        // Try town if provided
        if (town && town.trim() !== "") {
          return await checkTownForSlots(town, outOfAreaError);
        }
        return {
          zone: "out_of_area",
          error: outOfAreaError
        };
      }
      
      // Valid zone determined by format
      const slots = getSlotsByZone(zone);
      return { zone, slots };
    }
  }

  // Step 2: No postcode provided, try town
  if (town && town.trim() !== "") {
    return await checkTownForSlots(town, outOfAreaError);
  }

  // Step 3: Neither postcode nor town provided
  return {
    zone: "out_of_area",
    error: outOfAreaError
  };
}

/**
 * Helper function to check town and return slots or error
 */
async function checkTownForSlots(town: string, outOfAreaError: { message: string; showContactButton: boolean }): Promise<ZoneResult> {
  // Check if town exists in database
  const townInDb = await townExistsInDatabase(town);
  
  if (townInDb) {
    // Town found in DB - determine zone
    const zone = getZoneByTown(town);
    
    if (zone === "out_of_area") {
      return {
        zone: "out_of_area",
        error: outOfAreaError
      };
    }
    
    // Valid zone - return slots
    const slots = getSlotsByZone(zone);
    return { zone, slots };
  } else {
    // Town not in DB - validate format and determine zone
    if (!isValidTown(town)) {
      return {
        zone: "out_of_area",
        error: outOfAreaError
      };
    }
    
    const zone = getZoneByTown(town);
    
    if (zone === "out_of_area") {
      return {
        zone: "out_of_area",
        error: outOfAreaError
      };
    }
    
    // Valid zone determined by town name
    const slots = getSlotsByZone(zone);
    return { zone, slots };
  }
}

/**
 * Get slots by postcode (legacy function for backward compatibility)
 */
export async function getSlotsByPostcode(postcode: string): Promise<ZoneResult> {
  return await getSlotsByLocation(postcode);
}

// **** Export default **** //

export default {
  getZoneByPostcode,
  getZoneByTown,
  getSlotsByZone,
  getSlotsByPostcode,
  getSlotsByLocation,
  isValidUKPostcode,
  isValidTown,
} as const;

