// =============================================================================
// La La Sweett — Product Specs
// Shared presentational block for storage, shelf life, minimum order, and the
// full allergen list. Used by the wholesale and celebration cake cards so the
// detail layout stays consistent across pages.
// =============================================================================

import React from "react";

export interface ProductSpecsProps {
  storage: string;
  shelfLife: string;
  /** Full list of contained allergens, e.g. ["Wheat", "Eggs", "Milk"] */
  allergens: string[];
  /** Optional minimum order (wholesale only) */
  minimumOrder?: string;
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-caption font-semibold uppercase tracking-widest text-brand-taupe/70">
        {label}
      </dt>
      <dd className="text-right text-body-sm font-medium text-brand-brown">
        {value}
      </dd>
    </div>
  );
}

export function ProductSpecs({
  storage,
  shelfLife,
  allergens,
  minimumOrder,
}: ProductSpecsProps) {
  return (
    <div className="mt-4 border-t border-brand-rose/[0.08] pt-4">
      <dl className="space-y-2">
        {minimumOrder && (
          <SpecRow label="Minimum Order" value={minimumOrder} />
        )}
        <SpecRow label="Storage" value={storage} />
        <SpecRow label="Shelf Life" value={shelfLife} />
      </dl>

      <div className="mt-4">
        <p className="text-caption font-semibold uppercase tracking-widest text-brand-taupe/70">
          Allergens
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5" role="list">
          {allergens.map((allergen) => (
            <li
              key={allergen}
              className="inline-flex items-center rounded-full border border-brand-rose/15 bg-brand-blush/40 px-2.5 py-0.5 text-xs font-medium text-brand-brown"
            >
              {allergen}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
