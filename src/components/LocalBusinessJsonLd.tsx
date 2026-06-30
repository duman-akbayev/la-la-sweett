// =============================================================================
// La La Sweett — LocalBusiness JSON-LD Structured Data Component
// Generates schema.org/LocalBusiness (Bakery) markup for every page
// =============================================================================

/**
 * Generates a schema.org/LocalBusiness (subtype: Bakery) JSON-LD script tag.
 * Includes business name, address, phone, hours, geo coordinates, and price range.
 * Should be rendered on every page via the root layout.
 */
export function LocalBusinessJsonLd() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: 'La La Sweett',
    description:
      'Custom cakes and wholesale bakery in Austin, TX specializing in birthday, wedding, and celebration cakes, plus cookies and muffins for businesses.',
    url: 'https://lalasweett.com',
    telephone: '+1-224-237-5853',
    image: 'https://lalasweett.com/images/logo/logo.png',
    logo: 'https://lalasweett.com/images/logo/logo.png',
    sameAs: ['https://www.instagram.com/la_la_sweett'],
    areaServed: {
      '@type': 'City',
      name: 'Austin',
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Austin',
      addressRegion: 'TX',
      postalCode: '78701',
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 30.2672,
      longitude: -97.7431,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
        ],
        opens: '09:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '10:00',
        closes: '16:00',
      },
    ],
    priceRange: '$$',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
