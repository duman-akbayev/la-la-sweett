// =============================================================================
// Tests for AllergenBadge and AllergenBadgeList components
// =============================================================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllergenBadge, AllergenBadgeList, isAccommodationTag } from './AllergenBadge';

describe('AllergenBadge', () => {
  it('renders a badge for nut-free tag', () => {
    render(<AllergenBadge tag="nut-free" />);
    expect(screen.getByText('Nut-Free')).toBeInTheDocument();
  });

  it('renders a badge for gluten-free tag', () => {
    render(<AllergenBadge tag="gluten-free" />);
    expect(screen.getByText('Gluten-Free')).toBeInTheDocument();
  });

  it('returns null for contains-* tags', () => {
    const { container } = render(<AllergenBadge tag="contains-gluten" />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for contains-dairy tag', () => {
    const { container } = render(<AllergenBadge tag="contains-dairy" />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for unknown tags', () => {
    const { container } = render(<AllergenBadge tag="some-unknown-tag" />);
    expect(container.innerHTML).toBe('');
  });

  it('includes aria-label for accessibility', () => {
    render(<AllergenBadge tag="nut-free" />);
    expect(screen.getByLabelText('Allergen accommodation: Nut-Free')).toBeInTheDocument();
  });
});

describe('AllergenBadgeList', () => {
  it('renders badges for accommodation tags only', () => {
    render(
      <AllergenBadgeList tags={['nut-free', 'contains-gluten', 'gluten-free', 'contains-dairy']} />
    );
    expect(screen.getByText('Nut-Free')).toBeInTheDocument();
    expect(screen.getByText('Gluten-Free')).toBeInTheDocument();
    expect(screen.queryByText('contains-gluten')).not.toBeInTheDocument();
    expect(screen.queryByText('contains-dairy')).not.toBeInTheDocument();
  });

  it('returns null when no accommodation tags exist', () => {
    const { container } = render(
      <AllergenBadgeList tags={['contains-gluten', 'contains-dairy', 'contains-eggs']} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null for empty tags array', () => {
    const { container } = render(<AllergenBadgeList tags={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders all accommodation tags when multiple are present', () => {
    render(<AllergenBadgeList tags={['nut-free', 'gluten-free', 'dairy-free']} />);
    expect(screen.getByText('Nut-Free')).toBeInTheDocument();
    expect(screen.getByText('Gluten-Free')).toBeInTheDocument();
    expect(screen.getByText('Dairy-Free')).toBeInTheDocument();
  });

  it('renders the container with proper aria-label', () => {
    render(<AllergenBadgeList tags={['nut-free']} />);
    expect(screen.getByLabelText('Allergen accommodations')).toBeInTheDocument();
  });
});

describe('isAccommodationTag', () => {
  it('returns true for nut-free', () => {
    expect(isAccommodationTag('nut-free')).toBe(true);
  });

  it('returns true for gluten-free', () => {
    expect(isAccommodationTag('gluten-free')).toBe(true);
  });

  it('returns false for contains-gluten', () => {
    expect(isAccommodationTag('contains-gluten')).toBe(false);
  });

  it('returns false for arbitrary strings', () => {
    expect(isAccommodationTag('foo-bar')).toBe(false);
  });
});
