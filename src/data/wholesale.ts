// =============================================================================
// La La Sweett — Wholesale Product Data
// Structured, single source of truth for the /wholesale page.
// Edit prices, descriptions, minimums, or allergens here — the page reads
// directly from this array, so no JSX changes are needed.
// =============================================================================

export interface WholesaleProduct {
  /** Stable id used as React key and anchor target */
  id: string;
  /** Display name */
  name: string;
  /** Path to product photo under /public */
  image: string;
  /** Descriptive alt text for accessibility */
  imageAlt: string;
  /** Price amount, e.g. "$55" or "$2.00" */
  price: string;
  /** Pricing unit, e.g. "per cake" or "each" */
  unit: string;
  /** Optional serving estimate, e.g. "Approx. 9–10 servings" */
  servings?: string;
  /** Optional longer product description */
  description?: string;
  /** Minimum order quantity, e.g. "12 pcs" or "1 cake" */
  minimumOrder: string;
  /** Storage instruction, e.g. "Refrigerated" or "Room temperature" */
  storage: string;
  /** Shelf life, e.g. "Up to 7 days" */
  shelfLife: string;
  /** List of allergens contained in the product */
  allergens: string[];
}

export const WHOLESALE_PRODUCTS: WholesaleProduct[] = [
  {
    id: "medovik-honey-cake",
    name: "Medovik – Traditional Honey Layer Cake",
    image: "/images/wholesale/medovik-honey-cake.jpeg",
    imageAlt: "Traditional Medovik honey layer cake with cream filling",
    price: "$55",
    unit: "per cake",
    servings: "Approx. 9–10 servings",
    minimumOrder: "1 cake",
    storage: "Refrigerated",
    shelfLife: "Up to 3 days",
    allergens: ["Eggs", "Milk", "Wheat"],
  },
  {
    id: "chocolate-chip-cookies",
    name: "Chocolate Chip Cookies",
    image: "/images/wholesale/chocolate-chip-cookies.jpeg",
    imageAlt: "Golden-brown chocolate chip cookies",
    price: "$2.00",
    unit: "each",
    description:
      "Buttery, golden-brown cookies loaded with chocolate chips. Made from scratch with brown sugar, real butter, and pure vanilla extract. Soft in the center, crisp at the edges.",
    minimumOrder: "12 pcs",
    storage: "Room temperature",
    shelfLife: "Up to 7 days",
    allergens: ["Wheat", "Eggs", "Milk"],
  },
  {
    id: "blueberry-crumble-muffins",
    name: "Blueberry Crumble Muffins",
    image: "/images/wholesale/blueberry-crumble-muffins.jpeg",
    imageAlt: "Blueberry crumble muffins with golden butter topping",
    price: "$2.75",
    unit: "each",
    description:
      "Soft, fluffy muffins bursting with real blueberries, topped with a golden butter crumble. Made with sour cream for extra moisture and baked fresh to order.",
    minimumOrder: "10 pcs",
    storage: "Room temperature",
    shelfLife: "3–4 days",
    allergens: ["Wheat", "Eggs", "Milk", "Soy"],
  },
];
