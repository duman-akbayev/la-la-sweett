import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Playfair_Display, Parisienne, Inter } from "next/font/google";
import { LocalBusinessJsonLd } from "@/components/LocalBusinessJsonLd";
import { ChatWidget } from "@/components/ChatWidget";
import { MobileNav } from "@/components/MobileNav";
import { FEATURES } from "@/lib/feature-flags";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
});

const parisienne = Parisienne({
  subsets: ["latin"],
  variable: "--font-parisienne",
  weight: "400",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lalasweett.com"),
  title: {
    default: "La La Sweett | Custom Cakes & Wholesale Bakery in Austin, TX",
    template: "%s | La La Sweett",
  },
  description:
    "Handcrafted custom cakes and wholesale baked goods in Austin, TX. Birthday, wedding, and celebration cakes, plus cookies and muffins for cafes and businesses — made from scratch by La La Sweett.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://lalasweett.com",
    siteName: "La La Sweett",
    title: "La La Sweett | Custom Cakes & Wholesale Bakery in Austin, TX",
    description:
      "Handcrafted custom cakes and wholesale baked goods in Austin, TX — made from scratch with love.",
  },
  twitter: {
    card: "summary_large_image",
    title: "La La Sweett | Custom Cakes & Wholesale Bakery in Austin, TX",
    description:
      "Handcrafted custom cakes and wholesale baked goods in Austin, TX — made from scratch with love.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${parisienne.variable} ${inter.variable}`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <LocalBusinessJsonLd />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-brand-ivory font-sans text-brand-espresso antialiased">
        <header className="sticky top-0 z-50 border-b border-brand-rose/[0.06] bg-brand-ivory/85 backdrop-blur-xl backdrop-saturate-[1.2]">
          <nav
            aria-label="Main navigation"
            className="mx-auto max-w-container px-6 lg:px-8"
          >
            {/* The large brand logo lives in the homepage hero (Phase 3).
                The header keeps a small wordmark that links home from any page,
                centered nav links on desktop, and a hamburger on mobile. */}
            <div className="relative flex h-16 items-center justify-between">
              {/* Brand wordmark — quick "return home" link from any page */}
              <Link
                href="/"
                aria-label="La La Sweett - Home"
                className="font-script text-xl text-brand-rose transition-colors duration-200 hover:text-brand-rose-dark sm:text-2xl"
              >
                La La Sweett
              </Link>

              {/* Desktop nav links, centered */}
              <ul
                className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
                role="list"
              >
                <li>
                  <Link
                    href="/wholesale"
                    className="rounded-input px-4 py-2 text-sm font-medium tracking-wide text-brand-brown transition-colors duration-200 hover:bg-brand-rose/[0.06] hover:text-brand-rose"
                  >
                    Wholesale
                  </Link>
                </li>
                <li>
                  <Link
                    href="/celebrations"
                    className="rounded-input px-4 py-2 text-sm font-medium tracking-wide text-brand-brown transition-colors duration-200 hover:bg-brand-rose/[0.06] hover:text-brand-rose"
                  >
                    Celebrations
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cakes"
                    className="rounded-input px-4 py-2 text-sm font-medium tracking-wide text-brand-brown transition-colors duration-200 hover:bg-brand-rose/[0.06] hover:text-brand-rose"
                  >
                    Gallery
                  </Link>
                </li>
                <li>
                  <Link
                    href="/about"
                    className="rounded-input px-4 py-2 text-sm font-medium tracking-wide text-brand-brown transition-colors duration-200 hover:bg-brand-rose/[0.06] hover:text-brand-rose"
                  >
                    About
                  </Link>
                </li>

                {/* Temporarily hidden (feature-flagged) — see lib/feature-flags.ts */}
                {FEATURES.SHOW_NAV_ORDER && (
                  <li>
                    <Link
                      href="/order"
                      className="rounded-input px-4 py-2 text-sm font-medium tracking-wide text-brand-brown transition-colors duration-200 hover:bg-brand-rose/[0.06] hover:text-brand-rose"
                    >
                      Order
                    </Link>
                  </li>
                )}
                {FEATURES.SHOW_NAV_POLICIES && (
                  <li>
                    <Link
                      href="/policies"
                      className="rounded-input px-4 py-2 text-sm font-medium tracking-wide text-brand-brown transition-colors duration-200 hover:bg-brand-rose/[0.06] hover:text-brand-rose"
                    >
                      Policies
                    </Link>
                  </li>
                )}
                {FEATURES.SHOW_NAV_ORDER_NOW && (
                  <li className="ml-3">
                    <Link href="/order" className="btn-primary !px-6 !py-2.5 !text-sm">
                      Order Now
                    </Link>
                  </li>
                )}
              </ul>

              {/* Mobile hamburger */}
              <div className="md:hidden">
                <MobileNav />
              </div>
            </div>
          </nav>
        </header>

        <main id="main-content">{children}</main>

        <footer className="bg-brand-espresso">
          <div className="mx-auto max-w-container px-6 py-16 lg:px-8">
            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3">
                  <Image
                    src="/images/logo/logo.png"
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <p className="font-script text-2xl text-brand-rose-light">
                    La La Sweett
                  </p>
                </div>
                <p className="mt-4 max-w-sm font-script text-2xl text-brand-rose-light">
                  Sweet moments with love
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <a
                    href="https://www.instagram.com/la_la_sweett"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-brand-cream/70 transition-all duration-300 hover:bg-brand-rose/20 hover:text-white"
                    aria-label="Follow us on Instagram"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  </a>
                </div>
              </div>

              <div>
                <h2 className="text-caption font-semibold uppercase tracking-widest text-brand-cream/40">
                  Quick Links
                </h2>
                <ul className="mt-4 space-y-3" role="list">
                  <li>
                    <Link
                      href="/wholesale"
                      className="text-sm text-brand-cream/60 transition-colors duration-200 hover:text-white"
                    >
                      Wholesale Bakery
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/celebrations"
                      className="text-sm text-brand-cream/60 transition-colors duration-200 hover:text-white"
                    >
                      Custom Cakes
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/cakes"
                      className="text-sm text-brand-cream/60 transition-colors duration-200 hover:text-white"
                    >
                      Gallery
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/about"
                      className="text-sm text-brand-cream/60 transition-colors duration-200 hover:text-white"
                    >
                      About
                    </Link>
                  </li>
                  {/* Temporarily hidden (feature-flagged) — see lib/feature-flags.ts */}
                  {FEATURES.SHOW_FOOTER_ORDER && (
                    <li>
                      <Link
                        href="/order"
                        className="text-sm text-brand-cream/60 transition-colors duration-200 hover:text-white"
                      >
                        Order Custom Cake
                      </Link>
                    </li>
                  )}
                  {FEATURES.SHOW_FOOTER_POLICIES && (
                    <li>
                      <Link
                        href="/policies"
                        className="text-sm text-brand-cream/60 transition-colors duration-200 hover:text-white"
                      >
                        Policies & Pricing
                      </Link>
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h2 className="text-caption font-semibold uppercase tracking-widest text-brand-cream/40">
                  Contact
                </h2>
                <address className="mt-4 space-y-3 not-italic">
                  <p className="text-sm text-brand-cream/60">Austin, TX</p>
                  <p className="text-sm text-brand-cream/60">
                    <a
                      href="sms:+12242375853"
                      className="transition-colors duration-200 hover:text-white"
                    >
                      (224) 237-5853
                    </a>
                  </p>
                  <p className="text-sm text-brand-cream/60">
                    Pickup & local delivery available
                  </p>
                </address>
              </div>
            </div>

            <div className="mt-12 border-t border-brand-gold/[0.15] pt-8 text-center">
              <p className="text-xs text-brand-cream/30">
                &copy; {new Date().getFullYear()} La La Sweett. All rights
                reserved.
              </p>
            </div>
          </div>
        </footer>

        {/* Floating chat assistant — temporarily hidden (feature-flagged).
            Restore by setting SHOW_CHAT_WIDGET = true in lib/feature-flags.ts */}
        {FEATURES.SHOW_CHAT_WIDGET && <ChatWidget />}
        <Analytics />
      </body>
    </html>
  );
}
