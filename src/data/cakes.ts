// =============================================================================
// La La Sweett — Custom Celebration Cakes Data
// Structured, single source of truth for the /celebrations page.
// Two pricing models are supported per cake:
//   1. sizes[]    — size-based pricing with Classic / Berry options
//   2. flatPrice  — a single price with a weight (e.g. $130, 4.4 lbs)
// Edit values here; the page renders directly from this array.
// =============================================================================

/** One purchasable size of a cake, with Classic and optional Berry pricing */
export interface CakeSizeOption {
  /** Size label, e.g. '6"' */
  size: string;
  /** Serving estimate, e.g. "serves 5–6" */
  serves: string;
  /** Classic price in USD */
  classic: number;
  /** Raspberry/Strawberry price in USD (optional) */
  berry?: number;
}

/** A flat-priced cake sold at a single size/weight */
export interface CakeFlatPrice {
  /** Price in USD */
  price: number;
  /** Weight label, e.g. "4.4 lbs" */
  weight: string;
}

export interface CelebrationCake {
  /** Stable id used as React key and anchor target */
  id: string;
  /** Display name */
  name: string;
  /** Short flavor description */
  description: string;
  /** Path to product photo under /public */
  image: string;
  /** Descriptive alt text for accessibility */
  imageAlt: string;
  /** Storage instruction */
  storage: string;
  /** Shelf life */
  shelfLife: string;
  /** List of allergens contained in the cake */
  allergens: string[];
  /** Size-based pricing (mutually exclusive with flatPrice) */
  sizes?: CakeSizeOption[];
  /** Single flat price (mutually exclusive with sizes) */
  flatPrice?: CakeFlatPrice;
}

/** Label shown for the "berry" pricing column across size-based cakes */
export const BERRY_OPTION_LABEL = "Raspberry / Strawberry";

export const CELEBRATION_CAKES: CelebrationCake[] = [
  {
    id: "medovik-honey-cake",
    name: "Medovik – Traditional Honey Layer Cake",
    description:
      "Soft honey cake layers with a light whipped sour cream filling.",
    image: "/images/custom-cakes/medovik-honey-cake.jpeg",
    imageAlt: "Medovik traditional honey layer cake",
    storage: "Refrigerated",
    shelfLife: "Up to 3 days",
    allergens: ["Wheat", "Eggs", "Milk"],
    sizes: [
      { size: '6"', serves: "serves 5–6", classic: 70, berry: 80 },
      { size: '8"', serves: "serves 8–10", classic: 90, berry: 100 },
      { size: '10"', serves: "serves 14–16", classic: 140, berry: 150 },
    ],
  },
  {
    id: "condensed-milk-cream-cake",
    name: "Condensed Milk Cream Cake",
    description:
      "Delicate condensed milk cake layers with a smooth cream made from sour cream, cream cheese, and whipped cream.",
    image: "/images/custom-cakes/condensed-milk-cream-cake.jpeg",
    imageAlt: "Condensed milk cream cake",
    storage: "Refrigerated",
    shelfLife: "Up to 3 days",
    allergens: ["Wheat", "Eggs", "Milk"],
    sizes: [
      { size: '6"', serves: "serves 5–6", classic: 75, berry: 85 },
      { size: '8"', serves: "serves 8–10", classic: 95, berry: 105 },
      { size: '10"', serves: "serves 14–16", classic: 145, berry: 155 },
    ],
  },
  {
    id: "chocolate-praline-poppy-seed-cake",
    name: "Chocolate Praline Poppy Seed Cake",
    description:
      "Chocolate poppy seed sponge cake with hazelnut praline cream and caramel filling.",
    image: "/images/custom-cakes/chocolate-praline-poppy-seed-cake.jpeg",
    imageAlt: "Chocolate praline poppy seed cake",
    storage: "Refrigerated",
    shelfLife: "Up to 3 days",
    allergens: ["Wheat", "Eggs", "Milk", "Tree Nuts (Hazelnut)"],
    flatPrice: { price: 130, weight: "4.4 lbs" },
  },
  {
    id: "triple-chocolate-cake",
    name: "Triple Chocolate Cake",
    description:
      "Rich chocolate sponge cake made with dark chocolate, layered with milk chocolate cream and white chocolate ganache.",
    image: "/images/custom-cakes/triple-chocolate-cake.jpeg",
    imageAlt: "Triple chocolate cake",
    storage: "Refrigerated",
    shelfLife: "Up to 3 days",
    allergens: ["Wheat", "Eggs", "Milk", "Soy"],
    flatPrice: { price: 130, weight: "4.4 lbs" },
  },
  {
    id: "oreo-caramel-dream-cake",
    name: "Oreo Caramel Dream Cake",
    description:
      "Chocolate sponge cake with caramel filling and crunchy Oreo cookies.",
    image: "/images/custom-cakes/oreo-caramel-dream-cake.jpeg",
    imageAlt: "Oreo caramel dream cake",
    storage: "Refrigerated",
    shelfLife: "Up to 3 days",
    allergens: ["Wheat", "Eggs", "Milk", "Soy"],
    flatPrice: { price: 125, weight: "4.4 lbs" },
  },
  {
    id: "red-velvet-raspberry-cake",
    name: "Red Velvet Raspberry Cake",
    description: "Classic red velvet sponge cake with raspberry confit.",
    image: "/images/custom-cakes/red-velvet-raspberry-cake.jpeg",
    imageAlt: "Red velvet raspberry cake",
    storage: "Refrigerated",
    shelfLife: "Up to 3 days",
    allergens: ["Wheat", "Eggs", "Milk", "Soy"],
    flatPrice: { price: 125, weight: "4.4 lbs" },
  },
  {
    id: "strawberry-lemonade-cake",
    name: "Strawberry Lemonade Cake",
    description:
      "Light lemon sponge cake with strawberry cream and strawberry confit.",
    image: "/images/custom-cakes/strawberry-lemonade-cake.jpeg",
    imageAlt: "Strawberry lemonade cake",
    storage: "Refrigerated",
    shelfLife: "Up to 3 days",
    allergens: ["Wheat", "Eggs", "Milk"],
    flatPrice: { price: 125, weight: "4.4 lbs" },
  },
];
