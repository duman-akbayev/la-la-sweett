# La La Sweett — Brand Book v2

## Brand Essence

**Name:** La La Sweett  
**Tagline:** Sweet Moments With Love  
**Industry:** Premium custom bakery  
**Location:** Austin, Texas  
**Positioning:** Boutique, handcrafted celebration cakes — warm luxury meets artisan craft

---

## Color System

### Primary Palette

| Token | Hex | Role |
|-------|-----|------|
| Rose Gold | `#B87A5E` | Primary brand color — CTAs, links, active states, emphasis |
| Rose Gold Light | `#D4A088` | Hover backgrounds, soft accents, progress indicators |
| Rose Gold Dark | `#96604A` | Active/pressed states, text on light backgrounds |

### Accent Palette

| Token | Hex | Role |
|-------|-----|------|
| Champagne Gold | `#C9A96E` | Luxury accent — premium CTAs, decorative highlights, badges |
| Berry | `#8B2252` | Semantic accent — alerts, sale badges, strong emphasis |
| Soft Lavender | `#E8D5F0` | Decorative only — subtle gradient accent (use sparingly) |

### Background Palette

| Token | Hex | Role |
|-------|-----|------|
| Ivory | `#FFFDF8` | Primary page background |
| Warm Cream | `#F7F0E6` | Section alternation, input backgrounds |
| Blush | `#F9EDE8` | Hero backgrounds, featured section wash |
| White | `#FFFFFF` | Cards, modals, overlays |

### Text Palette

| Token | Hex | Role |
|-------|-----|------|
| Espresso | `#3D2222` | Primary body text (contrast ratio 14:1 on ivory) |
| Warm Brown | `#5C3D2E` | Headings, emphasis text |
| Taupe | `#8C7068` | Secondary text, captions, placeholders |

### Gradients

```css
/* Hero section background */
--gradient-hero: linear-gradient(135deg, #F9EDE8 0%, #F7F0E6 50%, #FFFDF8 100%);

/* Gold shimmer for premium elements */
--gradient-gold: linear-gradient(120deg, #C9A96E 0%, #D4A088 50%, #C9A96E 100%);

/* Subtle warm glow behind featured content */
--gradient-depth: radial-gradient(ellipse at 30% 20%, rgba(201,169,110,0.08) 0%, transparent 70%);

/* Glass card background */
--gradient-glass: linear-gradient(135deg, rgba(255,253,248,0.9) 0%, rgba(247,240,230,0.7) 100%);
```

### Accessibility

| Combination | Ratio | Pass |
|-------------|-------|------|
| Espresso `#3D2222` on Ivory `#FFFDF8` | 14.2:1 | AAA |
| Warm Brown `#5C3D2E` on White `#FFFFFF` | 9.8:1 | AAA |
| Taupe `#8C7068` on White `#FFFFFF` | 4.6:1 | AA (large text) |
| Rose Gold `#B87A5E` on White `#FFFFFF` | 3.8:1 | AA Large / decorative only |
| White `#FFFFFF` on Rose Gold `#B87A5E` | 3.8:1 | AA Large (buttons OK at 16px+) |

---

## Typography

### Font Stack

| Family | Type | Role | Weights |
|--------|------|------|---------|
| Playfair Display | Serif | Display headings, page titles, hero text | 400, 500, 600, 700 |
| Parisienne | Script | Brand name, logo text, decorative accents | 400 |
| Inter | Sans-serif | Body, UI, navigation, buttons, inputs | 300, 400, 500, 600 |

### Scale

| Level | Font | Weight | Desktop | Mobile | Tracking | Line Height |
|-------|------|--------|---------|--------|----------|-------------|
| Display XL | Playfair Display | 700 | 72px | 44px | -0.02em | 1.1 |
| Display | Playfair Display | 600 | 56px | 36px | -0.02em | 1.15 |
| H1 | Playfair Display | 600 | 44px | 30px | -0.01em | 1.2 |
| H2 | Playfair Display | 500 | 32px | 24px | -0.01em | 1.25 |
| H3 | Inter | 600 | 22px | 18px | 0 | 1.35 |
| Body Large | Inter | 400 | 18px | 16px | 0.01em | 1.6 |
| Body | Inter | 400 | 16px | 15px | 0.01em | 1.6 |
| Body Small | Inter | 400 | 14px | 13px | 0.02em | 1.5 |
| Caption | Inter | 500 | 12px | 11px | 0.04em | 1.4 |
| UI Label | Inter | 500 | 14px | 13px | 0.04em | 1 |

### Tailwind Classes

```
font-display  → Playfair Display (headings, titles)
font-script   → Parisienne (brand name only)
font-sans     → Inter (everything else)
```

---

## UI Components

### Cards

