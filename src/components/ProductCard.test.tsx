// =============================================================================
// Tests for ProductCard component
// =============================================================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard } from './ProductCard';
import type { Product } from '@/types';

function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    categoryId: 'cat-1',
    name: 'Chocolate Dream Cake',
    descriptionShort: 'Rich chocolate layers with ganache filling and dark chocolate shavings.',
    priceMin: 65,
    priceMax: 120,
    minServings: 10,
    maxServings: 50,
    leadTimeDays: 7,
    imageUrl: '/images/chocolate-dream.jpg',
    allergenTags: ['nut-free', 'contains-gluten', 'contains-dairy'],
    structuredData: {},
    active: true,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('renders product name', () => {
    render(<ProductCard product={createMockProduct()} />);
    expect(screen.getByText('Chocolate Dream Cake')).toBeInTheDocument();
  });

  it('renders price in "$X – $Y" format', () => {
    render(<ProductCard product={createMockProduct()} />);
    expect(screen.getByText('$65 – $120')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<ProductCard product={createMockProduct()} />);
    expect(
      screen.getByText('Rich chocolate layers with ganache filling and dark chocolate shavings.')
    ).toBeInTheDocument();
  });

  it('truncates description longer than 150 characters with ellipsis', () => {
    const longDescription = 'A'.repeat(160);
    render(<ProductCard product={createMockProduct({ descriptionShort: longDescription })} />);
    const truncated = 'A'.repeat(150) + '…';
    expect(screen.getByText(truncated)).toBeInTheDocument();
  });

  it('does not truncate description at exactly 150 characters', () => {
    const exactDescription = 'B'.repeat(150);
    render(<ProductCard product={createMockProduct({ descriptionShort: exactDescription })} />);
    expect(screen.getByText(exactDescription)).toBeInTheDocument();
  });

  it('renders allergen accommodation badges (nut-free) but not contains-* tags', () => {
    render(<ProductCard product={createMockProduct()} />);
    expect(screen.getByText('Nut-Free')).toBeInTheDocument();
    expect(screen.queryByText('contains-gluten')).not.toBeInTheDocument();
    expect(screen.queryByText('contains-dairy')).not.toBeInTheDocument();
  });

  it('does not render allergen section when no accommodation tags exist', () => {
    render(
      <ProductCard
        product={createMockProduct({ allergenTags: ['contains-gluten', 'contains-dairy'] })}
      />
    );
    expect(screen.queryByLabelText('Allergen accommodations')).not.toBeInTheDocument();
  });

  it('renders product image with proper alt text', () => {
    render(<ProductCard product={createMockProduct()} />);
    expect(screen.getByAltText('Chocolate Dream Cake')).toBeInTheDocument();
  });

  it('links to order page with product id', () => {
    render(<ProductCard product={createMockProduct()} />);
    const links = screen.getAllByRole('link');
    const orderLinks = links.filter((link) => link.getAttribute('href')?.includes('/order'));
    expect(orderLinks.length).toBeGreaterThan(0);
    expect(orderLinks[0].getAttribute('href')).toBe('/order?product=prod-1');
  });

  it('renders without description when descriptionShort is empty', () => {
    render(<ProductCard product={createMockProduct({ descriptionShort: '' })} />);
    expect(screen.getByText('Chocolate Dream Cake')).toBeInTheDocument();
    expect(screen.getByText('$65 – $120')).toBeInTheDocument();
  });

  it('renders with empty allergenTags array without error', () => {
    render(<ProductCard product={createMockProduct({ allergenTags: [] })} />);
    expect(screen.getByText('Chocolate Dream Cake')).toBeInTheDocument();
    expect(screen.queryByLabelText('Allergen accommodations')).not.toBeInTheDocument();
  });
});
