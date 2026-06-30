import Link from "next/link";
import Image from "next/image";
import { getCategories } from "@/services/catalog.service";
import { ScrollReveal } from "@/components/ScrollReveal";
import { GalleryGrid } from "@/components/GalleryGrid";
import { FEATURES } from "@/lib/feature-flags";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cake Gallery — Custom Cakes in Austin, TX",
  description:
    "Browse our gallery of handcrafted custom cakes, cupcakes, cookies, and desserts in Austin, TX. Every creation is made to order by La La Sweett.",
  alternates: { canonical: "/cakes" },
};

export const revalidate = 60;

// Inspiring photography for the gallery — reuses the existing custom-cake
// photos already shipped in /public/images/custom-cakes/.
const GALLERY_IMAGES = Array.from({ length: 24 }, (_, i) => ({
  src: `/images/custom-cakes/custom-cake-${String(i + 1).padStart(2, "0")}.jpeg`,
  alt: `Custom cake creation ${i + 1} by La La Sweett`,
}));

export default async function CakesPage() {
  // Categories are only needed when that (temporarily hidden) section is on.
  const categories = FEATURES.SHOW_CAKES_CATEGORIES ? await getCategories() : [];

  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-hero px-6 py-section-y-mobile text-center lg:px-8 lg:py-section-y">
        <div className="mx-auto max-w-2xl">
          <ScrollReveal>
            <p className="text-caption font-semibold uppercase tracking-widest text-brand-gold">
              Handcrafted in Austin, TX
            </p>
            <h1 className="mt-3 font-display text-display font-bold text-brand-espresso sm:text-display-xl">
              Gallery
            </h1>
            <p className="mt-5 text-body-lg text-brand-taupe">
              A gallery of cakes we&apos;ve lovingly created. Tap any photo to
              view it full size, and let it inspire your next celebration.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Interactive Gallery (the simplified "Our Cakes" view) */}
      <section
        aria-label="Cake gallery"
        className="mx-auto max-w-container px-6 py-section-y-mobile lg:px-8 lg:py-section-y"
      >
        <GalleryGrid images={GALLERY_IMAGES} />
      </section>

      {/* -----------------------------------------------------------------
          Categories grid — temporarily hidden (feature-flagged).
          Restore by setting SHOW_CAKES_CATEGORIES = true in feature-flags.ts
          ----------------------------------------------------------------- */}
      {FEATURES.SHOW_CAKES_CATEGORIES && (
        <section
          aria-label="Cake categories"
          className="mx-auto max-w-container px-6 pb-section-y-mobile lg:px-8 lg:pb-section-y"
        >
          <ScrollReveal>
            <h2 className="font-display text-heading-1 text-brand-brown">
              Categories
            </h2>
            <p className="mt-2 text-body text-brand-taupe">
              Select a category to explore our full range.
            </p>
          </ScrollReveal>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => (
              <ScrollReveal key={category.id} delay={index * 80}>
                <Link
                  href={`/cakes/${category.slug}`}
                  className="group block rounded-card border border-brand-rose/[0.06] bg-white p-7 transition-all duration-400 ease-spring hover:-translate-y-1 hover:border-brand-rose/[0.12] hover:shadow-card-hover"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-rose/[0.08]">
                      <div className="h-2 w-2 rounded-full bg-brand-rose" />
                    </div>
                    <h3 className="font-display text-xl text-brand-brown transition-colors group-hover:text-brand-rose">
                      {category.name}
                    </h3>
                  </div>
                  <p className="mt-3 line-clamp-2 text-body-sm text-brand-taupe">
                    {category.description}
                  </p>
                  <span className="mt-4 inline-flex items-center text-sm font-medium text-brand-rose opacity-0 transition-all duration-300 group-hover:opacity-100">
                    Browse collection
                    <svg
                      className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
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
                  </span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

      {/* -----------------------------------------------------------------
          Full Menu section — temporarily hidden (feature-flagged).
          Restore by setting SHOW_CAKES_FULL_MENU = true in feature-flags.ts
          ----------------------------------------------------------------- */}
      {FEATURES.SHOW_CAKES_FULL_MENU && (
        <section className="border-t border-brand-rose/[0.06] bg-brand-cream/40 py-section-y-mobile lg:py-section-y">
          <div className="mx-auto max-w-container px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center">
                <h2 className="font-display text-heading-1 text-brand-brown">
                  Our Full Menu
                </h2>
                <p className="mt-3 text-body text-brand-taupe">
                  Download or view our complete menu with all flavors, pricing,
                  and wholesale options.
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <ScrollReveal delay={0}>
                <div className="group overflow-hidden rounded-card bg-white shadow-card transition-all duration-300 hover:shadow-card-hover">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src="/images/Menu.jpeg"
                      alt="La La Sweett cake flavors menu"
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-lg text-brand-brown">
                      Cake Flavors Menu
                    </h3>
                    <p className="mt-1 text-body-sm text-brand-taupe">
                      All our signature flavors with descriptions and starting
                      prices.
                    </p>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={100}>
                <div className="group overflow-hidden rounded-card bg-white shadow-card transition-all duration-300 hover:shadow-card-hover">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src="/images/wholesale-menu.jpeg"
                      alt="La La Sweett wholesale menu"
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-lg text-brand-brown">
                      Wholesale Menu
                    </h3>
                    <p className="mt-1 text-body-sm text-brand-taupe">
                      Bulk pricing for cafés, restaurants, and event planners.
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
