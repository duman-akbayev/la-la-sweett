// =============================================================================
// Local mock data for development without Supabase connection
// =============================================================================

import type { Category, Product, Flavor, CatalogProduct } from '@/types';

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Birthday Cakes', slug: 'birthday-cakes', description: 'Custom birthday cakes for all ages, from elegant tiered designs to fun character themes.', sortOrder: 1, active: true },
  { id: 'cat-2', name: 'Wedding Cakes', slug: 'wedding-cakes', description: 'Stunning wedding cakes crafted to match your special day. Free initial consultation included.', sortOrder: 2, active: true },
  { id: 'cat-3', name: 'Baby Shower Cakes', slug: 'baby-shower-cakes', description: 'Adorable baby shower cakes with gender reveal options and cute designs.', sortOrder: 3, active: true },
  { id: 'cat-4', name: 'Graduation Cakes', slug: 'graduation-cakes', description: 'Celebrate academic achievements with custom graduation cakes.', sortOrder: 4, active: true },
  { id: 'cat-5', name: 'Holiday/Seasonal Cakes', slug: 'holiday-seasonal-cakes', description: 'Festive cakes for Christmas, Thanksgiving, Halloween, and more.', sortOrder: 5, active: true },
  { id: 'cat-6', name: 'Character/Themed Cakes', slug: 'character-themed-cakes', description: 'Fun character and themed cakes featuring popular characters and interests.', sortOrder: 6, active: true },
  { id: 'cat-7', name: 'Cupcakes', slug: 'cupcakes', description: 'Beautifully decorated cupcakes perfect for parties and events. Available by the dozen.', sortOrder: 7, active: true },
  { id: 'cat-8', name: 'Cake Pops', slug: 'cake-pops', description: 'Delicious cake pops in various flavors, great for party favors.', sortOrder: 8, active: true },
  { id: 'cat-9', name: 'Cookies', slug: 'cookies', description: 'Custom decorated sugar cookies for events, holidays, and gifts.', sortOrder: 9, active: true },
  { id: 'cat-10', name: 'Mini Dessert Tables/Packages', slug: 'mini-dessert-tables', description: 'Complete dessert table packages with assorted treats.', sortOrder: 10, active: true },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'prod-1', categoryId: 'cat-1', name: 'Classic Birthday Cake', descriptionShort: 'Elegant single or double tier birthday cake with custom buttercream design and personalized message.', priceMin: 75, priceMax: 150, minServings: 10, maxServings: 30, leadTimeDays: 7, imageUrl: '/images/placeholder-cake.svg', allergenTags: ['gluten-free'], structuredData: {}, active: true, createdAt: new Date() },
  { id: 'prod-2', categoryId: 'cat-1', name: 'Premium Birthday Cake', descriptionShort: 'Show-stopping multi-tier birthday cake with fondant details and custom toppers.', priceMin: 150, priceMax: 250, minServings: 20, maxServings: 60, leadTimeDays: 10, imageUrl: '/images/placeholder-cake.svg', allergenTags: [], structuredData: {}, active: true, createdAt: new Date() },
  { id: 'prod-3', categoryId: 'cat-1', name: 'Kids Birthday Fun Cake', descriptionShort: 'Colorful and playful birthday cake with fun shapes, sprinkles, and kid-friendly decorations.', priceMin: 75, priceMax: 175, minServings: 10, maxServings: 40, leadTimeDays: 7, imageUrl: '/images/placeholder-cake.svg', allergenTags: ['nut-free'], structuredData: {}, active: true, createdAt: new Date() },
  { id: 'prod-4', categoryId: 'cat-2', name: 'Classic Wedding Cake', descriptionShort: 'Timeless multi-tier wedding cake with buttercream or fondant finish, fresh flowers optional.', priceMin: 300, priceMax: 500, minServings: 50, maxServings: 150, leadTimeDays: 14, imageUrl: '/images/placeholder-cake.svg', allergenTags: [], structuredData: {}, active: true, createdAt: new Date() },
  { id: 'prod-5', categoryId: 'cat-2', name: 'Luxury Wedding Cake', descriptionShort: 'Stunning luxury wedding cake with hand-crafted sugar flowers and metallic accents.', priceMin: 500, priceMax: 800, minServings: 100, maxServings: 300, leadTimeDays: 21, imageUrl: '/images/placeholder-cake.svg', allergenTags: [], structuredData: {}, active: true, createdAt: new Date() },
  { id: 'prod-6', categoryId: 'cat-3', name: 'Gender Reveal Cake', descriptionShort: 'Surprise-filled gender reveal cake with hidden colored filling or confetti inside.', priceMin: 85, priceMax: 150, minServings: 15, maxServings: 40, leadTimeDays: 7, imageUrl: '/images/placeholder-cake.svg', allergenTags: [], structuredData: {}, active: true, createdAt: new Date() },
  { id: 'prod-7', categoryId: 'cat-7', name: 'Classic Cupcakes', descriptionShort: 'Beautifully piped buttercream cupcakes in your choice of flavors. Minimum order one dozen.', priceMin: 36, priceMax: 48, minServings: 12, maxServings: 120, leadTimeDays: 5, imageUrl: '/images/placeholder-cake.svg', allergenTags: ['nut-free', 'gluten-free'], structuredData: {}, active: true, createdAt: new Date() },
  { id: 'prod-8', categoryId: 'cat-8', name: 'Classic Cake Pops', descriptionShort: 'Delicious chocolate-dipped cake pops with sprinkles or drizzle. Minimum order one dozen.', priceMin: 30, priceMax: 42, minServings: 12, maxServings: 100, leadTimeDays: 5, imageUrl: '/images/placeholder-cake.svg', allergenTags: [], structuredData: {}, active: true, createdAt: new Date() },
  { id: 'prod-9', categoryId: 'cat-9', name: 'Decorated Sugar Cookies', descriptionShort: 'Hand-decorated royal icing sugar cookies in custom shapes and designs.', priceMin: 36, priceMax: 60, minServings: 12, maxServings: 120, leadTimeDays: 7, imageUrl: '/images/placeholder-cake.svg', allergenTags: [], structuredData: {}, active: true, createdAt: new Date() },
  { id: 'prod-10', categoryId: 'cat-10', name: 'Mini Dessert Package', descriptionShort: 'Curated dessert table with cake, cupcakes, and cake pops for intimate gatherings.', priceMin: 200, priceMax: 350, minServings: 20, maxServings: 50, leadTimeDays: 10, imageUrl: '/images/placeholder-cake.svg', allergenTags: [], structuredData: {}, active: true, createdAt: new Date() },
];

