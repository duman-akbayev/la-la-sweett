// =============================================================================
// La La Sweett — Feature Flags
// -----------------------------------------------------------------------------
// Central toggles for TEMPORARY visibility changes. Nothing here deletes
// components, routes, or code — flip a flag back to `true` to fully restore the
// original behavior. Keep this file as the single source of truth for the
// "temporary removals" so they can be re-enabled in one place.
// =============================================================================

export const FEATURES = {
  /** Master toggle for the Order Inquiry form page (/order) and links to it.
   *  When false: the /order route renders a friendly "call/text us" callout
   *  instead of the form, and all nav/footer links to it are hidden. */
  SHOW_ORDER_INQUIRY: false,

  // --- Top + mobile navigation buttons (duplicates of footer links) ---
  /** Top/mobile nav "Order" link */
  SHOW_NAV_ORDER: false,
  /** Top/mobile nav "Order Now" CTA button */
  SHOW_NAV_ORDER_NOW: false,
  /** Top/mobile nav "Policies" link */
  SHOW_NAV_POLICIES: false,

  // --- Footer quick links (duplicates of top nav) ---
  /** Footer "Order Custom Cake" link */
  SHOW_FOOTER_ORDER: false,
  /** Footer "Policies & Pricing" link */
  SHOW_FOOTER_POLICIES: false,

  // --- /cakes ("Gallery") page sections ---
  /** "Categories" grid on /cakes */
  SHOW_CAKES_CATEGORIES: false,
  /** "Full Menu" section on /cakes */
  SHOW_CAKES_FULL_MENU: false,

  // --- Homepage sections ---
  /** "Our Creations / Featured Cakes" section on the homepage */
  SHOW_HOME_FEATURED: false,
  /** "Made With Love / Cake Flavors" + "Full Menu" block on the homepage */
  SHOW_HOME_FLAVORS: false,

  // --- Global widgets ---
  /** Floating "La La Sweett Assistant" chat button (bottom corner, all pages) */
  SHOW_CHAT_WIDGET: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
