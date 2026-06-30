// =============================================================================
// La La Sweett — Wholesale Product Card
// Renders a single wholesale product (photo, name, price, description, and
// full specs) for the /wholesale product grid.
// =============================================================================

import Image from "next/image";
import { ProductSpecs } from "@/components/ProductSpecs";
import type { WholesaleProduct } from "@/data/wholesale";

export interface WholesaleCardProps {
  product: WholesaleProduct;
}

export function WholesaleCard({ product }: WholesaleCardProps) {
  return (
    <article className="product-card group flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={product.image}
          alt={product.imageAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          loading="lazy"
        />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-heading-3 text-brand-brown">
            {product.name}
          </h3>
          <div className="shrink-0 text-right">
            <span className="block text-lg font-semibold text-brand-primary">
              {product.price}
            </span>
            <span className="block text-xs text-brand-taupe">{product.unit}</span>
          </div>
        </div>

        {product.servings && (
          <p className="mt-1.5 text-body-sm text-brand-taupe">
            {product.servings}
          </p>
        )}

        {product.description && (
          <p className="mt-3 text-body-sm leading-relaxed text-brand-taupe">
            {product.description}
          </p>
        )}

        <div className="mt-auto">
          <ProductSpecs
            storage={product.storage}
            shelfLife={product.shelfLife}
            allergens={product.allergens}
            minimumOrder={product.minimumOrder}
          />
        </div>
      </div>
    </article>
  );
}
