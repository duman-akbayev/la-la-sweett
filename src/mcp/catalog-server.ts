// =============================================================================
// MCP Catalog Server — Exposes catalog tools for the AI Assistant
// =============================================================================

import type {
  MCPServer,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  CatalogService,
} from '../types';

/**
 * MCP Catalog Server provides tool access for the AI Assistant
 * to query product catalog data via the CatalogService.
 *
 * Tools:
 * - get_categories: Returns all active product categories
 * - get_products: Returns paginated products for a category
 * - get_product_by_id: Returns a single product with flavor details
 * - search_products: Searches products by query string
 * - get_flavors: Returns all available flavors
 * - get_pricing_range: Returns min/max price range for a category
 * - calculate_servings: Returns serving recommendation for a guest count
 */
export class CatalogMCPServer implements MCPServer {
  name = 'catalog';
  tools: MCPTool[];

  private catalogService: CatalogService;

  constructor(catalogService: CatalogService) {
    this.catalogService = catalogService;
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'get_categories',
        description:
          'Returns all active cake categories (Birthday, Wedding, Baby Shower, etc.) with their slugs, names, and descriptions.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      },
      {
        name: 'get_products',
        description:
          'Returns a paginated list of products for a given category. Default page size is 12.',
        inputSchema: {
          type: 'object',
          properties: {
            categorySlug: {
              type: 'string',
              description: 'The slug identifier for the category (e.g., "birthday-cakes", "wedding-cakes").',
            },
            page: {
              type: 'number',
              description: 'Page number to retrieve (1-based). Defaults to 1.',
            },
            pageSize: {
              type: 'number',
              description: 'Number of products per page. Defaults to 12.',
            },
          },
          required: ['categorySlug'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_product_by_id',
        description:
          'Returns a single product by its ID, including full details and available flavors.',
        inputSchema: {
          type: 'object',
          properties: {
            productId: {
              type: 'string',
              description: 'The unique identifier of the product.',
            },
          },
          required: ['productId'],
          additionalProperties: false,
        },
      },
      {
        name: 'search_products',
        description:
          'Searches products by name or description. Returns all matching products.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match against product names and descriptions.',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_flavors',
        description:
          'Returns all available cake flavors across the catalog.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      },
      {
        name: 'get_pricing_range',
        description:
          'Returns the minimum and maximum price range for all products in a given category.',
        inputSchema: {
          type: 'object',
          properties: {
            categorySlug: {
              type: 'string',
              description: 'The slug identifier for the category to get pricing range for.',
            },
          },
          required: ['categorySlug'],
          additionalProperties: false,
        },
      },
      {
        name: 'calculate_servings',
        description:
          'Calculates a recommended cake size (number of servings) and tier configuration for a given guest count. Accepts 1-500 guests.',
        inputSchema: {
          type: 'object',
          properties: {
            guestCount: {
              type: 'number',
              description: 'Number of guests to serve (1-500).',
            },
          },
          required: ['guestCount'],
          additionalProperties: false,
        },
      },
    ];
  }

  async handleToolCall(call: MCPToolCall): Promise<MCPToolResult> {
    try {
      switch (call.toolName) {
        case 'get_categories':
          return await this.handleGetCategories();
        case 'get_products':
          return await this.handleGetProducts(call.arguments);
        case 'get_product_by_id':
          return await this.handleGetProductById(call.arguments);
        case 'search_products':
          return await this.handleSearchProducts(call.arguments);
        case 'get_flavors':
          return await this.handleGetFlavors();
        case 'get_pricing_range':
          return await this.handleGetPricingRange(call.arguments);
        case 'calculate_servings':
          return await this.handleCalculateServings(call.arguments);
        default:
          return {
            success: false,
            error: `Unknown tool: ${call.toolName}`,
          };
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      return {
        success: false,
        error: message,
      };
    }
  }

  private async handleGetCategories(): Promise<MCPToolResult> {
    const categories = await this.catalogService.getCategories();
    return {
      success: true,
      data: categories,
    };
  }

  private async handleGetProducts(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const categorySlug = args.categorySlug as string;
    if (!categorySlug) {
      return {
        success: false,
        error: 'categorySlug is required.',
      };
    }

    const page = (args.page as number) ?? 1;
    const pageSize = (args.pageSize as number) ?? 12;

    const result = await this.catalogService.getProductsByCategory(
      categorySlug,
      page,
      pageSize
    );
    return {
      success: true,
      data: result,
    };
  }

  private async handleGetProductById(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const productId = args.productId as string;
    if (!productId) {
      return {
        success: false,
        error: 'productId is required.',
      };
    }

    const product = await this.catalogService.getProduct(productId);
    return {
      success: true,
      data: product,
    };
  }

  private async handleSearchProducts(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const query = args.query as string;
    if (!query) {
      return {
        success: false,
        error: 'query is required.',
      };
    }

    const products = await this.catalogService.searchProducts(query);
    return {
      success: true,
      data: products,
    };
  }

  private async handleGetFlavors(): Promise<MCPToolResult> {
    const flavors = await this.catalogService.getFlavors();
    return {
      success: true,
      data: flavors,
    };
  }

  private async handleGetPricingRange(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const categorySlug = args.categorySlug as string;
    if (!categorySlug) {
      return {
        success: false,
        error: 'categorySlug is required.',
      };
    }

    // Fetch all products for the category to compute min/max pricing
    const result = await this.catalogService.getProductsByCategory(
      categorySlug,
      1,
      1000 // Fetch all to compute range
    );

    if (result.products.length === 0) {
      return {
        success: true,
        data: {
          categorySlug,
          minPrice: null,
          maxPrice: null,
          message: 'No products found in this category.',
        },
      };
    }

    const minPrice = Math.min(...result.products.map((p) => p.priceMin));
    const maxPrice = Math.max(...result.products.map((p) => p.priceMax));

    return {
      success: true,
      data: {
        categorySlug,
        minPrice,
        maxPrice,
        productCount: result.products.length,
      },
    };
  }

  private async handleCalculateServings(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const guestCount = args.guestCount as number;
    if (guestCount === undefined || guestCount === null) {
      return {
        success: false,
        error: 'guestCount is required.',
      };
    }

    if (guestCount < 1 || guestCount > 500) {
      return {
        success: false,
        error: 'guestCount must be between 1 and 500.',
      };
    }

    const recommendation =
      await this.catalogService.calculateServings(guestCount);
    return {
      success: true,
      data: recommendation,
    };
  }
}


/**
 * Creates a CatalogMCPServer wired to the actual Catalog Service module.
 * This is the default factory for production use.
 * Uses dynamic import to avoid triggering Supabase initialization at module load.
 */
export async function createCatalogMCPServer(): Promise<CatalogMCPServer> {
  const catalogServiceModule = await import('../services/catalog.service');
  const service: CatalogService = {
    getCategories: catalogServiceModule.getCategories,
    getProductsByCategory: catalogServiceModule.getProductsByCategory,
    getProduct: catalogServiceModule.getProduct,
    searchProducts: catalogServiceModule.searchProducts,
    getFlavors: catalogServiceModule.getFlavors,
    calculateServings: catalogServiceModule.calculateServings,
    getFullCatalog: catalogServiceModule.getFullCatalog,
  };
  return new CatalogMCPServer(service);
}
