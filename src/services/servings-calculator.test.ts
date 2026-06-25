// =============================================================================
// La La Sweett Sales System — Servings Calculator Tests
// Validates: Requirements 6.7
// =============================================================================

import { describe, it, expect } from 'vitest';
import { calculateServings, getGuestCountRange } from './servings-calculator';

describe('Servings Calculator', () => {
  describe('Input validation', () => {
    it('should reject guest count of 0', () => {
      expect(() => calculateServings(0)).toThrow(
        'Guest count must be between 1 and 500'
      );
    });

    it('should reject negative guest count', () => {
      expect(() => calculateServings(-1)).toThrow(
        'Guest count must be between 1 and 500'
      );
    });

    it('should reject guest count above 500', () => {
      expect(() => calculateServings(501)).toThrow(
        'Guest count must be between 1 and 500'
      );
    });

    it('should reject non-integer guest count', () => {
      expect(() => calculateServings(10.5)).toThrow(
        'Guest count must be a whole number'
      );
    });

    it('should reject NaN', () => {
      expect(() => calculateServings(NaN)).toThrow(
        'Guest count must be a whole number'
      );
    });

    it('should reject Infinity', () => {
      expect(() => calculateServings(Infinity)).toThrow(
        'Guest count must be a whole number'
      );
    });
  });

  describe('Boundary values', () => {
    it('should handle minimum guest count (1)', () => {
      const result = calculateServings(1);
      expect(result.guestCount).toBe(1);
      expect(result.recommendedServings).toBeGreaterThanOrEqual(1);
      expect(result.tierConfiguration.length).toBeGreaterThan(0);
    });

    it('should handle maximum guest count (500)', () => {
      const result = calculateServings(500);
      expect(result.guestCount).toBe(500);
      expect(result.recommendedServings).toBeGreaterThanOrEqual(500);
      expect(result.tierConfiguration.length).toBeGreaterThan(0);
    });

    it('should handle tier boundary (15 guests)', () => {
      const result = calculateServings(15);
      expect(result.recommendedServings).toBeGreaterThanOrEqual(15);
    });

    it('should handle tier boundary (16 guests - moves to next tier)', () => {
      const result = calculateServings(16);
      expect(result.recommendedServings).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Servings ≥ guest count invariant', () => {
    it('should always return servings >= guest count for small groups', () => {
      for (let guests = 1; guests <= 20; guests++) {
        const result = calculateServings(guests);
        expect(result.recommendedServings).toBeGreaterThanOrEqual(guests);
      }
    });

    it('should always return servings >= guest count for medium groups', () => {
      for (let guests = 21; guests <= 100; guests++) {
        const result = calculateServings(guests);
        expect(result.recommendedServings).toBeGreaterThanOrEqual(guests);
      }
    });

    it('should always return servings >= guest count for large groups', () => {
      for (let guests = 101; guests <= 500; guests++) {
        const result = calculateServings(guests);
        expect(result.recommendedServings).toBeGreaterThanOrEqual(guests);
      }
    });
  });

  describe('Monotonicity property', () => {
    it('should produce non-decreasing results as guest count increases (full range)', () => {
      let previousServings = 0;

      for (let guests = 1; guests <= 500; guests++) {
        const result = calculateServings(guests);
        expect(result.recommendedServings).toBeGreaterThanOrEqual(previousServings);
        previousServings = result.recommendedServings;
      }
    });
  });

  describe('Tier configuration validity', () => {
    it('should return at least one tier for any valid guest count', () => {
      const sampleCounts = [1, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500];
      for (const guests of sampleCounts) {
        const result = calculateServings(guests);
        expect(result.tierConfiguration.length).toBeGreaterThan(0);
      }
    });

    it('should have sequential tier numbers starting from 1', () => {
      const sampleCounts = [1, 30, 50, 100, 200, 500];
      for (const guests of sampleCounts) {
        const result = calculateServings(guests);
        result.tierConfiguration.forEach((tier, index) => {
          expect(tier.tier).toBe(index + 1);
        });
      }
    });

    it('should have positive servings for each tier', () => {
      const sampleCounts = [1, 50, 100, 300, 500];
      for (const guests of sampleCounts) {
        const result = calculateServings(guests);
        result.tierConfiguration.forEach((tier) => {
          expect(tier.servings).toBeGreaterThan(0);
        });
      }
    });

    it('should have non-empty size string for each tier', () => {
      const sampleCounts = [1, 50, 100, 300, 500];
      for (const guests of sampleCounts) {
        const result = calculateServings(guests);
        result.tierConfiguration.forEach((tier) => {
          expect(tier.size.length).toBeGreaterThan(0);
        });
      }
    });

    it('should increase number of tiers as guest count increases', () => {
      const result1 = calculateServings(1);
      const result500 = calculateServings(500);
      expect(result500.tierConfiguration.length).toBeGreaterThanOrEqual(
        result1.tierConfiguration.length
      );
    });
  });

  describe('Buffer behavior', () => {
    it('should recommend more servings than bare minimum guest count', () => {
      // For any non-trivial guest count, servings should exceed guest count
      // due to the 10% buffer
      const result = calculateServings(100);
      expect(result.recommendedServings).toBeGreaterThan(100);
    });

    it('should include approximately 10% buffer', () => {
      // For guest counts that don't cross tier boundaries, the buffer should be ~10%
      const result = calculateServings(100);
      // recommendedServings should be at least guestCount * 1.1
      expect(result.recommendedServings).toBeGreaterThanOrEqual(
        Math.ceil(100 * 1.1)
      );
    });
  });

  describe('getGuestCountRange', () => {
    it('should return min of 1 and max of 500', () => {
      const range = getGuestCountRange();
      expect(range.min).toBe(1);
      expect(range.max).toBe(500);
    });
  });

  describe('Return value structure', () => {
    it('should include guestCount matching the input', () => {
      const result = calculateServings(42);
      expect(result.guestCount).toBe(42);
    });

    it('should include recommendedServings as a number', () => {
      const result = calculateServings(42);
      expect(typeof result.recommendedServings).toBe('number');
      expect(Number.isInteger(result.recommendedServings)).toBe(true);
    });

    it('should include tierConfiguration as an array', () => {
      const result = calculateServings(42);
      expect(Array.isArray(result.tierConfiguration)).toBe(true);
    });
  });
});
