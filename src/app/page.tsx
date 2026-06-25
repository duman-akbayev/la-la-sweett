import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Gallery } from "@/components/Gallery";

export const metadata: Metadata = {
  title: "Custom Cakes Austin TX | La La Sweett Bakery",
  description:
    "Handcrafted custom cakes in Austin, TX. Birthday, wedding, baby shower and celebration cakes made with love by La La Sweett.",
};

const FEATURED_CAKES = [
  {
    id: "1",
    name: "Elegant Wedding Cake",
    description: "Two-tier buttercream cake adorned with fresh peonies and ranunculus.",
    price: "From $200",
    image: "/images/custom-cakes/custom-cake-02.jpeg",
    alt: "Elegant two-tier wedding cake with fresh pink peonies",
  },
  {
    id: "2",
    name: "Classic Strawberry",
    description: "Light buttercream with fresh strawberries and pearl accents.",
    price: "From $80",
    image: "/images/custom-cakes/custom-cake-05.jpeg",
    alt: "Cream cake topped with fresh strawberries and pearl decorations",
  },
  {
    id: "3",
    name: "Gold & Blueberry",
    description: "Sophisticated two-tone design with gold spheres and blueberries.",
    price: "From $120",
    image: "/images/custom-cakes/custom-cake-08.jpeg",
    alt: "Birthday cake with gold spheres and fresh blueberries",
  },
  {
    id: "4",
    name: "Vintage Ribbon Cake",
    description: "Delicate ruffled buttercream with satin ribbon bows and pearls.",
    price: "From $95",
    image: "/images/custom-cakes/custom-cake-24.jpeg",
    alt: "White vintage style cake with ribbon bows and ruffled cream",
  },
];

const GALLERY_IMAGES = Array.from({ length: 24 }, (_, i) => ({
  src: `/images/custom-cakes/custom-cake-${String(i + 1).padStart(2, "0")}.jpeg`,
  alt: `Custom cake creation ${i + 1} by La La Sweett`,
}));

