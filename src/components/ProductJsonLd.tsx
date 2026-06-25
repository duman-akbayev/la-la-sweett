// =============================================================================
// La La Sweett — Product JSON-LD Structured Data Component
// Generates schema.org/Product markup for individual products
// =============================================================================

import type { Product } from '@/types';

interface ProductJsonLdProps {
  product: Product;
}

/**
 * Generates a schema.org/Product JSON-LD script tag for SEO structured data.
 * Renders name, description, image, and AggregateOffer with price range.
 */
export function ProductJsonLd({ product }: ProductJsonLdProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.descriptionShort,
    image: product.imageUrl,
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: product.priceMin,
      highPrice: product.priceMax,
      priceCurrency: 'USD',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
