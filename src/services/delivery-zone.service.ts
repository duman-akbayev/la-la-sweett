// =============================================================================
// La La Sweett Sales System — Delivery Zone Service
// =============================================================================

import { getSupabaseAdmin } from '@/lib/supabase';
import type { Order } from '@/types';

// ---------------------------------------------------------------------------
// Austin metro zone constants
// ---------------------------------------------------------------------------

/** Downtown Austin coordinates (center of delivery zone) */
const AUSTIN_CENTER = {
  latitude: 30.2672,
  longitude: -97.7431,
};

/** Maximum delivery radius in miles */
const MAX_DELIVERY_RADIUS_MILES = 25;

/** Earth radius in miles (for Haversine formula) */
const EARTH_RADIUS_MILES = 3958.8;

/**
 * Austin-area zip codes within the delivery zone.
 * Used as a supplementary validation method when coordinates aren't available.
 */
export const AUSTIN_METRO_ZIP_CODES: string[] = [
  // Central Austin
  '78701', '78702', '78703', '78704', '78705',
  // North Austin / Domain
  '78727', '78728', '78729', '78750', '78753', '78757', '78758', '78759',
  // South Austin
  '78741', '78742', '78744', '78745', '78748', '78749',
  // East Austin
  '78721', '78722', '78723', '78724', '78725',
  // West Austin / Lakeway
  '78730', '78731', '78732', '78733', '78734', '78735', '78736', '78737', '78738', '78739',
  // Round Rock / Cedar Park / Pflugerville
  '78660', '78664', '78665', '78681', '78613', '78717',
  // Georgetown (edge of zone)
  '78626', '78628', '78633',
  // Buda / Kyle
  '78610', '78640',
  // Manor / Elgin (close enough)
  '78653',
  // Bee Cave / Dripping Springs (close enough)
  '78620', '78669',
  // Leander
  '78641', '78646',
];

// ---------------------------------------------------------------------------
// Delivery Zone Validation Result
// ---------------------------------------------------------------------------

export interface DeliveryZoneValidationResult {
  /** Whether the address is within the delivery zone */
  isValid: boolean;
  /** Descriptive message about the validation */
  message: string;
  /** Suggestion for the customer if address is outside zone */
  suggestion?: string;
  /** Detected coordinates (if available) */
  coordinates?: { latitude: number; longitude: number };
  /** Detected zip code (if found) */
  zipCode?: string;
}

// ---------------------------------------------------------------------------
// Core validation functions
// ---------------------------------------------------------------------------

/**
 * Calculates the distance between two geographic points using the Haversine formula.
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Checks if geographic coordinates are within the Austin metro delivery zone.
 * @returns true if coordinates are within 25 miles of downtown Austin
 */
export function isCoordinatesInZone(latitude: number, longitude: number): boolean {
  const distance = calculateDistance(
    AUSTIN_CENTER.latitude,
    AUSTIN_CENTER.longitude,
    latitude,
    longitude
  );
  return distance <= MAX_DELIVERY_RADIUS_MILES;
}

/**
 * Extracts a zip code from an address string.
 * Looks for 5-digit US zip code patterns.
 */
export function extractZipCode(address: string): string | null {
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return zipMatch ? zipMatch[1] : null;
}

/**
 * Checks if a zip code is within the Austin metro delivery zone.
 */
export function isZipCodeInZone(zipCode: string): boolean {
  return AUSTIN_METRO_ZIP_CODES.includes(zipCode);
}

/**
 * Validates whether a delivery address is within the Austin metro delivery zone.
 * Uses zip code extraction as the primary method.
 *
 * @param address - The delivery address string to validate
 * @returns Validation result with zone status and customer messaging
 */
export function isInDeliveryZone(address: string): DeliveryZoneValidationResult {
  if (!address || address.trim().length === 0) {
    return {
      isValid: false,
      message: 'No delivery address provided.',
      suggestion: 'Please provide a delivery address or select pickup instead.',
    };
  }

  const trimmedAddress = address.trim();

  // Try zip code-based validation
  const zipCode = extractZipCode(trimmedAddress);

  if (zipCode) {
    const inZone = isZipCodeInZone(zipCode);
    if (inZone) {
      return {
        isValid: true,
        message: `Address is within the Austin metro delivery zone (zip: ${zipCode}).`,
        zipCode,
      };
    } else {
      return {
        isValid: false,
        message: `The delivery address (zip: ${zipCode}) is outside our Austin metro delivery zone.`,
        suggestion:
          'Your address is outside our delivery area. You can select free pickup at our Austin location instead.',
        zipCode,
      };
    }
  }

  // Check for Austin-related keywords as a basic heuristic
  const lowerAddress = trimmedAddress.toLowerCase();
  const austinKeywords = ['austin', 'round rock', 'cedar park', 'pflugerville', 'leander', 'buda', 'kyle', 'lakeway', 'bee cave', 'georgetown', 'manor'];
  const hasAustinKeyword = austinKeywords.some((keyword) => lowerAddress.includes(keyword));

  if (hasAustinKeyword) {
    return {
      isValid: true,
      message: 'Address appears to be within the Austin metro delivery zone.',
    };
  }

  // If we can't determine location, reject and suggest pickup
  return {
    isValid: false,
    message:
      'Unable to verify that the delivery address is within our Austin metro delivery zone. Please include a zip code in your address.',
    suggestion:
      'We could not verify your address is in our delivery area. Please include a 5-digit zip code, or select free pickup at our Austin location.',
  };
}

// ---------------------------------------------------------------------------
// Order-level validation
// ---------------------------------------------------------------------------

/**
 * Validates the delivery address for an order before transitioning to Confirmed state.
 * If delivery preference is "pickup", validation always passes.
 * If delivery preference is "delivery", the address must be within the Austin metro zone.
 *
 * @param orderId - The order ID to validate
 * @returns Validation result including pickup alternative suggestion if rejected
 * @throws Error if order is not found or not in Deposit_Received state
 */
export async function validateDeliveryForOrder(
  orderId: string
): Promise<DeliveryZoneValidationResult> {
  const supabase = getSupabaseAdmin();

  const { data: orderRow, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !orderRow) {
    throw new Error(`Order not found: ${error?.message ?? 'No data returned'}`);
  }

  const order = orderRow as {
    id: string;
    state: string;
    delivery_preference: string | null;
    delivery_address: string | null;
  };

  // If order is not in Deposit_Received state, this validation doesn't apply
  if (order.state !== 'Deposit_Received') {
    throw new Error(
      `Delivery zone validation only applies to orders in Deposit_Received state. Current state: ${order.state}`
    );
  }

  // Pickup orders always pass delivery zone validation
  if (order.delivery_preference === 'pickup') {
    return {
      isValid: true,
      message: 'Order is set for pickup — no delivery zone validation required.',
    };
  }

  // Delivery orders must have an address
  if (!order.delivery_address) {
    return {
      isValid: false,
      message: 'Delivery preference is set but no delivery address provided.',
      suggestion:
        'Please provide a delivery address within the Austin metro area, or switch to free pickup at our Austin location.',
    };
  }

  // Validate the delivery address
  return isInDeliveryZone(order.delivery_address);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const deliveryZoneService = {
  isInDeliveryZone,
  validateDeliveryForOrder,
  isCoordinatesInZone,
  isZipCodeInZone,
  extractZipCode,
  calculateDistance,
};
