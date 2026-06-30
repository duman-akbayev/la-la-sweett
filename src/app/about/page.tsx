import type { Metadata } from "next";
import Image from "next/image";
import { ScrollReveal } from "@/components/ScrollReveal";
import { ContactCallout } from "@/components/ContactCallout";

export const metadata: Metadata = {
  title: "About — Meet Akmaral, Our Pastry Chef",
  description:
    "Meet Akmaral — pastry chef, mom, and founder of La La Sweett. A small, woman-owned custom cake business handcrafted with love in Austin, Texas.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-hero px-6 py-section-y-mobile text-center lg:px-8 lg:py-section-y">
        <div className="mx-auto max-w-2xl">
          <ScrollReveal>
            <p className="font-script text-2xl text-brand-rose">
              Sweet moments with love
            </p>
            <h1 className="mt-2 font-display text-display font-bold text-brand-espresso sm:text-display-xl">
              About Me
            </h1>
          </ScrollReveal>
        </div>
      </section>

      {/* Intro — portrait + greeting */}
      <section className="mx-auto max-w-container px-6 py-section-y-mobile lg:px-8 lg:py-section-y">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <ScrollReveal>
            <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-card shadow-card">
              <Image
                src="/images/about/about-akmaral.jpeg"
                alt="Akmaral, founder and pastry chef of La La Sweett"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className="space-y-5 text-body-lg text-brand-taupe">
              <h2 className="font-display text-heading-1 text-brand-brown">
                Hi, I&apos;m Akmaral 👋
              </h2>
              <p>
                I&apos;m a pastry chef, a mom, and a dreamer who turned a green
                card lottery win into a new life in Austin, Texas.
              </p>
              <p>
                I moved to the U.S. from Kazakhstan in 2023 with my son and one
                big question: What am I meant to do here? The answer came
                through flour, sugar, and frosting — I discovered that making
                cakes wasn&apos;t just baking. It was art. It was connection. It
                was joy.
              </p>
              <p>
                Back home, I started taking orders and watched something
                beautiful happen — every cake I delivered brought smiles,
                celebrations, and memories people would keep forever. I knew
                then: this is my calling.
              </p>
              <p className="font-script text-2xl text-brand-rose">
                So I brought it with me to America.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* What I Do — text + supporting image */}
      <section className="bg-brand-blush/50 py-section-y-mobile lg:py-section-y">
        <div className="mx-auto max-w-container px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <ScrollReveal>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card shadow-card lg:order-2">
                <Image
                  src="/images/about/about-1.jpeg"
                  alt="A custom cake handcrafted by La La Sweett"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  loading="lazy"
                />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="lg:order-1">
                <h2 className="font-display text-heading-1 text-brand-brown">
                  What I Do
                </h2>
                <p className="mt-5 text-body-lg text-brand-taupe">
                  I create custom cakes and desserts for your moments that
                  matter — birthdays, weddings, anniversaries, or just a Tuesday
                  that deserves something sweet. Every recipe is crafted with
                  love, every design made personally by me.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Why It Matters — narrative + supporting images */}
      <section className="mx-auto max-w-container px-6 py-section-y-mobile lg:px-8 lg:py-section-y">
        <div className="mx-auto max-w-narrow text-center">
          <ScrollReveal>
            <h2 className="font-display text-heading-1 text-brand-brown">
              Why It Matters
            </h2>
            <div className="mt-6 space-y-5 text-body-lg text-brand-taupe">
              <p>
                When you order from me, you&apos;re not just getting a cake.
                You&apos;re supporting a small, woman-owned business built from
                scratch — one mixing bowl, one late night, one happy customer at
                a time.
              </p>
              <p>
                Every order helps me grow this dream a little further. Every
                smile you share over my cakes reminds me why I started.
              </p>
              <p>
                I don&apos;t have a big team or a factory. It&apos;s just me, my
                kitchen, and my heart in every creation. And honestly?
                That&apos;s what makes it special.
              </p>
            </div>
          </ScrollReveal>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {[
            { src: "/images/about/about-2.jpeg", alt: "La La Sweett dessert creation" },
            { src: "/images/about/about-3.jpeg", alt: "La La Sweett cake detail" },
          ].map((img, index) => (
            <ScrollReveal key={img.src} delay={index * 100}>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card shadow-card">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 hover:scale-[1.04]"
                  loading="lazy"
                />
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <p className="mx-auto mt-14 max-w-xl text-center font-script text-2xl text-brand-rose">
            Thank you for being here. Thank you for choosing handmade. Thank you
            for being part of my story. 💛
          </p>
        </ScrollReveal>
      </section>

      {/* Invitation to reach out */}
      <ContactCallout className="bg-brand-cream/40" />
    </>
  );
}
