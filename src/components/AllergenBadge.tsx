// =============================================================================
// La La Sweett — Allergen Accommodation Badge Component
// Displays allergen accommodation tags (nut-free, gluten-free) as colored pills
// =============================================================================

import React from 'react';

/** Tags that indicate allergen ACCOMMODATIONS — shown prominently */
const ACCOMMODATION_TAGS = new Set(['nut-free', 'gluten-free', 'dairy-free', 'egg-free', 'vegan']);

/** Human-friendly labels for allergen accommodation tags */
const TAG_LABELS: Record<string, string> = {
  'nut-free': 'Nut-Free',
  'gluten-free': 'Gluten-Free',
  'dairy-free': 'Dairy-Free',
  'egg-free': 'Egg-Free',
  'vegan': 'Vegan',
};

export interface AllergenBadgeProps {
  /** The allergen tag string, e.g. "nut-free" or "gluten-free" */
  tag: string;
}

/**
 * Renders a single allergen accommodation badge as a small colored pill.
 * Only renders for accommodation tags (nut-free, gluten-free, etc.).
 * Returns null for "contains-*" tags since those are not displayed prominently.
 */
export function AllergenBadge({ tag }: AllergenBadgeProps) {
  if (!ACCOMMODATION_TAGS.has(tag)) {
    return null;
  }

  const label = TAG_LABELS[tag] ?? tag;

  return (
    <span
      className="inline-flex items-center rounded-full bg-brand-rose/15 px-2 py-0.5 text-xs font-medium text-brand-rose"
      aria-label={`Allergen accommodation: ${label}`}
    >
      {label}
    </span>
  );
}

export interface AllergenBadgeListProps {
  /** Array of allergen tag strings from product data */
  tags: string[];
}

/**
 * Renders a list of allergen accommodation badges for a product.
 * Filters to only show accommodation tags (nut-free, gluten-free, etc.).
 * "contains-*" tags are not displayed on the product card.
 */
export function AllergenBadgeList({ tags }: AllergenBadgeListProps) {
  const accommodationTags = tags.filter((tag) => ACCOMMODATION_TAGS.has(tag));

  if (accommodationTags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Allergen accommodations">
      {accommodationTags.map((tag) => (
        <AllergenBadge key={tag} tag={tag} />
      ))}
    </div>
  );
}

/**
 * Utility to check if a tag is an accommodation tag (for use outside this component).
 */
export function isAccommodationTag(tag: string): boolean {
  return ACCOMMODATION_TAGS.has(tag);
}
