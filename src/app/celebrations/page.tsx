import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { CelebrationCakeCard } from "@/components/CelebrationCakeCard";
import { CELEBRATION_CAKES } from "@/data/cakes";

export const metadata: Metadata = {
  title: "Custom Celebration Cakes in Austin, TX",
  description:
    "Beautiful handcrafted custom cakes for birthdays, weddings, and every celebration. Medovik, triple chocolate, red velvet, and more from La La Sweett in Austin, TX.",
  alternates: { canonical: "/celebrations" },
};

export default function CelebrationsPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-hero px-6 py-section-y-mobile text-center lg:px-8 lg:py-section-y">
        <div className="mx-auto max-w-2xl">
          <ScrollReveal>
            <p className="text-caption font-semibold uppercase tracking-widest text-brand-gold">
              For Celebrations
            </p>
            <h1 className="mt-3 font-display text-display font-bold text-brand-espresso sm:text-display-xl">
              Custom Cakes
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-body-lg text-brand-taupe">
              Beautiful handcrafted cakes made just for your special moments.
            </p>
            <div className="mt-10 flex justify-center">
              <Link href="#cake-list" className="btn-gold">
                Explore Custom Cakes
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Cake List */}
      <section
        id="cake-list"
        aria-label="Custom cakes"
        className="mx-auto max-w-container scroll-mt-24 px-6 py-section-y-mobile lg:px-8 lg:py-section-y"
      >
        <ScrollReveal>
          <div className="text-center">
            <h2 className="font-display text-heading-1 text-brand-brown">
              Our Cake Flavors
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-body text-brand-taupe">
              Choose your size and flavor. Each cake is made from scratch and
              decorated to order.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CELEBRATION_CAKES.map((cake, index) => (
            <ScrollReveal key={cake.id} delay={index * 100}>
              <CelebrationCakeCard cake={cake} />
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="mt-14 text-center">
            <p className="text-body text-brand-taupe">
              Ready to design your celebration cake?
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/order" className="btn-gold">
                Start Your Order
              </Link>
              <Link href="/wholesale" className="btn-secondary">
                Explore Wholesale
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
