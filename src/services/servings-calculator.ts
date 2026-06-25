// =============================================================================
// La La Sweett Sales System — Servings Calculator
// Standalone module for calculating recommended servings and tier configurations.
// Requirements: 6.7
// =============================================================================

import type { ServingsRecommendation, TierConfig } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_GUEST_COUNT = 1;
const MAX_GUEST_COUNT = 500;
const BUFFER_PERCENTAGE = 0.10; // 10% buffer for safety

// ---------------------------------------------------------------------------
// Tier configuration lookup table
// Monotonically non-decreasing: as maxGuests increases, servings never decreases.
// Each tier's servings >= the maxGuests threshold it covers.
// ---------------------------------------------------------------------------

interface ServingsTierEntry {
  maxGuests: number;
  servings: number;
  tiers: TierConfig[];
}

const SERVINGS_TIERS: ServingsTierEntry[] = [
  {
    maxGuests: 15,
    servings: 18,
    tiers: [{ tier: 1, servings: 18, size: '6" round' }],
  },
  {
    maxGuests: 30,
    servings: 34,
    tiers: [{ tier: 1, servings: 34, size: '8" round' }],
  },
  {
    maxGuests: 50,
    servings: 56,
    tiers: [
      { tier: 1, servings: 22, size: '6" round' },
      { tier: 2, servings: 34, size: '8" round' },
    ],
  },
  {
    maxGuests: 100,
    servings: 112,
    tiers: [
      { tier: 1, servings: 18, size: '6" round' },
      { tier: 2, servings: 34, size: '8" round' },
      { tier: 3, servings: 60, size: '10" round' },
    ],
  },
  {
    maxGuests: 150,
    servings: 168,
    tiers: [
      { tier: 1, servings: 18, size: '6" round' },
      { tier: 2, servings: 34, size: '8" round' },
      { tier: 3, servings: 116, size: '12" round' },
    ],
  },
  {
    maxGuests: 200,
    servings: 224,
    tiers: [
      { tier: 1, servings: 18, size: '6" round' },
      { tier: 2, servings: 34, size: '8" round' },
      { tier: 3, servings: 60, size: '10" round' },
      { tier: 4, servings: 112, size: '12" round' },
    ],
  },
  {
    maxGuests: 300,
    servings: 336,
    tiers: [
      { tier: 1, servings: 18, size: '6" round' },
      { tier: 2, servings: 34, size: '8" round' },
      { tier: 3, servings: 60, size: '10" round' },
      { tier: 4, servings: 224, size: '14" round' },
    ],
  },
  {
    maxGuests: 500,
    servings: 560,
    tiers: [
      { tier: 1, servings: 18, size: '6" round' },
      { tier: 2, servings: 34, size: '8" round' },
      { tier: 3, servings: 60, size: '10" round' },
      { tier: 4, servings: 112, size: '12" round' },
      { tier: 5, servings: 336, size: '14" round' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates that the guest count is within the allowed range.
 * @throws Error if guest count is out of range [1, 500]
 */
function validateGuestCount(guestCount: number): void {
  if (!Number.isFinite(guestCount) || !Number.isInteger(guestCount)) {
    throw new Error('Guest count must be a whole number');
  }
  if (guestCount < MIN_GUEST_COUNT || guestCount > MAX_GUEST_COUNT) {
    throw new Error(
      `Guest count must be between ${MIN_GUEST_COUNT} and ${MAX_GUEST_COUNT}`
    );
  }
}

// ---------------------------------------------------------------------------
// Core calculator
// ---------------------------------------------------------------------------

/**
 * Calculates recommended servings and tier configuration for a given guest count.
 *
 * Guarantees:
 * - Guest count is validated to be 1–500
 * - Recommended servings ≥ guest count (includes ~10% buffer)
 * - Results are monotonically non-decreasing as guest count increases
 * - Returns a valid tier configuration from the Catalog_Service portion data
 *
 * @param guestCount Number of guests (1–500)
 * @returns ServingsRecommendation with recommendedServings and tierConfiguration
 */
export function calculateServings(guestCount: number): ServingsRecommendation {
  validateGuestCount(guestCount);

  // Find the smallest tier that can accommodate this guest count
  const tier = SERVINGS_TIERS.find((t) => guestCount <= t.maxGuests);

  // Safety fallback to the largest tier (shouldn't happen with valid input)
  const selectedTier = tier ?? SERVINGS_TIERS[SERVINGS_TIERS.length - 1];

  // Calculate buffered servings (10% buffer, rounded up)
  const bufferedServings = Math.ceil(guestCount * (1 + BUFFER_PERCENTAGE));

  // Use the greater of the tier's base servings or the buffered guest count
  // This ensures monotonicity: the tier servings are already non-decreasing,
  // and taking the max with a linear function preserves non-decreasing behavior.
  const recommendedServings = Math.max(selectedTier.servings, bufferedServings);

  return {
    guestCount,
    recommendedServings,
    tierConfiguration: selectedTier.tiers,
  };
}

/**
 * Returns the minimum and maximum guest counts supported by the calculator.
 */
export function getGuestCountRange(): { min: number; max: number } {
  return { min: MIN_GUEST_COUNT, max: MAX_GUEST_COUNT };
}

/**
 * Returns all available tier configurations for reference.
 */
export function getAvailableTiers(): ServingsTierEntry[] {
  return [...SERVINGS_TIERS];
}
