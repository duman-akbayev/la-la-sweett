// =============================================================================
// Unit Tests — MCP Catalog Server
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogMCPServer } from './catalog-server';
import type { CatalogService, Category, PaginatedProducts, Product, Flavor, ServingsRecommendation } from '../types';

function createMockCatalogService(): CatalogService {
  return {
    getCategories: vi.fn(),
    getProductsByCategory: vi.fn(),
    getProduct: vi.fn(),
    searchProducts: vi.fn(),
    getFlavors: vi.fn(),
    calculateServings: vi.fn(),
    getFullCatalog: vi.fn(),
  };
}

const mockCategory: Category = {
  id: 'cat-1',
  name: 'Birthday Cakes',
  slug: 'birthday-cakes',
  description: 'Custom birthday cakes for all ages',
  sortOrder: 1,
  active: true,
};

const mockProduct: Product = {
  id: 'prod-1',
  categoryId: 'cat-1',
  name: 'Classic Birthday Cake',
  descriptionShort: 'A beautiful layered birthday cake.',
  priceMin: 45,
  priceMax: 120,
  minServings: 10,
  maxServings: 50,
  leadTimeDays: 7,
  imageUrl: 'https://example.com/cake.jpg',
  allergenTags: ['nut-free'],
  structuredData: {},
  active: true,
  createdAt: new Date(),
};

const mockFlavor: Flavor = {
  id: 'flav-1',
  productId: 'prod-1',
  name: 'Vanilla Bean',
  available: true,
};

