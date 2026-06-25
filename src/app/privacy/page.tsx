// =============================================================================
// La La Sweett — Privacy Policy Page
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | La La Sweett - Custom Cakes Austin TX",
  description:
    "La La Sweett privacy policy: what data we collect, how we use it, how we store it, and how to request data deletion.",
};

export default function PrivacyPage() {
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
              Privacy Policy
            </li>
          </ol>
        </nav>

        {/* Page Header */}
        <header className="mb-10">
          <h1 className="font-display text-3xl text-brand-brown sm:text-4xl lg:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-brand-espresso/80">
            Your privacy matters to us. This policy explains how La La Sweett
            collects, uses, stores, and protects your personal information.
          </p>
        </header>

        {/* Privacy Content */}
        <div className="space-y-10">
          {/* Data Collection */}
          <section aria-labelledby="collection-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="collection-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                What Data We Collect
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  We collect only the information necessary to fulfill your cake
                  order and provide excellent service:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong className="text-brand-espresso">Name</strong> — to
                    identify you and personalize your experience
                  </li>
                  <li>
                    <strong className="text-brand-espresso">Email address</strong>{" "}
                    — for order confirmations and communication
                  </li>
                  <li>
                    <strong className="text-brand-espresso">Phone number</strong>{" "}
                    — for order coordination and delivery updates
                  </li>
                  <li>
                    <strong className="text-brand-espresso">
                      Delivery address
                    </strong>{" "}
                    — only if delivery is selected, to fulfill your order
                  </li>
                  <li>
                    <strong className="text-brand-espresso">Order details</strong>{" "}
                    — event date, number of servings, flavor preferences, design
                    description, and budget range
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Usage */}
          <section aria-labelledby="usage-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="usage-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                How We Use Your Data
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>Your personal information is used for:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong className="text-brand-espresso">
                      Order processing
                    </strong>{" "}
                    — managing your order from inquiry through delivery or pickup
                  </li>
                  <li>
                    <strong className="text-brand-espresso">Communication</strong>{" "}
                    — sending order confirmations, updates, and responding to
                    your inquiries
                  </li>
                  <li>
                    <strong className="text-brand-espresso">
                      Service improvement
                    </strong>{" "}
                    — understanding customer needs to improve our offerings
                  </li>
                </ul>
                <p>
                  We will <strong className="text-brand-espresso">never</strong>{" "}
                  sell your data to third parties.
                </p>
              </div>
            </div>
          </section>

          {/* Data Storage and Security */}
          <section aria-labelledby="storage-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="storage-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Data Storage &amp; Security
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>We take the security of your data seriously:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    All personal data is encrypted at rest using
                    industry-standard encryption
                  </li>
                  <li>
                    Data is transmitted exclusively over TLS 1.2 or higher
                  </li>
                  <li>
                    Access to customer data is restricted to authorized personnel
                    only
                  </li>
                  <li>
                    We retain order-related data for business analytics and legal
                    compliance purposes
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Deletion */}
          <section aria-labelledby="deletion-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="deletion-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Requesting Data Deletion
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  You have the right to request deletion of your personal data at
                  any time. Here&apos;s how it works:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    Submit a deletion request via our contact form, email, or any
                    messaging channel (WhatsApp, Instagram DM, or on-site chat)
                  </li>
                  <li>
                    We will acknowledge your request within{" "}
                    <strong className="text-brand-espresso">48 hours</strong>
                  </li>
                  <li>
                    Your personally identifiable information (name, email, phone,
                    delivery address) will be removed within{" "}
                    <strong className="text-brand-espresso">30 days</strong>
                  </li>
                  <li>
                    Anonymized order records may be retained for business
                    analytics
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Consent and Marketing */}
          <section aria-labelledby="consent-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="consent-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Consent &amp; Marketing Preferences
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>We respect your communication preferences:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    Marketing messages require your{" "}
                    <strong className="text-brand-espresso">
                      explicit opt-in consent
                    </strong>{" "}
                    — we will never subscribe you automatically
                  </li>
                  <li>
                    You can withdraw consent at any time through our website or
                    by messaging us on any supported channel
                  </li>
                  <li>
                    Marketing communications will stop within{" "}
                    <strong className="text-brand-espresso">24 hours</strong> of
                    consent withdrawal
                  </li>
                  <li>
                    Consent records include the timestamp and channel of your
                    opt-in for transparency
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section aria-labelledby="contact-heading">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2
                id="contact-heading"
                className="font-display text-xl text-brand-brown sm:text-2xl"
              >
                Questions About Your Privacy
              </h2>
              <div className="mt-4 space-y-3 text-brand-espresso/80">
                <p>
                  If you have any questions about this privacy policy or how your
                  data is handled, please reach out to us through our order form,
                  WhatsApp, or Instagram. We&apos;re happy to help.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-12 text-center">
          <Link
            href="/policies"
            className="text-brand-rose hover:text-brand-rose/80 transition-colors text-sm"
          >
            View our Business Policies →
          </Link>
        </div>
      </div>
    </main>
  );
}
