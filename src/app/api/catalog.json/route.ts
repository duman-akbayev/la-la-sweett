// =============================================================================
// La La Sweett Sales System — /api/catalog.json Public Endpoint
// =============================================================================

import { NextResponse } from 'next/server';
import { CatalogService } from '@/services/catalog.service';

/**
 * GET /api/catalog.json
 *
 * Returns the full product catalog as structured JSON with:
 * - Numeric price fields (not strings)
 * - Integer servings and lead_time fields
 * - Enumerated flavor arrays
 * - All data parseable without natural language processing
 *
 * Validates: Requirements 1.5, 5.6
 */
export async function GET() {
  try {
    const catalog = await CatalogService.getFullCatalog();

    return NextResponse.json(catalog, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve catalog data',
        },
      },
      { status: 500 }
    );
  }
}
