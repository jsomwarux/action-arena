# Action Arena — Marketing Landing Page

The production one-pager for Action Arena: a 4-state pick-type hero carousel,
a three-step "How it runs" strip, and a compliance footer. Ported from the
Claude Design prototype (`/marketing/marketing/design_handoff_landing_page/`).

**Stack:** Vite 5 · React 18 · TypeScript (strict) · Tailwind CSS 3.4 ·
Framer Motion 11 · lucide-react. Fonts (Bebas Neue + Inter) are **self-hosted**
via `@fontsource` — no Google Fonts CDN, no third-party runtime dependencies.

## Local development

```bash
cd landing
npm install
npm run dev        # http://localhost:5173
```

## Build & preview

```bash
npm run build      # type-checks (tsc -b) then builds to dist/
npm run preview    # serve the production build locally
```

`npm run build` runs the TypeScript project build first, so a type error
fails the build.

## Generating image assets

`favicon.svg` is committed as source. The two raster assets are generated
from inline SVG (the brand gradient + a font-free "A" mark) via sharp:

```bash
npm run gen:assets   # writes public/apple-touch-icon.png + public/og-image.png
```

You only need to re-run this if you change the mark or the OG card. The
generated PNGs are committed so a clean `npm run build` works without the
generator (`sharp` is a devDependency).

## Deploying to Vercel

The app is a static Vite SPA — Vercel auto-detects the framework.

**Option A — dashboard (recommended for the first deploy):**

1. Import the repo into Vercel.
2. Set **Root Directory** to `landing` (this app lives in a subfolder of the
   Action Arena monorepo).
3. Framework preset: **Vite** (auto-detected). Build command `npm run build`,
   output directory `dist` — both are also pinned in `vercel.json`.
4. Deploy. Point the `actionarena.app` domain at the project.

**Option B — CLI:**

```bash
cd landing
npx vercel        # preview deploy
npx vercel --prod # production deploy
```

`vercel.json` pins the framework, build/output settings, and long-lived
cache headers for hashed assets, fonts, and icons.

## Before launch — placeholders to replace

| What | Where | Current value |
|---|---|---|
| **App Store link** | `src/components/Hero.tsx` → `APP_STORE_URL` | `https://apps.apple.com/app/id000000000` (placeholder) |
| **OG share image** | `public/og-image.png` | Branded placeholder — drop in the real 1200×630 card |
| **Footer utility links** | `src/components/Footer.tsx` → `LINKS` | `/privacy`, `/terms`, `/press-kit` are placeholder routes |
| **NFL team crests** | `src/components/ui/PickCard.tsx` → `TeamCrest` | Monogram placeholders (no licensed logos — per INTAKE.md) |

The canonical site URL in the OG/Twitter tags (`index.html`) and the email in
the footer (`hello@actionarena.app`) also assume `actionarena.app` — adjust if
the production domain differs.

## Structure

```
landing/
├── index.html                  # <head> meta: OG, Twitter, theme-color, icons
├── vercel.json                 # deploy config
├── scripts/generate-assets.mjs # apple-touch-icon + og-image generator
├── public/                     # favicon.svg, apple-touch-icon.png, og-image.png
└── src/
    ├── App.tsx                 # page root (Hero → HowItRuns → Footer)
    ├── index.css               # fonts + Tailwind + base + reduced-motion
    ├── components/
    │   ├── Hero.tsx            # nav, state-reactive bg, ghost text, headline, CTAs, carousel
    │   ├── HowItRuns.tsx       # "003 — HOW IT RUNS" three-step strip
    │   ├── Footer.tsx          # compliance disclosure + NFL disclaimer
    │   └── ui/
    │       ├── Carousel.tsx    # stateful carousel primitive (auto-advance, lock, a11y)
    │       ├── PickCard.tsx    # Straight / Parlay / Teaser / Lock cards + state metadata
    │       └── ArenaLogo.tsx   # the "A" mark (nav + footer)
    └── lib/
        ├── animations.ts       # Framer Motion variants + 650ms timing (HANDOFF.md)
        └── teams.ts            # NFL team palette for placeholder crests
```

## Behaviour notes

- **Carousel** auto-advances every 3.5s (`STRAIGHT → PARLAY → TEASER → LOCK`).
  The first tap on any state tab — or a peer card — hands control to the user
  and disables auto-advance for the session (animation-lock pattern, HANDOFF.md).
- **Reduced motion:** `prefers-reduced-motion: reduce` collapses every Framer
  transition to an instant cut (via `useReducedMotion`) and disables smooth
  scroll.
- **Breakpoint:** single desktop breakpoint at **1024px** (Tailwind `lg:`);
  mobile-first below.
- **Accessibility:** tablist/tab/tabpanel semantics with `←/→/Home/End`
  keyboard nav, ≥44px tap targets, visible focus rings, WCAG-AA+ contrast.
- **Compliance:** copy avoids the banned sportsbook vocabulary (bet, wager,
  odds, payout, …); the virtual-currency disclosure lives in the footer only.
```
