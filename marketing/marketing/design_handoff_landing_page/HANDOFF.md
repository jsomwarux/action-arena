# Action Arena Landing — Engineer Handoff

> Porting target: Vite + React + TypeScript + Tailwind + Framer Motion.
> Source prototype: `Action Arena Landing.html` + `landing-page.jsx` + `pick-cards.jsx`.
>
> Everything below maps one-for-one from prototype CSS-in-JS to (a) the
> Tailwind classes available in the existing `tailwind.config.js` and
> (b) Framer Motion `variants` + `transition` for the carousel choreography.

---

## 1 · Design tokens — already in the codebase

All colors used in this landing already exist in `tailwind.config.js` and
`constants/theme.ts`. No new tokens needed.

| Prototype hex | Tailwind class | THEME_COLORS key | Role |
|---|---|---|---|
| `#0A0E1A` | `bg-arena-bg` | `bg` | Page background |
| `#111827` | `bg-arena-surface` | `surface` | Card surface, How-it-works section |
| `#182235` | `bg-surfaceMuted` (theme const) | `surfaceMuted` | (unused in landing) |
| `#F8FAFC` | `text-textPrimary` | `textPrimary` | Body text |
| `#00FF87` | `bg-electric-green` / `text-electric-green` | `electricGreen` | CTA, STRAIGHT state, wins, profit |
| `#FFA502` | `bg-amber-accent` / `text-amber-accent` | `amberAccent` | PARLAY state |
| `#18DCFF` | `bg-cyan-accent` / `text-cyan-accent` | `cyanAccent` | TEASER state |
| `#FFD700` | `bg-gold` / `text-gold` | `gold` | LOCK of the Week, 1.5× multiplier |
| `#FF4757` | `text-coral-red` | `coralRed` | Negative profit in standings |

### Surface / text mixins reused across screens
- Card border: `border border-white/10` (or `border-white/[0.08]` for the
  loose 0.08 alpha).
- Dashed divider inside pick cards: `border-t border-dashed border-white/10`.
- Muted text: `text-white/55` (matches `textMuted` `rgba(255,255,255,0.58)`).

---

## 2 · Typography

### Fonts
The prototype loads three display faces via Google Fonts and exposes them
through `--aa-display`:

```html
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Anton&family=Oswald:wght@500;700&display=swap" rel="stylesheet">
```

For the Vite port, register them in `tailwind.config.js`:

```js
// tailwind.config.js
theme: {
  extend: {
    fontFamily: {
      display: ['"Bebas Neue"', '"Anton"', '"Impact"', 'system-ui'],
      // optional alts kept for the Tweaks-panel A/B
      anton:   ['"Anton"', '"Impact"', 'system-ui'],
      oswald:  ['"Oswald"', '"Anton"', 'system-ui'],
      mono:    ['ui-monospace', '"SF Mono"', 'monospace'],
    }
  }
}
```

### Scale

| Use | Prototype `fontSize` | Tailwind class | Weight |
|---|---|---|---|
| Hero H1 (desktop) | `clamp(64px, 7vw, 104px)` | `text-[clamp(64px,7vw,104px)] font-black` | 900 |
| Hero H1 (mobile)  | `56px` | `text-[56px] font-black` | 900 |
| Section H2 (How it works, desktop) | `72px` | `text-[72px] font-black` | 900 |
| Section H2 (mobile) | `44px` | `text-[44px] font-black` | 900 |
| Step card H3 | `30px` | `text-[30px] font-black` | 900 |
| Hero deck (subhead) | `18px desktop / 15px mobile` | `text-lg lg:text-[18px] / text-[15px]` | 400 |
| Body | `15px` | `text-[15px]` | 400 |
| Eyebrow / pill | `11–12px` letterSpacing `.12em` uppercase | `text-xs tracking-[0.12em] uppercase font-semibold font-mono` | 600 |
| Numeric (odds-style readouts) | `font-mono` 11–13px | `font-mono` | 600 |

Display font is **always** `font-display` (Bebas Neue) on H1/H2/H3, pick-type
badges, stake amounts, team monograms, and key stats. Body copy stays in
system sans.

Tracking: H1/H2 use `tracking-[-0.02em]` (negative for tight display feel).
Pill / eyebrow text uses `tracking-[0.08em]` to `tracking-[0.16em]`.

---

## 3 · Spacing / radius

Per `TOKENS.md`, Tailwind default scale only. Notable:

| Use | Class |
|---|---|
| Card padding (interior) | `p-5` (20px) |
| Step card padding | `p-6` (24px) |
| Hero gap between text + carousel | `gap-[60px]` (desktop), stacked on mobile |
| Section padding (desktop) | `py-24 px-14` |
| Section padding (mobile) | `py-14 px-5` |
| Pick-card surface | `rounded-3xl` (24px) |
| Inner highlight surface | `rounded-xl` (12px) |
| Pills / badges | `rounded-full` |
| Buttons | `rounded-xl` (12px) |

