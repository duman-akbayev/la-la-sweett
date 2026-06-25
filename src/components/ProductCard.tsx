import Link from "next/link";
import Image from "next/image";
import { AllergenBadgeList } from "@/components/AllergenBadge";
import { ProductJsonLd } from "@/components/ProductJsonLd";
import type { Product } from "@/types";

export interface ProductCardProps {
  product: Product;
}

function truncateDescription(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

export function ProductCard({ product }: ProductCardProps) {
  const priceDisplay = `$${product.priceMin} – $${product.priceMax}`;
  const description = product.descriptionShort
    ? truncateDescription(product.descriptionShort, 150)
    : "";

  return (
    <article className="product-card group">
      <ProductJsonLd product={product} />

      <Link
        href={`/order?product=${encodeURIComponent(product.id)}`}
        aria-label={`Order ${product.name}`}
      >
        <div className="relative aspect-portrait overflow-hidden">
          <Image
            src={product.imageUrl || "/images/placeholder-cake.jpg"}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-espresso/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
      </Link>

      <div className="p-5">
        <h2 className="font-display text-lg text-brand-brown">
          <Link
            href={`/order?product=${encodeURIComponent(product.id)}`}
            className="transition-colors duration-200 hover:text-brand-rose"
          >
            {product.name}
          </Link>
        </h2>

        <p className="mt-1.5 text-sm font-semibold text-brand-gold">
          {priceDisplay}
        </p>

        {description && (
          <p className="mt-2 line-clamp-2 text-body-sm text-brand-taupe">
            {description}
          </p>
        )}

        {product.allergenTags.length > 0 && (
          <div className="mt-3">
            <AllergenBadgeList tags={product.allergenTags} />
          </div>
        )}

        <div className="mt-4 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <Link
            href={`/order?product=${encodeURIComponent(product.id)}`}
            className="inline-flex items-center text-sm font-medium text-brand-rose transition-colors hover:text-brand-rose-dark"
          >
            Order This Cake
            <svg
              className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M3 8h10m0 0L9 4m4 4L9 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
