// =============================================================================
// La La Sweett — Business Policies Page
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Policies | La La Sweett - Custom Cakes Austin TX",
  description:
    "La La Sweett bakery policies including deposit requirements, lead times, delivery zones, cancellation, allergen accommodations, and free wedding consultation.",
};

export default function PoliciesPage() {
  return (
    <main className="min-h-screen bg-brand-ivory px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-sm text-brand-taupe">
            <li>
              <Link href="/" className="hover:text-brand-rose transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-brand-rose">
              Policies
            </li>
          </ol>
        </nav>

        {/* Page Header */}
        <header className="mb-10">
          <h1 className="font-display text-3xl text-brand-brown sm:text-4xl lg:text-5xl">
            Our Policies
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-brand-espresso/80">
            Everything you need to know before placing your custom cake order
            with La La Sweett.
          </p>
        </header>

        {/* Policies Content */}
        <div className="space-y-10">
          {/* Deposit Requirements */}
          <section aria-labelledby="deposit-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="deposit-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Deposit Requirements
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  A <strong className="text-brand-espresso">50% deposit</strong> is
                  required to book your custom cake order. The remaining balance
                  is due before delivery or pickup.
                </p>
                <p>
                  Deposits secure your event date on our production calendar and
                  allow us to begin planning your design.
                </p>
              </div>
            </div>
          </section>

          {/* Lead Time */}
          <section aria-labelledby="lead-time-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="lead-time-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Minimum Lead Time
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  We require a minimum of{" "}
                  <strong className="text-brand-espresso">1–2 weeks</strong> for
                  custom cake orders. This ensures we can dedicate the time and
                  attention your design deserves.
                </p>
                <p>
                  For complex designs (multi-tier, sculpted, or highly detailed
                  cakes), additional lead time may be needed. We recommend
                  reaching out as early as possible, especially for wedding cakes
                  and large events.
                </p>
              </div>
            </div>
          </section>

          {/* Cancellation Policy */}
          <section aria-labelledby="cancellation-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="cancellation-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Cancellation Policy
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  We understand that plans can change. If you need to cancel your
                  order, please notify us as soon as possible.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    Orders cancelled before deposit payment incur no charge.
                  </li>
                  <li>
                    For paid orders (deposit received, confirmed, or in
                    production), cancellations are flagged for refund review on a
                    case-by-case basis.
                  </li>
                  <li>
                    Refund eligibility depends on how close the cancellation is
                    to the event date and whether production has already begun.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Delivery Zones and Fees */}
          <section aria-labelledby="delivery-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="delivery-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Delivery Zones &amp; Fees
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  We deliver within the{" "}
                  <strong className="text-brand-espresso">Austin metro area</strong>
                  . Delivery fees vary based on distance from our location.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    Central Austin (within 10 miles): delivery fee applies
                  </li>
                  <li>
                    Greater Austin metro (10–25 miles): higher delivery fee
                    applies
                  </li>
                  <li>
                    Addresses outside the Austin metro area are not eligible for
                    delivery — free pickup is available as an alternative
                  </li>
                </ul>
                <p>
                  Exact delivery fees are calculated based on your address and
                  will be included in your quote.
                </p>
              </div>
            </div>
          </section>

          {/* Free Pickup */}
          <section aria-labelledby="pickup-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="pickup-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Free Pickup
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  <strong className="text-brand-espresso">
                    Pickup is always free!
                  </strong>{" "}
                  You can pick up your order at our Austin, TX location at a
                  scheduled time. We&apos;ll coordinate pickup details with you
                  once your order is confirmed.
                </p>
              </div>
            </div>
          </section>

          {/* Allergen Accommodations */}
          <section aria-labelledby="allergen-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="allergen-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Allergen Accommodations
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  We accommodate common allergens and dietary needs. Currently
                  available options include:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong className="text-brand-espresso">Nut-free</strong> —
                    cakes prepared without tree nuts or peanuts
                  </li>
                  <li>
                    <strong className="text-brand-espresso">Gluten-free</strong> —
                    cakes made with gluten-free flour alternatives
                  </li>
                </ul>
                <p>
                  Please let us know about any allergies or dietary requirements
                  when placing your order so we can ensure your cake is safe and
                  delicious.
                </p>
              </div>
            </div>
          </section>

          {/* Free Wedding Consultation */}
          <section aria-labelledby="wedding-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="wedding-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Free Wedding Cake Consultation
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  Planning your dream wedding cake? We offer a{" "}
                  <strong className="text-brand-espresso">
                    free initial consultation
                  </strong>{" "}
                  to discuss your vision, flavors, design, and budget.
                </p>
                <p>
                  During your consultation, we&apos;ll walk through design
                  options, review flavor combinations, and provide a custom quote
                  tailored to your celebration. Reach out via our order form,
                  WhatsApp, or Instagram DM to schedule yours.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-brand-taupe">Have questions about our policies?</p>
          <Link
            href="/order"
            className="mt-4 inline-block rounded-full bg-brand-rose px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-rose/90"
          >
            Place an Order
          </Link>
        </div>
      </div>
    </main>
  );
}