describe('CatalogMCPServer', () => {
  let server: CatalogMCPServer;
  let mockService: CatalogService;

  beforeEach(() => {
    mockService = createMockCatalogService();
    server = new CatalogMCPServer(mockService);
  });

  describe('server metadata', () => {
    it('should have name "catalog"', () => {
      expect(server.name).toBe('catalog');
    });

    it('should expose 7 tools', () => {
      expect(server.tools).toHaveLength(7);
    });

    it('should define all expected tool names', () => {
      const toolNames = server.tools.map((t) => t.name);
      expect(toolNames).toContain('get_categories');
      expect(toolNames).toContain('get_products');
      expect(toolNames).toContain('get_product_by_id');
      expect(toolNames).toContain('search_products');
      expect(toolNames).toContain('get_flavors');
      expect(toolNames).toContain('get_pricing_range');
      expect(toolNames).toContain('calculate_servings');
    });

    it('should have descriptions for all tools', () => {
      for (const tool of server.tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.description.length).toBeGreaterThan(10);
      }
    });

    it('should have inputSchema for all tools', () => {
      for (const tool of server.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  describe('get_categories', () => {
    it('should return categories from catalog service', async () => {
      vi.mocked(mockService.getCategories).mockResolvedValue([mockCategory]);

      const result = await server.handleToolCall({
        toolName: 'get_categories',
        arguments: {},
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockCategory]);
      expect(mockService.getCategories).toHaveBeenCalledOnce();
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.getCategories).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await server.handleToolCall({
        toolName: 'get_categories',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('get_products', () => {
    const paginatedResult: PaginatedProducts = {
      products: [mockProduct],
      total: 1,
      page: 1,
      pageSize: 12,
      totalPages: 1,
    };

    it('should return paginated products for a category', async () => {
      vi.mocked(mockService.getProductsByCategory).mockResolvedValue(paginatedResult);

      const result = await server.handleToolCall({
        toolName: 'get_products',
        arguments: { categorySlug: 'birthday-cakes' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(paginatedResult);
      expect(mockService.getProductsByCategory).toHaveBeenCalledWith('birthday-cakes', 1, 12);
    });

    it('should pass custom page and pageSize', async () => {
      vi.mocked(mockService.getProductsByCategory).mockResolvedValue(paginatedResult);

      await server.handleToolCall({
        toolName: 'get_products',
        arguments: { categorySlug: 'wedding-cakes', page: 2, pageSize: 6 },
      });

      expect(mockService.getProductsByCategory).toHaveBeenCalledWith('wedding-cakes', 2, 6);
    });

    it('should return error when categorySlug is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_products',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('categorySlug is required');
    });
  });

  describe('get_product_by_id', () => {
    it('should return product by ID', async () => {
      vi.mocked(mockService.getProduct).mockResolvedValue(mockProduct);

      const result = await server.handleToolCall({
        toolName: 'get_product_by_id',
        arguments: { productId: 'prod-1' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProduct);
      expect(mockService.getProduct).toHaveBeenCalledWith('prod-1');
    });

    it('should return error when productId is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_product_by_id',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('productId is required');
    });
  });

  describe('search_products', () => {
    it('should search and return matching products', async () => {
      vi.mocked(mockService.searchProducts).mockResolvedValue([mockProduct]);

      const result = await server.handleToolCall({
        toolName: 'search_products',
        arguments: { query: 'birthday' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockProduct]);
      expect(mockService.searchProducts).toHaveBeenCalledWith('birthday');
    });

    it('should return error when query is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'search_products',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('query is required');
    });
  });

  describe('get_flavors', () => {
    it('should return all available flavors', async () => {
      vi.mocked(mockService.getFlavors).mockResolvedValue([mockFlavor]);

      const result = await server.handleToolCall({
        toolName: 'get_flavors',
        arguments: {},
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockFlavor]);
      expect(mockService.getFlavors).toHaveBeenCalledOnce();
    });
  });

  describe('get_pricing_range', () => {
    it('should return min/max prices for a category', async () => {
      const products: PaginatedProducts = {
        products: [
          { ...mockProduct, priceMin: 30, priceMax: 80 },
          { ...mockProduct, id: 'prod-2', priceMin: 50, priceMax: 150 },
        ],
        total: 2,
        page: 1,
        pageSize: 1000,
        totalPages: 1,
      };
      vi.mocked(mockService.getProductsByCategory).mockResolvedValue(products);

      const result = await server.handleToolCall({
        toolName: 'get_pricing_range',
        arguments: { categorySlug: 'birthday-cakes' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        categorySlug: 'birthday-cakes',
        minPrice: 30,
        maxPrice: 150,
        productCount: 2,
      });
    });

    it('should handle empty category gracefully', async () => {
      vi.mocked(mockService.getProductsByCategory).mockResolvedValue({
        products: [],
        total: 0,
        page: 1,
        pageSize: 1000,
        totalPages: 0,
      });

      const result = await server.handleToolCall({
        toolName: 'get_pricing_range',
        arguments: { categorySlug: 'nonexistent' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        categorySlug: 'nonexistent',
        minPrice: null,
        maxPrice: null,
        message: 'No products found in this category.',
      });
    });

    it('should return error when categorySlug is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_pricing_range',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('categorySlug is required');
    });
  });

  describe('calculate_servings', () => {
    const mockRecommendation: ServingsRecommendation = {
      guestCount: 50,
      recommendedServings: 60,
      tierConfiguration: [
        { tier: 1, servings: 30, size: '8-inch' },
        { tier: 2, servings: 30, size: '6-inch' },
      ],
    };

    it('should return servings recommendation for valid guest count', async () => {
      vi.mocked(mockService.calculateServings).mockResolvedValue(mockRecommendation);

      const result = await server.handleToolCall({
        toolName: 'calculate_servings',
        arguments: { guestCount: 50 },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRecommendation);
      expect(mockService.calculateServings).toHaveBeenCalledWith(50);
    });

    it('should reject guest count below 1', async () => {
      const result = await server.handleToolCall({
        toolName: 'calculate_servings',
        arguments: { guestCount: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('between 1 and 500');
    });

    it('should reject guest count above 500', async () => {
      const result = await server.handleToolCall({
        toolName: 'calculate_servings',
        arguments: { guestCount: 501 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('between 1 and 500');
    });

    it('should return error when guestCount is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'calculate_servings',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('guestCount is required');
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool name', async () => {
      const result = await server.handleToolCall({
        toolName: 'nonexistent_tool',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool: nonexistent_tool');
    });
  });
});
