// =============================================================================
// La La Sweett — Contact Callout
// Warm, conversation-first contact block that replaces the order-form CTA while
// the Order Inquiry page is temporarily disabled. Centered, generously spaced,
// with a click-to-call/text phone link. Reused on the homepage and on /order.
// =============================================================================

import { ScrollReveal } from "@/components/ScrollReveal";

const PHONE_DISPLAY = "224-237-5853";
const PHONE_E164 = "+12242375853";
// Use the sms: scheme so tapping the number opens the messaging app (we prefer
// texts over calls), not the phone dialer.
const PHONE_SMS = `sms:${PHONE_E164}`;

export interface ContactCalloutProps {
  /** Optional extra classes on the outer <section> (e.g. background overrides) */
  className?: string;
}

export function ContactCallout({ className = "" }: ContactCalloutProps) {
  return (
    <section
      aria-labelledby="contact-callout-heading"
      className={`relative overflow-hidden py-section-y-mobile lg:py-section-y ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(199,107,138,0.06) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-narrow px-6 text-center lg:px-8">
        <ScrollReveal>
          <h2
            id="contact-callout-heading"
            className="font-display text-heading-1 text-brand-brown"
          >
            🎂 Let&apos;s Create Something Special Together
          </h2>

          <div className="mx-auto mt-6 max-w-xl space-y-5 text-body-lg text-brand-taupe">
            <p>Every cake tells a story — and we&apos;d love to hear yours.</p>
            <p>
              Whether it&apos;s a birthday surprise, a wedding centerpiece, or a
              Tuesday treat (because you deserve it), the best creations start
              with a real conversation.
            </p>
            <p className="text-brand-espresso">
              Call or text us directly:{" "}
              <a
                href={PHONE_SMS}
                className="whitespace-nowrap font-semibold text-brand-rose underline decoration-brand-rose/30 underline-offset-4 transition-colors hover:text-brand-rose-dark"
              >
                📱 {PHONE_DISPLAY}
              </a>
            </p>
            <p>
              We&apos;ll walk you through flavors, designs, and timing — no
              forms, no waiting. Just a friendly chat to make sure your order is
              exactly what you&apos;re dreaming of.
            </p>
            <p className="font-script text-2xl text-brand-rose">
              Your perfect cake is one call away.
            </p>
          </div>

          <div className="mt-10 flex justify-center">
            <a href={PHONE_SMS} className="btn-gold">
              Text Us at {PHONE_DISPLAY}
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