**Default Card:**
- Background: `#FFFFFF`
- Border: `1px solid rgba(184,122,94,0.08)`
- Border radius: `20px`
- Padding: `32px` desktop, `24px` mobile
- Shadow: `0 4px 24px rgba(61,34,34,0.06), 0 1px 4px rgba(61,34,34,0.04)`
- Hover shadow: `0 12px 40px rgba(61,34,34,0.10), 0 4px 12px rgba(184,122,94,0.08)`
- Hover transform: `translateY(-4px)`
- Transition: `all 0.4s cubic-bezier(0.23, 1, 0.32, 1)`

**Glass Card (featured content, overlays):**
- Background: `rgba(255,253,248,0.72)`
- Backdrop filter: `blur(16px) saturate(1.5)`
- Border: `1px solid rgba(255,255,255,0.6)`
- Border radius: `20px`
- Shadow: `0 8px 32px rgba(61,34,34,0.08)`

**Product Card (cakes):**
- Image aspect: `4:5` portrait
- Image border-radius: `16px` (inset `4px` from card edge)
- Hover: image scales to `1.06`, overlay fades in with quick-view button
- Content area: category pill → title → description → price → CTA
- Price displayed in champagne gold

### Buttons

**Primary:**
```css
background: #B87A5E;
color: #FFFFFF;
border-radius: 9999px;
min-height: 48px;
padding: 14px 32px;
font-weight: 500;
font-size: 15px;
letter-spacing: 0.04em;
transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
/* Hover: */
transform: scale(1.03);
box-shadow: 0 8px 24px rgba(184,122,94,0.35);
```

**Secondary:**
```css
background: transparent;
color: #B87A5E;
border: 1.5px solid #B87A5E;
border-radius: 9999px;
/* Hover: */
background: rgba(184,122,94,0.06);
```

**Gold (Premium CTA):**
```css
background: linear-gradient(135deg, #C9A96E, #B87A5E);
color: #FFFFFF;
border-radius: 9999px;
/* Hover: shimmer animation + scale(1.03) */
```

**Ghost:**
```css
background: transparent;
color: #5C3D2E;
border-radius: 12px;
/* Hover: */
background: rgba(184,122,94,0.06);
```

### Inputs

- Background: `#FFFFFF`
- Border: `1.5px solid rgba(140,112,104,0.2)`
- Border radius: `12px`
- Min height: `48px`
- Padding: `14px 16px`
- Focus: `border-color: #B87A5E; box-shadow: 0 0 0 3px rgba(184,122,94,0.12)`
- Placeholder color: `#8C7068`

### Navigation

**Header:**
- Background: `rgba(255,253,248,0.85)`
- Backdrop filter: `blur(20px) saturate(1.2)`
- Border bottom: `1px solid rgba(184,122,94,0.06)`
- Height: `72px` desktop, `64px` mobile
- Position: `sticky top-0 z-50`

**Nav links:**
- Font: Inter 500, 14px, tracking 0.02em
- Color: `#5C3D2E` → hover: `#B87A5E`
- Active: `#B87A5E` with dot indicator below

**Footer:**
- Background: `#3D2222` (espresso)
- Accent divider: `1px solid rgba(201,169,110,0.2)` (gold hint)
- Text: `rgba(247,240,230,0.7)` (warm cream at 70%)
- Links hover: `#FFFFFF`
- Logo area: brand script in `#D4A088`

### Badges & Pills

- Background: `rgba(184,122,94,0.08)`
- Text: `#96604A`
- Border radius: `9999px`
- Padding: `4px 12px`
- Font: Inter 500, 12px, tracking 0.04em
- Variant (gold): bg `rgba(201,169,110,0.12)`, text `#C9A96E`

---

## Motion & Animation

### Principles

1. Motion should feel organic and warm — never robotic or bouncy
2. Use GPU-composited properties only (`transform`, `opacity`)
3. Respect `prefers-reduced-motion` — fall back to opacity-only fades
4. Never delay interaction feedback — buttons respond instantly
5. Content reveals should feel like gentle unveiling, not jumping

### Keyframes

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(2deg); }
}

