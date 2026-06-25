// =============================================================================
// Unit Tests — LocalBusinessJsonLd Component
// =============================================================================

import { render } from '@testing-library/react';
import { LocalBusinessJsonLd } from './LocalBusinessJsonLd';

describe('LocalBusinessJsonLd', () => {
  it('renders a script tag with type application/ld+json', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
  });

  it('generates valid JSON in the script tag', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(() => JSON.parse(script!.textContent!)).not.toThrow();
  });

  it('uses schema.org context and Bakery type', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('Bakery');
  });

  it('includes the business name "La La Sweett"', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.name).toBe('La La Sweett');
  });

  it('includes a description of the business', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.description).toContain('Custom cakes bakery');
    expect(data.description).toContain('Austin, TX');
  });

  it('includes the business URL', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.url).toBe('https://lalasweett.com');
  });

  it('includes a telephone number', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.telephone).toBeDefined();
    expect(data.telephone).toMatch(/^\+1-/);
  });

  it('includes a PostalAddress with Austin, TX', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.address).toBeDefined();
    expect(data.address['@type']).toBe('PostalAddress');
    expect(data.address.addressLocality).toBe('Austin');
    expect(data.address.addressRegion).toBe('TX');
    expect(data.address.postalCode).toBe('78701');
    expect(data.address.addressCountry).toBe('US');
  });

  it('includes GeoCoordinates for Austin', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.geo).toBeDefined();
    expect(data.geo['@type']).toBe('GeoCoordinates');
    expect(data.geo.latitude).toBeCloseTo(30.2672, 2);
    expect(data.geo.longitude).toBeCloseTo(-97.7431, 2);
  });

  it('includes opening hours specifications', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.openingHoursSpecification).toBeDefined();
    expect(data.openingHoursSpecification).toHaveLength(2);
  });

  it('includes weekday hours (Mon-Fri 09:00-18:00)', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    const weekdayHours = data.openingHoursSpecification[0];
    expect(weekdayHours['@type']).toBe('OpeningHoursSpecification');
    expect(weekdayHours.dayOfWeek).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ]);
    expect(weekdayHours.opens).toBe('09:00');
    expect(weekdayHours.closes).toBe('18:00');
  });

  it('includes Saturday hours (10:00-16:00)', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    const saturdayHours = data.openingHoursSpecification[1];
    expect(saturdayHours['@type']).toBe('OpeningHoursSpecification');
    expect(saturdayHours.dayOfWeek).toBe('Saturday');
    expect(saturdayHours.opens).toBe('10:00');
    expect(saturdayHours.closes).toBe('16:00');
  });

  it('includes a priceRange indicator', () => {
    const { container } = render(<LocalBusinessJsonLd />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);

    expect(data.priceRange).toBe('$$');
  });
});