---

## 4 · Carousel choreography — Framer Motion port

The prototype uses raw CSS transitions on `transform / opacity / filter`
because every active card is mounted at all times (no enter/exit). The
Framer Motion equivalent is `motion.div` with `animate={...}` and a
synchronized `transition`.

### Constants

```ts
// src/landing/animation.ts
export const TRANSITION_MS = 650;
export const EASING_CSS = 'cubic-bezier(0.4, 0, 0.2, 1)';

// Framer Motion equivalent
export const ARENA_TRANSITION = {
  duration: 0.65,
  ease: [0.4, 0, 0.2, 1] as const, // Material standard
};
```

### Card role variants

The carousel renders all 4 cards at once. Each card's `role` is computed
from `(stateIndex - activeIndex + 4) % 4`:

```ts
type Role = 'center' | 'right' | 'left' | 'hidden';

const role = (i: number, active: number): Role => {
  const off = ((i - active) % 4 + 4) % 4;
  if (off === 0) return 'center';
  if (off === 1) return 'right';
  if (off === 3) return 'left';
  return 'hidden';
};
```

### Framer Motion variants

```tsx
import { motion } from 'framer-motion';

const cardVariants = {
  center: { x: 0,       scale: 1,    rotateY: 0,    opacity: 1,    filter: 'blur(0px)' },
  right:  { x: '110%',  scale: 0.75, rotateY: -12,  opacity: 0.4,  filter: 'blur(2px)' },
  left:   { x: '-110%', scale: 0.75, rotateY:  12,  opacity: 0.4,  filter: 'blur(2px)' },
  hidden: { x: 0,       scale: 0.6,  rotateY: 0,    opacity: 0,    filter: 'blur(2px)' },
};

<motion.div
  initial={false}
  animate={role(i, activeIdx)}
  variants={cardVariants}
  transition={ARENA_TRANSITION}
  style={{ transformOrigin: 'center center', perspective: 800 }}
  className="absolute"
  onClick={() => role !== 'center' && setActive(i, /*fromUser*/ true)}
>
  <Card />
</motion.div>
```

### Background tint

Same transition timing, but on a separate `motion.div` with the gradient
applied via `background`:

```tsx
<motion.div
  className="absolute inset-0 pointer-events-none"
  animate={{
    background: `radial-gradient(ellipse 50% 70% at 70% 50%, hsla(${meta.tint} / ${INTENSITY[bgIntensity]}), transparent 70%)`,
  }}
  transition={ARENA_TRANSITION}
/>
```

`INTENSITY` map (1:1 with prototype):
```ts
const INTENSITY = { subtle: 0.06, bold: 0.14, extreme: 0.28 };
```

### Ghost text

Word changes per state. Use `AnimatePresence mode="wait"` with a key on the
state name so the text crossfades:

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={active}
    initial={{ opacity: 0 }}
    animate={{ opacity: 0.05 }}
    exit={{ opacity: 0 }}
    transition={ARENA_TRANSITION}
    className="absolute top-[18%] inset-x-0 text-center font-display font-black
               text-white pointer-events-none whitespace-nowrap
               text-[clamp(90px,28vw,380px)] leading-[0.85] tracking-[-0.02em]"
  >
    {meta.ghost}
  </motion.div>
</AnimatePresence>
```

---

## 5 · Animation lock

The prototype uses a `useRef(false)` flag + `setTimeout(() => { ... }, 650)`
to block rapid clicks while a transition is in flight. Port verbatim:

```ts
const isAnimating = useRef(false);

