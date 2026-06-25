// =============================================================================
// Unit Tests — ProductJsonLd Component
// =============================================================================

import { render } from '@testing-library/react';
import { ProductJsonLd } from './ProductJsonLd';
import type { Product } from '@/types';

function createMockProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'prod-001',
    categoryId: 'cat-001',
    name: 'Classic Birthday Cake',
    descriptionShort: 'Elegant single or double tier birthday cake with custom decorations.',
    priceMin: 75,
    priceMax: 150,
    minServings: 10,
    maxServings: 50,
    leadTimeDays: 7,
    imageUrl: 'https://lalasweett.com/images/products/birthday-classic.jpg',
    allergenTags: ['nut-free'],
    structuredData: {},
    active: true,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('ProductJsonLd', () => {
  it('renders a script tag with type application/ld+json', () => {
    const product = createMockProduct();
    const { container } = render(<ProductJsonLd product={product} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
  });

  it('generates valid schema.org/Product structured data', () => {
    const product = createMockProduct();
    const { container } = render(<ProductJsonLd product={product} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('Product');
  });

  it('includes the product name', () => {
    const product = createMockProduct({ name: 'Wedding Elegance Cake' });
    const { container } = render(<ProductJsonLd product={product} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.name).toBe('Wedding Elegance Cake');
  });

  it('includes the product description', () => {
    const product = createMockProduct({
      descriptionShort: 'A beautiful three-tier wedding cake.',
    });
    const { container } = render(<ProductJsonLd product={product} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.description).toBe('A beautiful three-tier wedding cake.');
  });

  it('includes the product image URL', () => {
    const product = createMockProduct({
      imageUrl: 'https://lalasweett.com/images/cake.jpg',
    });
    const { container } = render(<ProductJsonLd product={product} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.image).toBe('https://lalasweett.com/images/cake.jpg');
  });

  it('includes AggregateOffer with correct price range', () => {
    const product = createMockProduct({ priceMin: 50, priceMax: 200 });
    const { container } = render(<ProductJsonLd product={product} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.offers).toEqual({
      '@type': 'AggregateOffer',
      lowPrice: 50,
      highPrice: 200,
      priceCurrency: 'USD',
    });
  });

  it('handles products with zero price min', () => {
    const product = createMockProduct({ priceMin: 0, priceMax: 50 });
    const { container } = render(<ProductJsonLd product={product} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.offers.lowPrice).toBe(0);
    expect(data.offers.highPrice).toBe(50);
  });

  it('handles empty description gracefully', () => {
    const product = createMockProduct({ descriptionShort: '' });
    const { container } = render(<ProductJsonLd product={product} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.description).toBe('');
  });

  it('properly escapes special characters in JSON', () => {
    const product = createMockProduct({
      name: 'Cake "Delight" & <Special>',
      descriptionShort: 'A cake with "quotes" & <tags>',
    });
    const { container } = render(<ProductJsonLd product={product} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    // Should not throw on parse
    const data = JSON.parse(script!.textContent!);
    expect(data.name).toBe('Cake "Delight" & <Special>');
    expect(data.description).toBe('A cake with "quotes" & <tags>');
  });
});
