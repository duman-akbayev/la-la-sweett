// =============================================================================
// La La Sweett Sales System — /api/catalog.json Route Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

vi.mock('@/services/catalog.service', () => ({
  CatalogService: {
    getFullCatalog: vi.fn(),
  },
}));

import { CatalogService } from '@/services/catalog.service';

const mockGetFullCatalog = CatalogService.getFullCatalog as ReturnType<typeof vi.fn>;

describe('GET /api/catalog.json', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns catalog data with 200 status and correct Cache-Control headers', async () => {
    const mockCatalog = {
      categories: [
        { id: 'cat-1', name: 'Birthday Cakes', slug: 'birthday-cakes', description: 'Custom birthday cakes', sortOrder: 1, active: true },
      ],
      products: [
        {
          id: 'prod-1',
          categoryId: 'cat-1',
          name: 'Classic Birthday Cake',
          descriptionShort: 'A classic vanilla birthday cake',
          priceMin: 45,
          priceMax: 120,
          minServings: 10,
          maxServings: 50,
          leadTimeDays: 7,
          imageUrl: 'https://example.com/cake.jpg',
          allergenTags: ['dairy', 'gluten'],
          flavors: ['vanilla', 'chocolate'],
        },
      ],
      lastUpdated: '2024-06-01T12:00:00.000Z',
    };

    mockGetFullCatalog.mockResolvedValue(mockCatalog);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=300'
    );

    expect(body.categories).toHaveLength(1);
    expect(body.products).toHaveLength(1);
    expect(body.lastUpdated).toBe('2024-06-01T12:00:00.000Z');

    // Validate numeric types survive JSON serialization
    const product = body.products[0];
    expect(typeof product.priceMin).toBe('number');
    expect(typeof product.priceMax).toBe('number');
    expect(typeof product.minServings).toBe('number');
    expect(typeof product.maxServings).toBe('number');
    expect(typeof product.leadTimeDays).toBe('number');
    expect(Array.isArray(product.flavors)).toBe(true);
    expect(product.flavors).toEqual(['vanilla', 'chocolate']);
  });

  it('returns 500 with error body when CatalogService throws', async () => {
    mockGetFullCatalog.mockRejectedValue(new Error('Database connection failed'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Failed to retrieve catalog data');
  });

  it('does not leak internal error details in the response', async () => {
    mockGetFullCatalog.mockRejectedValue(new Error('FATAL: password authentication failed'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.message).not.toContain('password');
    expect(body.error.message).not.toContain('FATAL');
  });
});