const MENU_ITEMS = [
  { name: "Milk Girl Cake", price: "From $80", description: "Condensed milk layers with sour cream and cream cheese" },
  { name: "Honey Cake (Medovik)", price: "From $70", description: "Soft honey layers with whipped sour cream filling" },
  { name: "Strawberry Lemonade", price: "From $125", description: "Lemon sponge with strawberry cream and raspberry confit" },
  { name: "Triple Chocolate", price: "From $130", description: "Dark, milk, and white chocolate layers with ganache" },
  { name: "Nutcracker", price: "From $130", description: "Poppy seed sponge with hazelnut praline and caramel" },
  { name: "Crazy Oreo", price: "From $125", description: "Chocolate sponge with caramel filling and crunchy Oreos" },
];

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section
        aria-labelledby="hero-heading"
        className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center sm:min-h-[90svh] lg:px-8"
      >
        {/* Gradient background */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-hero" aria-hidden="true" />

        {/* Decorative floating orbs */}
        <div
          className="pointer-events-none absolute left-[10%] top-[15%] h-64 w-64 animate-float rounded-full bg-brand-rose/[0.04] blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-[20%] right-[10%] h-80 w-80 animate-float rounded-full bg-brand-gold/[0.05] blur-3xl [animation-delay:2s]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute left-[50%] top-[60%] h-48 w-48 animate-float rounded-full bg-brand-lavender/[0.06] blur-3xl [animation-delay:4s]"
          aria-hidden="true"
        />

        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(201,169,110,0.06) 0%, transparent 60%)" }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-2xl">
          <p className="animate-fade-up font-script text-xl text-brand-rose opacity-0 sm:text-2xl">
            Sweet Moments With Love
          </p>
          <h1
            id="hero-heading"
            className="mt-4 animate-fade-up font-display text-display font-bold text-brand-espresso opacity-0 animate-delay-200 sm:text-display-xl"
          >
            Handcrafted Cakes for Your Celebrations
          </h1>
          <p className="mt-6 animate-fade-up text-body-lg text-brand-taupe opacity-0 animate-delay-300">
            Custom cakes made from scratch in Austin, Texas. Every creation is
            uniquely designed for birthdays, weddings, baby showers, and all of
            life&apos;s sweetest moments.
          </p>
          <div className="mt-10 flex animate-fade-up flex-col items-center gap-4 opacity-0 animate-delay-400 sm:flex-row sm:justify-center">
            <Link href="/order" className="btn-gold">
              Order Your Custom Cake
            </Link>
            <Link href="/cakes" className="btn-secondary">
              Explore Our Creations
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-up opacity-0 animate-delay-500">
          <div className="flex h-8 w-5 items-start justify-center rounded-full border-2 border-brand-taupe/30 p-1">
            <div className="h-2 w-1 animate-bounce rounded-full bg-brand-taupe/50" />
          </div>
        </div>
      </section>

      {/* Featured Cakes Section */}
      <section
        aria-labelledby="featured-heading"
        className="mx-auto max-w-container px-6 py-section-y-mobile lg:px-8 lg:py-section-y"
      >
        <ScrollReveal>
          <div className="text-center">
            <p className="text-caption font-semibold uppercase tracking-widest text-brand-gold">
              Our Creations
            </p>
            <h2
              id="featured-heading"
              className="mt-2 font-display text-heading-1 text-brand-brown"
            >
              Featured Cakes
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-body text-brand-taupe">
              Each cake is a unique work of art, handcrafted with premium
              ingredients for Austin&apos;s sweetest celebrations.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_CAKES.map((cake, index) => (
            <ScrollReveal key={cake.id} delay={index * 100}>
              <article className="product-card group">
                <div className="relative aspect-portrait overflow-hidden">
                  <Image
                    src={cake.image}
                    alt={cake.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-espresso/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="absolute inset-x-0 bottom-0 translate-y-4 p-5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <Link
                      href="/order"
                      className="inline-flex w-full items-center justify-center rounded-button bg-white/90 px-4 py-2.5 text-sm font-medium text-brand-brown backdrop-blur-sm transition-colors hover:bg-white"
                    >
                      Order This Style
                    </Link>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-heading-3 font-semibold text-brand-brown">
                    {cake.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-body-sm text-brand-taupe">
                    {cake.description}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-brand-gold">
                    {cake.price}
                  </p>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Gallery Carousel Section */}
      <section
        aria-labelledby="gallery-heading"
        className="overflow-hidden bg-brand-cream/50 py-section-y-mobile lg:py-section-y"
      >
        <div className="mx-auto max-w-container px-6 lg:px-8">
          <ScrollReveal>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-caption font-semibold uppercase tracking-widest text-brand-gold">
                  Portfolio
                </p>
                <h2
                  id="gallery-heading"
                  className="mt-2 font-display text-heading-1 text-brand-brown"
                >
                  Custom Creations
                </h2>
              </div>
              <Link
                href="/cakes"
                className="hidden text-sm font-medium text-brand-rose transition-colors hover:text-brand-rose-dark sm:block"
              >
                View All →
              </Link>
            </div>
          </ScrollReveal>
        </div>
        <div className="mt-10 px-6 lg:px-8">
          <Gallery images={GALLERY_IMAGES} />
        </div>
      </section>

      {/* Menu Highlights */}
      <section
        aria-labelledby="menu-heading"
        className="mx-auto max-w-container px-6 py-section-y-mobile lg:px-8 lg:py-section-y"
      >
        <ScrollReveal>
          <div className="text-center">
            <p className="text-caption font-semibold uppercase tracking-widest text-brand-gold">
              Made With Love
            </p>
            <h2
              id="menu-heading"
              className="mt-2 font-display text-heading-1 text-brand-brown"
            >
              Cake Flavors
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-body text-brand-taupe">
              Our signature flavors — each available as a custom cake in your
              choice of size and design.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MENU_ITEMS.map((item, index) => (
            <ScrollReveal key={item.name} delay={index * 80}>
              <div className="group rounded-card border border-brand-rose/[0.06] bg-white p-6 transition-all duration-300 hover:border-brand-rose/[0.12] hover:shadow-card">
                <div className="flex items-start justify-between">
                  <h3 className="font-display text-lg text-brand-brown">
                    {item.name}
                  </h3>
                  <span className="ml-4 shrink-0 text-sm font-semibold text-brand-gold">
                    {item.price}
                  </span>
                </div>
                <p className="mt-2 text-body-sm text-brand-taupe">
                  {item.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="mt-10 flex justify-center gap-4">
            <Link href="/cakes" className="btn-secondary">
              Full Menu
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* Why Choose Us */}
      <section
        aria-labelledby="why-heading"
        className="bg-brand-blush/50 py-section-y-mobile lg:py-section-y"
      >
        <div className="mx-auto max-w-container px-6 lg:px-8">
          <ScrollReveal>
            <h2
              id="why-heading"
              className="text-center font-display text-heading-1 text-brand-brown"
            >
              Why La La Sweett?
            </h2>
          </ScrollReveal>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Made from Scratch", desc: "Every cake baked fresh with quality ingredients — never frozen, never mass-produced." },
              { title: "Custom Designs", desc: "Your vision brought to life. Every cake is uniquely crafted for your celebration." },
              { title: "Local & Personal", desc: "Small-batch bakery in Austin, TX. Direct communication with your baker." },
              { title: "Crafted with Care", desc: "Licensed commercial kitchen. Consistent quality in every bite, every time." },
            ].map((item, index) => (
              <ScrollReveal key={item.title} delay={index * 100}>
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-rose/[0.08]">
                    <div className="h-2 w-2 rounded-full bg-brand-rose" />
                  </div>
                  <h3 className="font-display text-lg text-brand-brown">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-body-sm text-brand-taupe">
                    {item.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        aria-labelledby="cta-heading"
        className="relative overflow-hidden py-section-y-mobile lg:py-section-y"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(184,122,94,0.05) 0%, transparent 70%)" }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-narrow px-6 text-center lg:px-8">
          <ScrollReveal>
            <p className="font-script text-2xl text-brand-rose">
              Let&apos;s Create Something Sweet
            </p>
            <h2
              id="cta-heading"
              className="mt-3 font-display text-heading-1 text-brand-brown"
            >
              Ready to Order Your Custom Cake?
            </h2>
            <p className="mt-4 text-body text-brand-taupe">
              Tell us about your celebration and we&apos;ll design something
              unforgettable. Minimum 1–2 weeks lead time. 50% deposit to book.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/order" className="btn-gold">
                Start Your Order
              </Link>
              <Link href="/policies" className="btn-secondary">
                View Pricing & Policies
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