const setActive = useCallback((next: number, fromUser?: boolean) => {
  if (isAnimating.current) return;
  isAnimating.current = true;
  setTimeout(() => { isAnimating.current = false; }, TRANSITION_MS);
  if (fromUser) setUserInteracted(true);
  setActiveIdx(((next % 4) + 4) % 4);
}, []);
```

Critically: the lock duration **must equal** `TRANSITION_MS`. If the
duration drifts (e.g. someone bumps the easing curve to a slower spring),
rapid clicks will queue up visual glitches.

---

## 6 · Auto-advance + first-interaction handoff

```ts
useEffect(() => {
  if (!autoAdvance || userInteracted) return;
  const id = setInterval(() => {
    setActiveIdx(prev => (prev + 1) % 4);
  }, autoInterval); // default 3500ms
  return () => clearInterval(id);
}, [autoAdvance, autoInterval, userInteracted]);
```

`userInteracted` is set true by:
- clicking any `StateTab`
- clicking the left/right peer card

Once true, the auto-advance never re-engages for the session.

---

## 7 · Image preload pattern

The prototype doesn't ship raster images in the hero (cards are React),
but the production landing will. For state-tied imagery, preload on mount:

```ts
useEffect(() => {
  ['/img/straight.png', '/img/parlay.png', '/img/teaser.png', '/img/lock.png']
    .forEach((src) => { const i = new Image(); i.src = src; });
}, []);
```

Drop into the carousel container's mount effect.

---

## 8 · Pick-type colour mapping (cross-reference)

This is identical to the in-app convention from `AGENTS.md` — re-state it
here so marketing-side and product-side don't drift:

| Pick type | Brand colour | Tailwind | Used in |
|---|---|---|---|
| Straight | electric-green `#00FF87` | `accent-electric-green` | Default / wins |
| Parlay | amber `#FFA502` | `accent-amber-accent` | Multi-leg |
| Teaser | cyan `#18DCFF` | `accent-cyan-accent` | Point-boost |
| Lock of the Week | gold `#FFD700` | `accent-gold` | 1.5× multiplier, scarcity emphasis |
| Win celebration | electric-green `#00FF87` + gold accents | — | Post-game payoff |
| Loss | coral-red `#FF4757` | `text-coral-red` | Standings dip |

---

## 9 · Compliance copy lock-ins

Per `INTAKE.md`. Do not loosen during the port — these affect App Store
review (Apple Guideline 5.3).

**Always use:** picks, parlay, teaser, lineup, lock, virtual coins,
profit (in coins), prediction, fantasy.

**Never use anywhere in marketing copy:** bet, betting, wager, sportsbook,
odds, payout, cash out, win money.

**No-money disclosure placement (decided 2026-05):** small, single
footer paragraph. Not a hero feature. The hero leads on competition,
weekly budgeting, and bragging rights — not "no real money."

---

## 10 · Component file layout for the port

Suggested structure when porting into the Vite repo:

```
src/landing/
├── LandingPage.tsx            # = landing-page.jsx LandingPage()
├── Hero.tsx
├── CarouselStage.tsx
├── StateTabs.tsx
├── GhostText.tsx
├── HowItWorks.tsx
├── StepCard.tsx
├── visuals/
│   ├── LeagueVisual.tsx
│   ├── LineupVisual.tsx
│   └── CelebrationVisual.tsx
├── pick-cards/
│   ├── StraightCard.tsx
│   ├── ParlayCard.tsx
│   ├── TeaserCard.tsx
│   ├── LockCard.tsx
│   ├── shared.tsx             # CardShell, LegRow, CoinChip, FooterRow, TeamCrest, PickTypeBadge
│   └── teams.ts               # TEAMS export
├── Footer.tsx
└── animation.ts               # TRANSITION_MS, EASING, variants, INTENSITY
```

---

## 11 · State shape (Zustand recommended)

The prototype runs everything through a single Tweaks object so the design
canvas can drive both artboards from one panel. In production, split:

```ts
// src/landing/store.ts — replaces the prototype's tweaks object
type CarouselState = {
  activeIdx: 0 | 1 | 2 | 3;
  userInteracted: boolean;
  autoAdvance: boolean;            // production: true
  autoInterval: number;            // production: 3500
};
```

The other tweak knobs (font, intensity, ghost text, headline, reduced
motion) are **prototype-only**. Pick the locked production values from
the prototype settings when shipping; don't ship the Tweaks panel.

---

## 12 · Reduced-motion contract

`prefers-reduced-motion: reduce` should map to:

```ts
const prefersReducedMotion = useReducedMotion(); // framer-motion hook
const transitionMs = prefersReducedMotion ? 0 : 650;
```

Setting `transition.duration = 0` collapses all transforms / opacity
fades to instant state changes. The carousel still cycles via auto-
advance, but cuts rather than slides.

---

## 13 · Production checklist (from prototype → ship)

- [ ] Replace placeholder `TeamCrest` (monogram circle) with licensed NFL
      logos if license is acquired — otherwise keep the placeholder per
      `INTAKE.md`'s pending TODO on NFL trademarks.
- [ ] Replace prototype Tweaks panel with locked production values.
- [ ] Add real App Store deep links to CTA buttons.
- [ ] Add `<meta>` tags for OG image, Twitter card, App Store smart banner.
- [ ] Move `pick-cards/teams.ts` into shared `constants/teams.ts` if the
      same crest component is reused on App Store screenshots / social.
- [ ] Verify reduced-motion in Safari + Chrome before launch.
- [ ] QA: rapid-click the carousel — confirm animation lock holds.
