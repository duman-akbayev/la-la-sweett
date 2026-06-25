// =============================================================================
// La La Sweett Sales System — Delivery Zone Service Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isInDeliveryZone,
  isCoordinatesInZone,
  isZipCodeInZone,
  extractZipCode,
  calculateDistance,
  AUSTIN_METRO_ZIP_CODES,
  validateDeliveryForOrder,
} from './delivery-zone.service';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: unknown };

function createMockQueryBuilder(result: MockResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockResolvedValue(result);
  return builder;
}

let mockFromImpl: (table: string) => unknown = () =>
  createMockQueryBuilder({ data: null, error: null });

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => mockFromImpl(table),
  }),
}));

// ---------------------------------------------------------------------------
// Tests: calculateDistance (Haversine)
// ---------------------------------------------------------------------------

describe('calculateDistance', () => {
  it('returns 0 for the same point', () => {
    const distance = calculateDistance(30.2672, -97.7431, 30.2672, -97.7431);
    expect(distance).toBeCloseTo(0, 5);
  });

  it('calculates correct distance between Austin and Dallas (~195 miles)', () => {
    // Dallas approx coordinates: 32.7767, -96.7970
    const distance = calculateDistance(30.2672, -97.7431, 32.7767, -96.797);
    expect(distance).toBeGreaterThan(180);
    expect(distance).toBeLessThan(210);
  });

  it('calculates correct distance for a point ~10 miles from Austin center', () => {
    // Round Rock is approx 15 miles north of downtown Austin
    // Round Rock: 30.5083, -97.6789
    const distance = calculateDistance(30.2672, -97.7431, 30.5083, -97.6789);
    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(20);
  });
});

// ---------------------------------------------------------------------------
// Tests: isCoordinatesInZone
// ---------------------------------------------------------------------------

