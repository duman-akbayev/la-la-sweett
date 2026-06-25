// =============================================================================
// La La Sweett Sales System — Catalog Service Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CatalogService } from '@/types';

// ---------------------------------------------------------------------------
// Mock Supabase admin client
// ---------------------------------------------------------------------------

function createMockQueryBuilder(result: { data: unknown; error: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {};

  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.or = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.range = vi.fn().mockReturnValue(builder);
  builder.limit = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockResolvedValue(result);

  // Make the builder itself awaitable (for chained calls not ending in .single())
  builder.then = vi.fn((resolve: (val: unknown) => void) =>
    resolve({ data: result.data, error: result.error, count: result.count ?? null })
  );

  return builder;
}

let mockFromImpl: (table: string) => unknown = () =>
  createMockQueryBuilder({ data: [], error: null });

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => mockFromImpl(table),
  }),
}));

import { createCatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFromImpl = () => createMockQueryBuilder({ data: [], error: null });
    service = createCatalogService();
  });

  // -------------------------------------------------------------------------
  // calculateServings — Pure logic, no DB dependency
  // -------------------------------------------------------------------------

  describe('calculateServings', () => {
    it('returns 15 servings for 1 guest (1 tier, 6" round)', async () => {
      const result = await service.calculateServings(1);
      expect(result.guestCount).toBe(1);
      expect(result.recommendedServings).toBe(15);
      expect(result.tierConfiguration).toHaveLength(1);
      expect(result.tierConfiguration[0].size).toBe('6" round');
    });

    it('returns 15 servings for 15 guests', async () => {
      const result = await service.calculateServings(15);
      expect(result.recommendedServings).toBe(15);
      expect(result.tierConfiguration).toHaveLength(1);
    });

    it('returns 30 servings for 16 guests (1 tier, 8" round)', async () => {
      const result = await service.calculateServings(16);
      expect(result.recommendedServings).toBe(30);
      expect(result.tierConfiguration).toHaveLength(1);
      expect(result.tierConfiguration[0].size).toBe('8" round');
    });

    it('returns 30 servings for 30 guests', async () => {
      const result = await service.calculateServings(30);
      expect(result.recommendedServings).toBe(30);
    });

    it('returns 50 servings for 31 guests (2 tiers: 6"+8")', async () => {
      const result = await service.calculateServings(31);
      expect(result.recommendedServings).toBe(50);
      expect(result.tierConfiguration).toHaveLength(2);
      expect(result.tierConfiguration.map((t) => t.size)).toEqual([
        '6" round',
        '8" round',
      ]);
    });

    it('returns 100 servings for 51 guests (3 tiers: 6"+8"+10")', async () => {
      const result = await service.calculateServings(51);
      expect(result.recommendedServings).toBe(100);
      expect(result.tierConfiguration).toHaveLength(3);
      expect(result.tierConfiguration.map((t) => t.size)).toEqual([
        '6" round',
        '8" round',
        '10" round',
      ]);
    });

    it('returns 150 servings for 101 guests (3 tiers: 6"+8"+12")', async () => {
      const result = await service.calculateServings(101);
      expect(result.recommendedServings).toBe(150);
      expect(result.tierConfiguration).toHaveLength(3);
      expect(result.tierConfiguration.map((t) => t.size)).toEqual([
        '6" round',
        '8" round',
        '12" round',
      ]);
    });

    it('returns 200 servings for 151 guests (4 tiers: 6"+8"+10"+12")', async () => {
      const result = await service.calculateServings(151);
      expect(result.recommendedServings).toBe(200);
      expect(result.tierConfiguration).toHaveLength(4);
      expect(result.tierConfiguration.map((t) => t.size)).toEqual([
        '6" round',
        '8" round',
        '10" round',
        '12" round',
      ]);
    });

    it('returns 300 servings for 201 guests (4 tiers: 6"+8"+10"+14")', async () => {
      const result = await service.calculateServings(201);
      expect(result.recommendedServings).toBe(300);
      expect(result.tierConfiguration).toHaveLength(4);
      expect(result.tierConfiguration.map((t) => t.size)).toEqual([
        '6" round',
        '8" round',
        '10" round',
        '14" round',
      ]);
    });

    it('returns 500 servings for 301 guests (5 tiers: 6"+8"+10"+12"+14")', async () => {
      const result = await service.calculateServings(301);
      expect(result.recommendedServings).toBe(500);
      expect(result.tierConfiguration).toHaveLength(5);
      expect(result.tierConfiguration.map((t) => t.size)).toEqual([
        '6" round',
        '8" round',
        '10" round',
        '12" round',
        '14" round',
      ]);
    });

    it('returns 500 servings for 500 guests', async () => {
      const result = await service.calculateServings(500);
      expect(result.recommendedServings).toBe(500);
      expect(result.tierConfiguration).toHaveLength(5);
    });

    it('throws for guest count below 1', async () => {
      await expect(service.calculateServings(0)).rejects.toThrow(
        'Guest count must be between 1 and 500'
      );
    });

    it('throws for guest count above 500', async () => {
      await expect(service.calculateServings(501)).rejects.toThrow(
        'Guest count must be between 1 and 500'
      );
    });

    it('recommended servings >= guest count for all boundary values', async () => {
      const boundaries = [1, 10, 15, 16, 30, 31, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301, 500];
      for (const count of boundaries) {
        const result = await service.calculateServings(count);
        expect(result.recommendedServings).toBeGreaterThanOrEqual(count);
      }
    });

    it('servings are monotonically non-decreasing', async () => {
      let prevServings = 0;
      for (let i = 1; i <= 500; i += 5) {
        const result = await service.calculateServings(i);
        expect(result.recommendedServings).toBeGreaterThanOrEqual(prevServings);
        prevServings = result.recommendedServings;
      }
    });
  });

  // -------------------------------------------------------------------------
  // getCategories
  // -------------------------------------------------------------------------

  describe('getCategories', () => {
    it('returns active categories sorted by sort_order', async () => {
      const mockData = [
        { id: '1', name: 'Birthday Cakes', slug: 'birthday-cakes', description: 'Fun cakes', sort_order: 1, active: true },
        { id: '2', name: 'Wedding Cakes', slug: 'wedding-cakes', description: 'Elegant cakes', sort_order: 2, active: true },
      ];

      mockFromImpl = () => createMockQueryBuilder({ data: mockData, error: null });

      const result = await service.getCategories();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '1',
        name: 'Birthday Cakes',
        slug: 'birthday-cakes',
        description: 'Fun cakes',
        sortOrder: 1,
        active: true,
      });
      expect(result[1].name).toBe('Wedding Cakes');
      expect(result[1].sortOrder).toBe(2);
    });

    it('returns empty array when no categories exist', async () => {
      mockFromImpl = () => createMockQueryBuilder({ data: [], error: null });

      const result = await service.getCategories();
      expect(result).toEqual([]);
    });

    it('throws on database error', async () => {
      mockFromImpl = () =>
        createMockQueryBuilder({ data: null, error: { message: 'Connection failed' } });

      await expect(service.getCategories()).rejects.toThrow(
        'Failed to fetch categories: Connection failed'
      );
    });
  });

  // -------------------------------------------------------------------------
  // getProduct
  // -------------------------------------------------------------------------

  describe('getProduct', () => {
    it('returns a mapped product by ID', async () => {
      const mockProduct = {
        id: 'prod-1',
        category_id: 'cat-1',
        name: 'Chocolate Dream',
        description_short: 'Rich chocolate cake',
        price_min: 50,
        price_max: 150,
        min_servings: 10,
        max_servings: 50,
        lead_time_days: 7,
        image_url: 'https://example.com/cake.jpg',
        allergen_tags: ['nut-free'],
        structured_data: { type: 'layered' },
        active: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockFromImpl = () => createMockQueryBuilder({ data: mockProduct, error: null });

      const result = await service.getProduct('prod-1');

      expect(result.id).toBe('prod-1');
      expect(result.categoryId).toBe('cat-1');
      expect(result.name).toBe('Chocolate Dream');
      expect(result.descriptionShort).toBe('Rich chocolate cake');
      expect(result.priceMin).toBe(50);
      expect(result.priceMax).toBe(150);
      expect(result.minServings).toBe(10);
      expect(result.maxServings).toBe(50);
      expect(result.leadTimeDays).toBe(7);
      expect(result.allergenTags).toEqual(['nut-free']);
      expect(result.structuredData).toEqual({ type: 'layered' });
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('handles null allergen_tags and structured_data gracefully', async () => {
      const mockProduct = {
        id: 'prod-2',
        category_id: 'cat-1',
        name: 'Simple Cake',
        description_short: 'Plain',
        price_min: 30,
        price_max: 60,
        min_servings: 8,
        max_servings: 20,
        lead_time_days: 5,
        image_url: '',
        allergen_tags: null,
        structured_data: null,
        active: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockFromImpl = () => createMockQueryBuilder({ data: mockProduct, error: null });

      const result = await service.getProduct('prod-2');
      expect(result.allergenTags).toEqual([]);
      expect(result.structuredData).toEqual({});
    });

    it('throws when product not found', async () => {
      mockFromImpl = () =>
        createMockQueryBuilder({ data: null, error: { message: 'Row not found' } });

      await expect(service.getProduct('nonexistent')).rejects.toThrow('Product not found');
    });
  });

  // -------------------------------------------------------------------------
  // getProductsByCategory
  // -------------------------------------------------------------------------

  describe('getProductsByCategory', () => {
    it('returns empty result for non-existent category slug', async () => {
      mockFromImpl = () =>
        createMockQueryBuilder({ data: null, error: { message: 'Not found' } });

      const result = await service.getProductsByCategory('nonexistent', 1, 12);

      expect(result.products).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(12);
    });
  });

  // -------------------------------------------------------------------------
  // getFullCatalog
  // -------------------------------------------------------------------------

  describe('getFullCatalog', () => {
    it('returns structured catalog with categories, products, and flavors', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Birthday Cakes', slug: 'birthday-cakes', description: 'Custom cakes', sort_order: 1, active: true },
      ];
      const mockProducts = [
        {
          id: 'prod-1',
          category_id: 'cat-1',
          name: 'Classic Birthday Cake',
          description_short: 'A classic vanilla birthday cake',
          price_min: 45,
          price_max: 120,
          min_servings: 10,
          max_servings: 50,
          lead_time_days: 7,
          image_url: 'https://example.com/cake.jpg',
          allergen_tags: ['dairy', 'gluten'],
          structured_data: {},
          active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      const mockFlavors = [
        { id: 'flav-1', product_id: 'prod-1', flavor_name: 'vanilla', available: true },
        { id: 'flav-2', product_id: 'prod-1', flavor_name: 'chocolate', available: true },
      ];

      mockFromImpl = (table: string) => {
        if (table === 'categories') {
          return createMockQueryBuilder({ data: mockCategories, error: null });
        }
        if (table === 'products') {
          return createMockQueryBuilder({ data: mockProducts, error: null });
        }
        if (table === 'product_flavors') {
          return createMockQueryBuilder({ data: mockFlavors, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.getFullCatalog();

      // Categories mapped correctly
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe('Birthday Cakes');
      expect(result.categories[0].sortOrder).toBe(1);

      // Products mapped with numeric prices and integer fields
      expect(result.products).toHaveLength(1);
      const product = result.products[0];
      expect(product.id).toBe('prod-1');
      expect(product.categoryId).toBe('cat-1');
      expect(typeof product.priceMin).toBe('number');
      expect(typeof product.priceMax).toBe('number');
      expect(Number.isInteger(product.minServings)).toBe(true);
      expect(Number.isInteger(product.maxServings)).toBe(true);
      expect(Number.isInteger(product.leadTimeDays)).toBe(true);

      // Flavors as string array
      expect(product.flavors).toEqual(['vanilla', 'chocolate']);

      // Allergen tags
      expect(product.allergenTags).toEqual(['dairy', 'gluten']);

      // lastUpdated is valid ISO string
      expect(result.lastUpdated).toBeDefined();
      expect(new Date(result.lastUpdated).toISOString()).toBe(result.lastUpdated);
    });

    it('returns empty arrays when database has no data', async () => {
      mockFromImpl = () => createMockQueryBuilder({ data: [], error: null });

      const result = await service.getFullCatalog();

      expect(result.categories).toEqual([]);
      expect(result.products).toEqual([]);
      expect(result.lastUpdated).toBeDefined();
    });

    it('throws error when categories query fails', async () => {
      mockFromImpl = (table: string) => {
        if (table === 'categories') {
          return createMockQueryBuilder({ data: null, error: { message: 'connection refused' } });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await expect(service.getFullCatalog()).rejects.toThrow(
        'Failed to fetch categories: connection refused'
      );
    });

    it('handles products with no associated flavors', async () => {
      const mockProducts = [
        {
          id: 'prod-2',
          category_id: 'cat-1',
          name: 'Simple Cake',
          description_short: 'A simple cake',
          price_min: 30,
          price_max: 60,
          min_servings: 8,
          max_servings: 20,
          lead_time_days: 5,
          image_url: 'https://example.com/simple.jpg',
          allergen_tags: [],
          structured_data: {},
          active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockFromImpl = (table: string) => {
        if (table === 'categories') {
          return createMockQueryBuilder({
            data: [{ id: 'cat-1', name: 'Cakes', slug: 'cakes', description: '', sort_order: 1, active: true }],
            error: null,
          });
        }
        if (table === 'products') {
          return createMockQueryBuilder({ data: mockProducts, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.getFullCatalog();
      expect(result.products[0].flavors).toEqual([]);
    });
  });
});
