import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { WholesaleCard } from "@/components/WholesaleCard";
import { WHOLESALE_PRODUCTS } from "@/data/wholesale";

export const metadata: Metadata = {
  title: "Wholesale Bakery in Austin, TX",
  description:
    "Fresh handcrafted baked goods for cafes, offices, events, and business partners. Wholesale honey cakes, cookies, and muffins from La La Sweett in Austin, TX.",
  alternates: { canonical: "/wholesale" },
};

export default function WholesalePage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-hero px-6 py-section-y-mobile text-center lg:px-8 lg:py-section-y">
        <div className="mx-auto max-w-2xl">
          <ScrollReveal>
            <p className="text-caption font-semibold uppercase tracking-widest text-brand-gold">
              For Businesses
            </p>
            <h1 className="mt-3 font-display text-display font-bold text-brand-espresso sm:text-display-xl">
              Wholesale Bakery
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-body-lg text-brand-taupe">
              Fresh handcrafted baked goods for cafes, offices, events, and
              business partners.
            </p>
            <div className="mt-10 flex justify-center">
              <Link href="#wholesale-grid" className="btn-gold">
                Explore Wholesale
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Product Grid */}
      <section
        id="wholesale-grid"
        aria-label="Wholesale products"
        className="mx-auto max-w-container scroll-mt-24 px-6 py-section-y-mobile lg:px-8 lg:py-section-y"
      >
        <ScrollReveal>
          <div className="text-center">
            <h2 className="font-display text-heading-1 text-brand-brown">
              Our Wholesale Menu
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-body text-brand-taupe">
              Baked fresh to order. Pricing, minimums, and allergen details for
              each item are listed below.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {WHOLESALE_PRODUCTS.map((product, index) => (
            <ScrollReveal key={product.id} delay={index * 100}>
              <WholesaleCard product={product} />
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="mt-14 text-center">
            <p className="text-body text-brand-taupe">
              Interested in a wholesale partnership or a custom order?
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/order" className="btn-primary">
                Request a Wholesale Order
              </Link>
              <Link href="/celebrations" className="btn-secondary">
                Browse Custom Cakes
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
