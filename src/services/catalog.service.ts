// =============================================================================
// La La Sweett Sales System — Catalog Service Implementation
// =============================================================================

import { getSupabaseAdmin, isDbConfigured } from '@/lib/supabase';
import { MOCK_CATEGORIES, MOCK_PRODUCTS, MOCK_FLAVORS, getMockCatalogProducts } from '@/lib/mock-data';
import type {
  Category,
  Product,
  PaginatedProducts,
  Flavor,
  ServingsRecommendation,
  TierConfig,
  CatalogJSON,
  CatalogProduct,
  CatalogService as ICatalogService,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// Servings tier configuration lookup table
// Spec: monotonically non-decreasing, servings >= guestCount
// ---------------------------------------------------------------------------

interface ServingsTier {
  maxGuests: number;
  servings: number;
  tiers: TierConfig[];
}

const SERVINGS_TIERS: ServingsTier[] = [
  {
    maxGuests: 15,
    servings: 15,
    tiers: [{ tier: 1, servings: 15, size: '6" round' }],
  },
  {
    maxGuests: 30,
    servings: 30,
    tiers: [{ tier: 1, servings: 30, size: '8" round' }],
  },
  {
    maxGuests: 50,
    servings: 50,
    tiers: [
      { tier: 1, servings: 20, size: '6" round' },
      { tier: 2, servings: 30, size: '8" round' },
    ],
  },
  {
    maxGuests: 100,
    servings: 100,
    tiers: [
      { tier: 1, servings: 15, size: '6" round' },
      { tier: 2, servings: 30, size: '8" round' },
      { tier: 3, servings: 55, size: '10" round' },
    ],
  },
  {
    maxGuests: 150,
    servings: 150,
    tiers: [
      { tier: 1, servings: 15, size: '6" round' },
      { tier: 2, servings: 30, size: '8" round' },
      { tier: 3, servings: 105, size: '12" round' },
    ],
  },
  {
    maxGuests: 200,
    servings: 200,
    tiers: [
      { tier: 1, servings: 15, size: '6" round' },
      { tier: 2, servings: 30, size: '8" round' },
      { tier: 3, servings: 55, size: '10" round' },
      { tier: 4, servings: 100, size: '12" round' },
    ],
  },
  {
    maxGuests: 300,
    servings: 300,
    tiers: [
      { tier: 1, servings: 15, size: '6" round' },
      { tier: 2, servings: 30, size: '8" round' },
      { tier: 3, servings: 55, size: '10" round' },
      { tier: 4, servings: 200, size: '14" round' },
    ],
  },
  {
    maxGuests: 500,
    servings: 500,
    tiers: [
      { tier: 1, servings: 15, size: '6" round' },
      { tier: 2, servings: 30, size: '8" round' },
      { tier: 3, servings: 55, size: '10" round' },
      { tier: 4, servings: 100, size: '12" round' },
      { tier: 5, servings: 300, size: '14" round' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helper: Map database row to domain Category
// ---------------------------------------------------------------------------

function mapRowToCategory(row: {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  active: boolean;
}): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

// ---------------------------------------------------------------------------
// Helper: Map database row to domain Product
// ---------------------------------------------------------------------------

function mapRowToProduct(row: {
  id: string;
  category_id: string;
  name: string;
  description_short: string;
  price_min: number;
  price_max: number;
  min_servings: number;
  max_servings: number;
  lead_time_days: number;
  image_url: string;
  allergen_tags: unknown;
  structured_data: unknown;
  active: boolean;
  created_at: string;
}): Product {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    descriptionShort: row.description_short,
    priceMin: row.price_min,
    priceMax: row.price_max,
    minServings: row.min_servings,
    maxServings: row.max_servings,
    leadTimeDays: row.lead_time_days,
    imageUrl: row.image_url,
    allergenTags: Array.isArray(row.allergen_tags)
      ? (row.allergen_tags as string[])
      : [],
    structuredData:
      typeof row.structured_data === 'object' && row.structured_data !== null
        ? (row.structured_data as Record<string, unknown>)
        : {},
    active: row.active,
    createdAt: new Date(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Service methods (exported individually for convenience)
// ---------------------------------------------------------------------------

/**
 * Returns all active categories sorted by sort_order.
 */
export async function getCategories(): Promise<Category[]> {
  if (!isDbConfigured()) {
    return MOCK_CATEGORIES.filter(c => c.active).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  return (data ?? []).map(mapRowToCategory);
}

/**
 * Returns a single category by slug, or null if not found.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (!isDbConfigured()) {
    return MOCK_CATEGORIES.find(c => c.slug === slug && c.active) ?? null;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch category: ${error.message}`);
  }

  return data ? mapRowToCategory(data) : null;
}

/**
 * Returns paginated products for a given category slug.
 * Default page size is 12 (per requirements: "up to 12 items per page").
 * totalPages = ceil(total / pageSize)
 */
export async function getProductsByCategory(
  categorySlug: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedProducts> {
  if (!isDbConfigured()) {
    const category = MOCK_CATEGORIES.find(c => c.slug === categorySlug && c.active);
    if (!category) return { products: [], total: 0, page, pageSize, totalPages: 0 };
    const allProducts = MOCK_PRODUCTS.filter(p => p.categoryId === category.id && p.active);
    const total = allProducts.length;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    const offset = (page - 1) * pageSize;
    const products = allProducts.slice(offset, offset + pageSize);
    return { products, total, page, pageSize, totalPages };
  }

  const supabase = getSupabaseAdmin();

  // Find the category by slug
  const { data: categoryData, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .eq('active', true)
    .single();

  if (categoryError || !categoryData) {
    return {
      products: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const categoryId = (categoryData as unknown as { id: string }).id;

  // Get total count of active products in this category
  const { count, error: countError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('active', true);

  if (countError) {
    throw new Error(`Failed to count products: ${countError.message}`);
  }

  const total = count ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  // Calculate offset for pagination
  const offset = (page - 1) * pageSize;

  // Fetch the products for the requested page
  const { data: productsData, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', categoryId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (productsError) {
    throw new Error(`Failed to fetch products: ${productsError.message}`);
  }

  return {
    products: (productsData ?? []).map(mapRowToProduct),
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Returns a single product by ID.
 */
export async function getProduct(productId: string): Promise<Product> {
  if (!isDbConfigured()) {
    const product = MOCK_PRODUCTS.find(p => p.id === productId);
    if (!product) throw new Error(`Product not found: ${productId}`);
    return product;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !data) {
    throw new Error(
      `Product not found: ${error?.message ?? 'No data returned'}`
    );
  }

  return mapRowToProduct(data);
}

/**
 * Searches products by name or description (case-insensitive partial match).
 */
export async function searchProducts(query: string): Promise<Product[]> {
  if (!isDbConfigured()) {
    const q = query.toLowerCase();
    return MOCK_PRODUCTS.filter(p => p.active && (p.name.toLowerCase().includes(q) || p.descriptionShort.toLowerCase().includes(q)));
  }

  const supabase = getSupabaseAdmin();
  const searchTerm = `%${query}%`;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .or(`name.ilike.${searchTerm},description_short.ilike.${searchTerm}`);

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }

  return (data ?? []).map(mapRowToProduct);
}

/**
 * Returns all available flavors.
 */
export async function getFlavors(): Promise<Flavor[]> {
  if (!isDbConfigured()) {
    return MOCK_FLAVORS.filter(f => f.available);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('product_flavors')
    .select('*')
    .eq('available', true);

  if (error) {
    throw new Error(`Failed to fetch flavors: ${error.message}`);
  }

  type FlavorRow = { id: string; product_id: string; flavor_name: string; available: boolean };
  const typedData = (data ?? []) as unknown as FlavorRow[];

  return typedData.map((row) => ({
    id: row.id,
    productId: row.product_id,
    name: row.flavor_name,
    available: row.available,
  }));
}

/**
 * Calculates recommended servings and tier configuration for a guest count.
 * Guest count must be between 1 and 500.
 * Returns servings >= guestCount, monotonically non-decreasing.
 */
export async function calculateServings(
  guestCount: number
): Promise<ServingsRecommendation> {
  if (guestCount < 1 || guestCount > 500) {
    throw new Error('Guest count must be between 1 and 500');
  }

  // Find the appropriate tier configuration
  const tier = SERVINGS_TIERS.find((t) => guestCount <= t.maxGuests);

  // Safety fallback to the largest tier
  const selectedTier = tier ?? SERVINGS_TIERS[SERVINGS_TIERS.length - 1];

  return {
    guestCount,
    recommendedServings: selectedTier.servings,
    tierConfiguration: selectedTier.tiers,
  };
}

/**
 * Returns the full catalog as a JSON structure.
 * Prices are numeric, servings and lead_time are integers, flavors are string arrays.
 */
export async function getFullCatalog(): Promise<CatalogJSON> {
  if (!isDbConfigured()) {
    return {
      categories: MOCK_CATEGORIES.filter(c => c.active),
      products: getMockCatalogProducts(),
      lastUpdated: new Date().toISOString(),
    };
  }

  const supabase = getSupabaseAdmin();

  // Fetch all active categories
  const categories = await getCategories();

  // Fetch all active products
  const { data: productsData, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (productsError) {
    throw new Error(`Failed to fetch products: ${productsError.message}`);
  }

  // Fetch all available flavors
  const { data: flavorsData, error: flavorsError } = await supabase
    .from('product_flavors')
    .select('*')
    .eq('available', true);

  if (flavorsError) {
    throw new Error(`Failed to fetch flavors: ${flavorsError.message}`);
  }

  // Type assertion for product_flavors rows
  type FlavorRow = { id: string; product_id: string; flavor_name: string; available: boolean };
  const typedFlavors = (flavorsData ?? []) as unknown as FlavorRow[];

  // Group flavors by product ID
  const flavorsByProduct = new Map<string, string[]>();
  for (const flavor of typedFlavors) {
    const existing = flavorsByProduct.get(flavor.product_id) ?? [];
    existing.push(flavor.flavor_name);
    flavorsByProduct.set(flavor.product_id, existing);
  }

  // Type assertion for product rows
  type ProductRow = {
    id: string;
    category_id: string;
    name: string;
    description_short: string;
    price_min: number;
    price_max: number;
    min_servings: number;
    max_servings: number;
    lead_time_days: number;
    image_url: string;
    allergen_tags: unknown;
    structured_data: unknown;
    active: boolean;
    created_at: string;
  };
  const typedProducts = (productsData ?? []) as unknown as ProductRow[];

  // Map products to CatalogProduct format
  const products: CatalogProduct[] = typedProducts.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    descriptionShort: row.description_short,
    priceMin: row.price_min,
    priceMax: row.price_max,
    minServings: row.min_servings,
    maxServings: row.max_servings,
    leadTimeDays: row.lead_time_days,
    imageUrl: row.image_url,
    allergenTags: Array.isArray(row.allergen_tags)
      ? (row.allergen_tags as string[])
      : [],
    flavors: flavorsByProduct.get(row.id) ?? [],
  }));

  return {
    categories,
    products,
    lastUpdated: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Factory function and service object
// ---------------------------------------------------------------------------

/**
 * Factory function for creating a catalog service instance.
 * Uses the Supabase admin client for all database queries.
 */
export function createCatalogService(): ICatalogService {
  return {
    getCategories,
    getProductsByCategory,
    getProduct,
    searchProducts,
    getFlavors,
    calculateServings,
    getFullCatalog,
  };
}

/** Pre-built service instance for direct use */
export const catalogService: ICatalogService = {
  getCategories,
  getProductsByCategory,
  getProduct,
  searchProducts,
  getFlavors,
  calculateServings,
  getFullCatalog,
};

/** Capitalized export for route handlers (backward compatible) */
export const CatalogService = catalogService;
