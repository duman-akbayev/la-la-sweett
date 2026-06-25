"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div className="md:hidden">
      <button
        onClick={toggleMenu}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
        className="flex h-12 w-12 items-center justify-center rounded-input text-brand-brown transition-colors hover:text-brand-rose"
      >
        {isOpen ? (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          id="mobile-nav-menu"
          className="absolute left-0 right-0 top-full border-b border-brand-rose/[0.06] bg-brand-ivory/95 shadow-elevated backdrop-blur-xl"
        >
          <ul className="mx-auto max-w-container space-y-1 px-6 py-5" role="list">
            <li>
              <Link
                href="/cakes"
                onClick={closeMenu}
                className="block rounded-input px-4 py-3 text-base font-medium text-brand-brown transition-colors hover:bg-brand-rose/[0.06] hover:text-brand-rose"
              >
                Our Cakes
              </Link>
            </li>
            <li>
              <Link
                href="/order"
                onClick={closeMenu}
                className="block rounded-input px-4 py-3 text-base font-medium text-brand-brown transition-colors hover:bg-brand-rose/[0.06] hover:text-brand-rose"
              >
                Order
              </Link>
            </li>
            <li>
              <Link
                href="/policies"
                onClick={closeMenu}
                className="block rounded-input px-4 py-3 text-base font-medium text-brand-brown transition-colors hover:bg-brand-rose/[0.06] hover:text-brand-rose"
              >
                Policies
              </Link>
            </li>
            <li className="pt-3">
              <Link
                href="/order"
                onClick={closeMenu}
                className="btn-gold block w-full text-center"
              >
                Order Now
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