describe('isCoordinatesInZone', () => {
  it('returns true for downtown Austin (center point)', () => {
    expect(isCoordinatesInZone(30.2672, -97.7431)).toBe(true);
  });

  it('returns true for Round Rock (within 25 miles)', () => {
    expect(isCoordinatesInZone(30.5083, -97.6789)).toBe(true);
  });

  it('returns true for South Austin area', () => {
    // Buda area: approx 30.0849, -97.8400
    expect(isCoordinatesInZone(30.0849, -97.84)).toBe(true);
  });

  it('returns false for Dallas (far outside zone)', () => {
    expect(isCoordinatesInZone(32.7767, -96.797)).toBe(false);
  });

  it('returns false for Houston (far outside zone)', () => {
    expect(isCoordinatesInZone(29.7604, -95.3698)).toBe(false);
  });

  it('returns false for San Antonio (~80 miles from Austin)', () => {
    expect(isCoordinatesInZone(29.4241, -98.4936)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: extractZipCode
// ---------------------------------------------------------------------------

describe('extractZipCode', () => {
  it('extracts 5-digit zip from standard address', () => {
    expect(extractZipCode('123 Main St, Austin, TX 78701')).toBe('78701');
  });

  it('extracts zip from address with zip+4 format', () => {
    expect(extractZipCode('456 Elm Ave, Austin, TX 78704-1234')).toBe('78704');
  });

  it('extracts first zip code when multiple present', () => {
    expect(extractZipCode('Apt 78, 100 Oak Dr, Austin TX 78745')).toBe('78745');
  });

  it('returns null when no zip code present', () => {
    expect(extractZipCode('123 Main Street, Austin, Texas')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractZipCode('')).toBeNull();
  });

  it('handles zip codes at end of string', () => {
    expect(extractZipCode('Austin TX 78753')).toBe('78753');
  });
});

// ---------------------------------------------------------------------------
// Tests: isZipCodeInZone
// ---------------------------------------------------------------------------

describe('isZipCodeInZone', () => {
  it('returns true for central Austin zip codes', () => {
    expect(isZipCodeInZone('78701')).toBe(true);
    expect(isZipCodeInZone('78702')).toBe(true);
    expect(isZipCodeInZone('78704')).toBe(true);
  });

  it('returns true for Round Rock zip', () => {
    expect(isZipCodeInZone('78664')).toBe(true);
  });

  it('returns true for Cedar Park zip', () => {
    expect(isZipCodeInZone('78613')).toBe(true);
  });

  it('returns false for Dallas zip codes', () => {
    expect(isZipCodeInZone('75201')).toBe(false);
    expect(isZipCodeInZone('75202')).toBe(false);
  });

  it('returns false for Houston zip codes', () => {
    expect(isZipCodeInZone('77001')).toBe(false);
    expect(isZipCodeInZone('77002')).toBe(false);
  });

  it('returns false for San Antonio zip codes', () => {
    expect(isZipCodeInZone('78201')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: isInDeliveryZone (main validation function)
// ---------------------------------------------------------------------------

describe('isInDeliveryZone', () => {
  it('returns valid for address with Austin metro zip code', () => {
    const result = isInDeliveryZone('123 Congress Ave, Austin, TX 78701');
    expect(result.isValid).toBe(true);
    expect(result.zipCode).toBe('78701');
  });

  it('returns valid for Round Rock address', () => {
    const result = isInDeliveryZone('500 University Blvd, Round Rock, TX 78665');
    expect(result.isValid).toBe(true);
    expect(result.zipCode).toBe('78665');
  });

  it('returns invalid for address with out-of-zone zip code', () => {
    const result = isInDeliveryZone('100 Main St, Dallas, TX 75201');
    expect(result.isValid).toBe(false);
    expect(result.zipCode).toBe('75201');
    expect(result.suggestion).toBeDefined();
    expect(result.suggestion).toContain('pickup');
  });

  it('returns valid for address containing "Austin" without zip', () => {
    const result = isInDeliveryZone('123 Main Street, Austin, Texas');
    expect(result.isValid).toBe(true);
  });

  it('returns valid for address containing "Cedar Park"', () => {
    const result = isInDeliveryZone('456 Elm Ave, Cedar Park, Texas');
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for empty address', () => {
    const result = isInDeliveryZone('');
    expect(result.isValid).toBe(false);
    expect(result.suggestion).toBeDefined();
  });

  it('returns invalid for whitespace-only address', () => {
    const result = isInDeliveryZone('   ');
    expect(result.isValid).toBe(false);
  });

  it('returns invalid for address with no location indicators', () => {
    const result = isInDeliveryZone('123 Something Street');
    expect(result.isValid).toBe(false);
    expect(result.suggestion).toContain('zip code');
  });

  it('message mentions pickup as alternative when invalid', () => {
    const result = isInDeliveryZone('100 Main St, Houston, TX 77001');
    expect(result.isValid).toBe(false);
    expect(result.suggestion).toContain('pickup');
  });

  it('returns valid for Pflugerville address', () => {
    const result = isInDeliveryZone('789 Pecan St, Pflugerville, TX 78660');
    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateDeliveryForOrder
// ---------------------------------------------------------------------------

describe('validateDeliveryForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromImpl = () => createMockQueryBuilder({ data: null, error: null });
  });

  it('returns valid for pickup orders regardless of address', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return createMockQueryBuilder({
          data: {
            id: 'order-1',
            state: 'Deposit_Received',
            delivery_preference: 'pickup',
            delivery_address: null,
          },
          error: null,
        });
      }
      return createMockQueryBuilder({ data: null, error: null });
    };

    const result = await validateDeliveryForOrder('order-1');
    expect(result.isValid).toBe(true);
    expect(result.message).toContain('pickup');
  });

  it('returns valid for delivery order with Austin address', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return createMockQueryBuilder({
          data: {
            id: 'order-1',
            state: 'Deposit_Received',
            delivery_preference: 'delivery',
            delivery_address: '123 Congress Ave, Austin, TX 78701',
          },
          error: null,
        });
      }
      return createMockQueryBuilder({ data: null, error: null });
    };

    const result = await validateDeliveryForOrder('order-1');
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for delivery order with out-of-zone address', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return createMockQueryBuilder({
          data: {
            id: 'order-1',
            state: 'Deposit_Received',
            delivery_preference: 'delivery',
            delivery_address: '100 Main St, Dallas, TX 75201',
          },
          error: null,
        });
      }
      return createMockQueryBuilder({ data: null, error: null });
    };

    const result = await validateDeliveryForOrder('order-1');
    expect(result.isValid).toBe(false);
    expect(result.suggestion).toContain('pickup');
  });

  it('returns invalid when delivery address is missing', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return createMockQueryBuilder({
          data: {
            id: 'order-1',
            state: 'Deposit_Received',
            delivery_preference: 'delivery',
            delivery_address: null,
          },
          error: null,
        });
      }
      return createMockQueryBuilder({ data: null, error: null });
    };

    const result = await validateDeliveryForOrder('order-1');
    expect(result.isValid).toBe(false);
    expect(result.suggestion).toContain('pickup');
  });

  it('throws when order is not found', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return createMockQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        });
      }
      return createMockQueryBuilder({ data: null, error: null });
    };

    await expect(validateDeliveryForOrder('nonexistent')).rejects.toThrow('Order not found');
  });

  it('throws when order is not in Deposit_Received state', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return createMockQueryBuilder({
          data: {
            id: 'order-1',
            state: 'Inquiry',
            delivery_preference: 'delivery',
            delivery_address: '123 Main St, Austin, TX 78701',
          },
          error: null,
        });
      }
      return createMockQueryBuilder({ data: null, error: null });
    };

    await expect(validateDeliveryForOrder('order-1')).rejects.toThrow(
      'Delivery zone validation only applies to orders in Deposit_Received state'
    );
  });
});