@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: translateX(0); }
}
```

### Easing Functions

| Name | Value | Usage |
|------|-------|-------|
| Spring | `cubic-bezier(0.23, 1, 0.32, 1)` | General UI transitions, cards, buttons |
| Bounce | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful entrances, badges, tooltips |
| Smooth | `cubic-bezier(0.4, 0, 0.2, 1)` | Opacity, color transitions |

### Timing

| Context | Duration |
|---------|----------|
| Button hover/press | 200ms |
| Card hover lift | 300ms |
| Tooltip show/hide | 200ms |
| Content fade-up | 600ms |
| Image zoom | 500ms |
| Page section reveal | 600ms |
| Stagger between items | 100ms |
| Carousel slide | 400ms |

---

## Layout System

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `section-y` | 96px (64px mobile) | Vertical section padding |
| `section-x` | 24px (16px mobile) | Horizontal page padding |
| `container` | max-width 1280px | Content wrapper |
| `container-narrow` | max-width 768px | Text sections, forms |
| `grid-gap` | 24px | Standard card grid gaps |
| `grid-gap-lg` | 32px | Major layout gaps |
| `card-padding` | 32px (24px mobile) | Card internal spacing |

### Grid Patterns

**Product grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`  
**Gallery grid:** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` or masonry  
**Featured split:** `grid-cols-1 lg:grid-cols-[1.4fr_1fr]` (asymmetric)  
**Hero:** single column, centered, max-width 640px content

### Hero Structure

```
┌─────────────────────────────────────────┐
│  [gradient background + decorative orbs] │
│                                          │
│          [Brand Script: tagline]         │
│      [Display: Main Headline]            │
│      [Body: Supporting copy]             │
│                                          │
│    [Primary CTA]    [Secondary CTA]      │
│                                          │
│         [Scroll indicator]               │
└─────────────────────────────────────────┘
```

- Full viewport height (100svh desktop, auto mobile with min 80vh)
- Decorative floating circles at 5–10% opacity, animated with `float` keyframe
- Text enters with staggered `fadeUp` animation (200ms delays)

---

## Image Guidelines

### Photography Style

Based on actual La La Sweett photography:

- **Lighting:** Natural warm light, never flat studio or cool-toned
- **Backgrounds:** Granite countertop (lifestyle) or clean white (product)
- **Angle:** 3/4 view or 45° overhead — never straight-on flat
- **Depth of field:** Shallow for hero/lifestyle, sharper for catalog
- **Color temperature:** Warm (+5–10% warmth)
- **Styling:** Minimal props — let the cake be the hero

### Image Treatment in UI

| Context | Aspect Ratio | Radius | Hover | Loading |
|---------|-------------|--------|-------|---------|
| Product card | 4:5 | 16px | scale(1.06) | Shimmer skeleton |
| Gallery thumb | 1:1 | 12px | scale(1.04) + overlay | Blur-up |
| Hero background | 21:9 | 0 | none | Priority load |
| Featured showcase | 3:4 | 20px | parallax shift | Priority load |

### Image Technical Requirements

- Always use `next/image` with proper `sizes` prop
- Lazy load below-fold images, `priority` for hero/first-visible
- `object-fit: cover` on all contained images
- Skeleton: warm shimmer gradient matching blush → cream → blush

---

## Brand Voice & Personality

### Attributes

| Trait | How it manifests in design |
|-------|---------------------------|
| Warm | Ivory/cream backgrounds, gold accents, warm photography |
| Luxurious | Editorial serif typography, generous whitespace, gold shimmer |
| Feminine | Soft curves, blush accents, elegant script for brand name |
| Handcrafted | Real photography, visible texture, personal tone |
| Boutique | Limited menu emphasis, made-to-order, personal service |
| Modern | Smooth animations, mobile-first, clean UI, glassmorphism |

### Copywriting Guidelines

- Use "we" and "your" — personal, not institutional
- Short confident sentences
- Celebration-oriented vocabulary ("your moment," "crafted for," "made with love")
- Never corporate language ("solutions," "leverage," "utilize")
- Tone: luxury hotel concierge — warm, attentive, quietly confident

### Social Media Alignment

The website should feel like a natural extension of the @la_la_sweett Instagram:
- Same warm color temperature
- Same casual-luxury aesthetic
- Photography-forward (the work speaks for itself)
- Personal and approachable, never stock or generic

---

## File Assets

```
public/images/
├── logo/
│   └── Logo.svg              (brand logo)
├── cakes/
│   ├── honey-cake.svg        (menu illustration)
│   ├── honey-cake-1.svg      (menu illustration)
│   └── milk-girl-cake.svg    (menu illustration)
├── cookies/
│   └── cookies-01.svg        (menu illustration)
├── custom-cakes/
│   ├── cupcakes.jpeg          (red velvet cupcakes)
│   └── custom-cake-01 → 24   (portfolio photography)
├── Menu.jpeg                  (cake flavors menu)
├── wholesale-menu.jpeg        (wholesale pricing)
├── placeholder-cake.jpg       (fallback)
└── placeholder-cake.svg       (fallback)
```

### Recommended Image Usage

| Context | Images |
|---------|--------|
| Hero | custom-cake-02 (peony wedding), custom-cake-24 (ribbon) |
| Featured row | custom-cake-05, custom-cake-08, custom-cake-12, custom-cake-24 |
| Kids/Birthday | custom-cake-01, custom-cake-03, custom-cake-04, custom-cake-20 |
| Elegant/Wedding | custom-cake-02, custom-cake-05, custom-cake-15 |
| Chocolate | custom-cake-06, custom-cake-12 |
| Gallery showcase | All 24 photos in carousel |
| Cupcakes | cupcakes.jpeg |
| Menu section | Menu.jpeg, wholesale-menu.jpeg |