export const MOCK_FLAVORS: Flavor[] = [
  { id: 'f-1', productId: 'prod-1', name: 'Vanilla', available: true },
  { id: 'f-2', productId: 'prod-1', name: 'Chocolate', available: true },
  { id: 'f-3', productId: 'prod-1', name: 'Red Velvet', available: true },
  { id: 'f-4', productId: 'prod-1', name: 'Funfetti', available: true },
  { id: 'f-5', productId: 'prod-2', name: 'Vanilla', available: true },
  { id: 'f-6', productId: 'prod-2', name: 'Chocolate', available: true },
  { id: 'f-7', productId: 'prod-2', name: 'Lemon', available: true },
  { id: 'f-8', productId: 'prod-4', name: 'Vanilla Bean', available: true },
  { id: 'f-9', productId: 'prod-4', name: 'Champagne', available: true },
  { id: 'f-10', productId: 'prod-4', name: 'Lemon Raspberry', available: true },
  { id: 'f-11', productId: 'prod-7', name: 'Vanilla', available: true },
  { id: 'f-12', productId: 'prod-7', name: 'Chocolate', available: true },
  { id: 'f-13', productId: 'prod-7', name: 'Red Velvet', available: true },
];

export function getMockCatalogProducts(): CatalogProduct[] {
  return MOCK_PRODUCTS.map(p => ({
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    descriptionShort: p.descriptionShort,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    minServings: p.minServings,
    maxServings: p.maxServings,
    leadTimeDays: p.leadTimeDays,
    imageUrl: p.imageUrl,
    allergenTags: p.allergenTags,
    flavors: MOCK_FLAVORS.filter(f => f.productId === p.id).map(f => f.name),
  }));
}
