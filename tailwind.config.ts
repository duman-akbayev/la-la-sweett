import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          rose: "#B87A5E",
          "rose-light": "#D4A088",
          "rose-dark": "#96604A",
          gold: "#C9A96E",
          berry: "#8B2252",
          lavender: "#E8D5F0",
          ivory: "#FFFDF8",
          cream: "#F7F0E6",
          blush: "#F9EDE8",
          espresso: "#3D2222",
          brown: "#5C3D2E",
          taupe: "#8C7068",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "serif"],
        script: ["var(--font-parisienne)", "cursive"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["4.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        display: ["3.5rem", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "heading-1": ["2.75rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "heading-2": ["2rem", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "heading-3": ["1.375rem", { lineHeight: "1.35" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6", letterSpacing: "0.01em" }],
        body: ["1rem", { lineHeight: "1.6", letterSpacing: "0.01em" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5", letterSpacing: "0.02em" }],
        caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.04em" }],
      },
      borderRadius: {
        card: "20px",
        button: "9999px",
        input: "12px",
        image: "16px",
      },
      boxShadow: {
        card: "0 4px 24px rgba(61,34,34,0.06), 0 1px 4px rgba(61,34,34,0.04)",
        "card-hover":
          "0 12px 40px rgba(61,34,34,0.10), 0 4px 12px rgba(184,122,94,0.08)",
        button: "0 4px 16px rgba(184,122,94,0.25)",
        "button-hover": "0 8px 24px rgba(184,122,94,0.35)",
        glass: "0 8px 32px rgba(61,34,34,0.08)",
        elevated: "0 20px 60px rgba(61,34,34,0.12)",
      },
      backgroundImage: {
        "gradient-hero":
          "linear-gradient(135deg, #F9EDE8 0%, #F7F0E6 50%, #FFFDF8 100%)",
        "gradient-gold":
          "linear-gradient(120deg, #C9A96E 0%, #D4A088 50%, #C9A96E 100%)",
        "gradient-glass":
          "linear-gradient(135deg, rgba(255,253,248,0.9) 0%, rgba(247,240,230,0.7) 100%)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.23, 1, 0.32, 1)",
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(2deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "scale-in": "scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "slide-in-right":
          "slide-in-right 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards",
      },
      spacing: {
        "section-y": "96px",
        "section-y-mobile": "64px",
        18: "4.5rem",
        88: "22rem",
      },
      maxWidth: {
        container: "1280px",
        narrow: "768px",
      },
      aspectRatio: {
        portrait: "4/5",
        hero: "21/9",
      },
    },
  },
  plugins: [],
};

export default config;
