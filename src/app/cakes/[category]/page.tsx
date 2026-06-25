// =============================================================================
// La La Sweett — Category Detail Page (ISR, revalidate every 60s)
// =============================================================================

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getCategories,
  getCategoryBySlug,
  getProductsByCategory,
} from '@/services/catalog.service';
import { ProductCard } from '@/components/ProductCard';
import type { Metadata } from 'next';

// ---------------------------------------------------------------------------
// ISR Configuration
// ---------------------------------------------------------------------------

export const revalidate = 60;

// ---------------------------------------------------------------------------
// Static Params — pre-render all category slugs
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({ category: cat.slug }));
}

// ---------------------------------------------------------------------------
// Dynamic Metadata
// ---------------------------------------------------------------------------

type PageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return { title: 'Category Not Found | La La Sweett' };
  }

  return {
    title: `${category.name} | La La Sweett - Custom Cakes Austin TX`,
    description:
      category.description.slice(0, 160) ||
      `Browse our ${category.name} collection. Custom designs for every occasion in Austin, TX.`,
  };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params;
  const { page: pageParam } = await searchParams;

  // Validate category exists
  const category = await getCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  // Parse page number from search params
  const currentPage = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);

  // Fetch paginated products
  const { products, total, page, totalPages } = await getProductsByCategory(
    slug,
    currentPage,
    12
  );

  return (
    <main className="min-h-screen bg-brand-ivory px-6 py-12 lg:px-8">
      <div className="mx-auto max-w-container">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-sm text-brand-taupe">
            <li>
              <Link href="/" className="hover:text-brand-rose transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href="/cakes"
                className="hover:text-brand-rose transition-colors"
              >
                Cakes
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-brand-rose">
              {category.name}
            </li>
          </ol>
        </nav>

        {/* Category Header */}
        <header className="mb-10">
          <h1 className="font-display text-3xl text-brand-brown sm:text-4xl lg:text-5xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-3 max-w-2xl text-lg text-brand-espresso/80">
              {category.description}
            </p>
          )}
          {total > 0 && (
            <p className="mt-2 text-sm text-brand-taupe">
              {total} {total === 1 ? 'item' : 'items'} available
            </p>
          )}
        </header>

        {/* Content */}
        {products.length === 0 ? (
          <EmptyState categoryName={category.name} />
        ) : (
          <>
            {/* Product Gallery Grid */}
            <section aria-label={`${category.name} products`}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                categorySlug={slug}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Empty State Component
// ---------------------------------------------------------------------------

function EmptyState({ categoryName }: { categoryName: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-card">
      <div className="mb-4 text-5xl" aria-hidden="true">
        🎂
      </div>
      <p className="text-lg text-brand-espresso/80">
        No items are currently available in this category
      </p>
      <p className="mt-2 text-sm text-brand-taupe">
        Check back soon — we&apos;re always adding new{' '}
        {categoryName.toLowerCase()} designs!
      </p>
      <Link
        href="/cakes"
        className="mt-6 inline-block rounded-full bg-brand-rose px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-rose/90"
      >
        Browse Other Categories
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination Controls Component
// ---------------------------------------------------------------------------

function PaginationControls({
  currentPage,
  totalPages,
  categorySlug,
}: {
  currentPage: number;
  totalPages: number;
  categorySlug: string;
}) {
  const getPageUrl = (pageNum: number) => {
    if (pageNum === 1) return `/cakes/${categorySlug}`;
    return `/cakes/${categorySlug}?page=${pageNum}`;
  };

  const pageNumbers = getVisiblePageNumbers(currentPage, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="mt-12 flex items-center justify-center gap-2"
    >
      {/* Previous Button */}
      {currentPage > 1 ? (
        <Link
          href={getPageUrl(currentPage - 1)}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-espresso shadow-card transition-colors hover:bg-brand-rose hover:text-white"
          aria-label="Go to previous page"
        >
          Previous
        </Link>
      ) : (
        <span
          className="cursor-not-allowed rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-taupe/50 shadow-card"
          aria-disabled="true"
        >
          Previous
        </span>
      )}

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === -1) {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-brand-taupe"
                aria-hidden="true"
              >
                …
              </span>
            );
          }

          const isActive = pageNum === currentPage;
          return (
            <Link
              key={pageNum}
              href={getPageUrl(pageNum)}
              className={`min-w-[40px] rounded-full px-3 py-2 text-center text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-rose text-white'
                  : 'bg-white text-brand-espresso shadow-card hover:bg-brand-rose/10 hover:text-brand-rose'
              }`}
              aria-label={`Go to page ${pageNum}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {pageNum}
            </Link>
          );
        })}
      </div>

      {/* Next Button */}
      {currentPage < totalPages ? (
        <Link
          href={getPageUrl(currentPage + 1)}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-espresso shadow-card transition-colors hover:bg-brand-rose hover:text-white"
          aria-label="Go to next page"
        >
          Next
        </Link>
      ) : (
        <span
          className="cursor-not-allowed rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-taupe/50 shadow-card"
          aria-disabled="true"
        >
          Next
        </span>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Utility: Calculate visible page numbers with ellipsis
// ---------------------------------------------------------------------------

function getVisiblePageNumbers(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: number[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push(-1); // ellipsis
  }

  // Pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push(-1); // ellipsis
  }

  // Always show last page
  pages.push(total);

  return pages;
}
