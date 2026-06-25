import Link from "next/link";
import Image from "next/image";
import { getCategories } from "@/services/catalog.service";
import { ScrollReveal } from "@/components/ScrollReveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Cakes | La La Sweett - Custom Cakes Austin TX",
  description:
    "Browse our full collection of custom cakes, cupcakes, cookies, and desserts in Austin, TX. Every creation is handcrafted to order.",
};

export const revalidate = 60;

const SHOWCASE_IMAGES = [
  { src: "/images/custom-cakes/custom-cake-02.jpeg", alt: "Wedding cake with peonies" },
  { src: "/images/custom-cakes/custom-cake-08.jpeg", alt: "Gold and blueberry cake" },
  { src: "/images/custom-cakes/custom-cake-24.jpeg", alt: "Vintage ribbon cake" },
  { src: "/images/custom-cakes/custom-cake-05.jpeg", alt: "Strawberry cream cake" },
  { src: "/images/custom-cakes/custom-cake-12.jpeg", alt: "Chocolate raspberry cake" },
  { src: "/images/custom-cakes/custom-cake-15.jpeg", alt: "Graduation cake" },
];

export default async function CakesPage() {
  const categories = await getCategories();

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
              Our Cakes & Treats
            </h1>
            <p className="mt-5 text-body-lg text-brand-taupe">
              Every creation is custom-made with love. Browse our categories
              below and let us bring your vision to life.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Photo Mosaic */}
      <section className="mx-auto max-w-container px-6 py-12 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SHOWCASE_IMAGES.map((img, index) => (
            <ScrollReveal key={img.src} delay={index * 80}>
              <div className="relative aspect-square overflow-hidden rounded-image">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  className="object-cover transition-transform duration-500 hover:scale-[1.06]"
                  loading="lazy"
                />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Category Grid */}
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

      {/* Menu Section */}
      <section className="border-t border-brand-rose/[0.06] bg-brand-cream/40 py-section-y-mobile lg:py-section-y">
        <div className="mx-auto max-w-container px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center">
              <h2 className="font-display text-heading-1 text-brand-brown">
                Our Full Menu
              </h2>
              <p className="mt-3 text-body text-brand-taupe">
                Download or view our complete menu with all flavors, pricing, and
                wholesale options.
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
                    All our signature flavors with descriptions and starting prices.
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
    </>
  );
}
