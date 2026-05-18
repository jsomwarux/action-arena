# Action Arena — Design Tokens

Tokens are defined in two parallel sources:
- `tailwind.config.js` — named colors consumed via NativeWind utility classes (`bg-electric-green`, `text-gold`, etc.).
- `constants/theme.ts` (`THEME_COLORS`) — the same palette plus a few text/border tokens, consumed via React Native inline `style={{ color: THEME_COLORS.x }}`.

Spacing, border radius, and font weights use Tailwind defaults — there is no extended scale.

There is no formal shadow token system; shadows are ad-hoc per surface (see Shadows section).

## Colors

### Brand / accent
| Token | Hex | HSL (shadcn convention) |
|---|---|---|
| `electric-green` | `#00FF87` | `152 100% 50%` |
| `coral-red` | `#FF4757` | `355 100% 64%` |
| `gold` | `#FFD700` | `51 100% 50%` |
| `amber-accent` | `#FFA502` | `39 100% 50%` |
| `cyan-accent` | `#18DCFF` | `189 100% 55%` |

### Surfaces / text
| Token | Hex | HSL |
|---|---|---|
| `arena-bg` (app background) | `#0A0E1A` | `225 45% 7%` |
| `arena-surface` (card surface) | `#111827` | `221 39% 11%` |
| `surfaceMuted` (theme constant only) | `#182235` | `219 38% 15%` |
| `textPrimary` (theme constant only) | `#F8FAFC` | `210 40% 98%` |
| `border` (theme constant only) | `rgba(255,255,255,0.12)` | — |
| `textMuted` (theme constant only) | `rgba(255,255,255,0.58)` | — |

### State / category coding
The accent palette is semantically overloaded — colors do double duty as state indicators and as content-type accents. This convention is documented in `AGENTS.md`'s Design System section and observed consistently across screens:

- **`electric-green`** — profits, wins, positive actions, active tab, "Equipped" state, primary CTA.
- **`coral-red`** — losses, negative states, destructive actions.
- **`gold`** — achievements, trophies, season standings, Lock-of-the-Week / "Best value" highlights, Arena Coin currency chrome, Season Pass exclusives.
- **`amber-accent`** — Parlay bet type (badges, borders, backgrounds, palette).
- **`cyan-accent`** — Teaser bet type (badges, borders, backgrounds, palette).

This color coding is enforced across bet board, bet slip, bet history, matchup detail, profile stats, and the cosmetics shop, so these are first-class tokens — not one-offs.

### One-offs / undocumented colors
Each of the following appears in exactly one file. These are not part of the design token system — they're either confetti palette extensions or ad-hoc text colors that should probably be promoted to tokens or removed:

| Color | Where | Likely role |
|---|---|---|
| `#48FFAB` | `components/ui/confetti.tsx` | Confetti palette — lighter green particle |
| `#A6FFD2` | `components/ui/confetti.tsx` | Confetti palette — mint particle |
| `#FFD58A` | `components/ui/confetti.tsx` | Confetti palette — light-gold particle |
| `#FF9F43` | `components/ui/confetti.tsx` | Confetti palette — warm-orange particle |
| `#CD7F32` (`bronze`) | tailwind only | `30 61% 50%` — defined but no usages found in app/components |
| `#E8A268` (`bronze-text`) | tailwind only | `27 74% 66%` — defined but no usages found |
| `#0F172A` | one inline style | Slightly different "surface" shade — likely should be `arena-surface` |
| `#D8E0EE`, `#E8EEF7` | one inline style each | Off-white text variants — likely should be `textPrimary` |

[TODO: confirm whether `bronze` / `bronze-text` are reserved for 3rd-place / podium ranking treatments that aren't yet shipped, or if they can be removed from the Tailwind config.]

## Typography

- **Display font:** *None loaded.* Headings use React Native's platform default (SF Pro on iOS, Roboto on Android) at the weights below. There is no Google Font, no custom display face.
- **Body font:** Same as display — platform default.
- **Monospace font:** `SpaceMono-Regular.ttf` is bundled in `assets/fonts/` and loaded via `useFonts` in `app/_layout.tsx`, **but no component actually applies `fontFamily: 'SpaceMono'`.** The font ships in the binary but is unused. [TODO: confirm whether SpaceMono should be removed from the bundle or wired up to a specific surface (scoreboards, odds displays, etc.).]
- **Icon fonts:** `@expo/vector-icons` — Ionicons is the primary icon set across the app; FontAwesome glyphs are loaded but rarely used.

### Weight scale (observed usage counts in `app/` + `components/`)
| Weight | Tailwind class | Usage count |
|---|---|---|
| 900 | `font-black` | 444 |
| 600 | `font-semibold` | 185 |
| 500 | `font-medium` | 38 |
| 700 | `font-bold` | 35 |
| 800 | `font-extrabold` | 31 |

`font-black` dominates by a wide margin — consistent with the AGENTS-documented "bold condensed headings (sports broadcast feel)" aesthetic. `font-thin`, `font-light`, `font-normal` are not used.

## Spacing scale

No custom spacing extension in `tailwind.config.js` — the Tailwind default 4-pixel scale is in use unmodified. Spacing is applied through NativeWind utility classes (`gap-N`, `p-N`, `px-N`, `py-N`).

Most-used spacing values across `app/` + `components/`:
| Tailwind | Pixels | Top use |
|---|---|---|
| `gap-2` | 8 | Most common gap between inline elements |
| `gap-3` | 12 | Row gaps between cards / between hero + content |
| `gap-1` / `gap-1.5` | 4 / 6 | Tight stacks (title + subtitle) |
| `gap-4` / `gap-5` | 16 / 20 | Section separation |
| `p-3` / `p-4` / `p-5` | 12 / 16 / 20 | Card interior padding (p-4 default, p-5 for featured) |
| `px-3` / `px-5` | 12 / 20 | Pill / button horizontal padding |
| `py-1` … `py-3` | 4 … 12 | Pill / button vertical padding |

## Border radius

No custom radius extension — Tailwind defaults only. Observed usage:
| Token | Pixels | Usage count | Role |
|---|---|---|---|
| `rounded-full` | 9999 | 155 | Pills, badges, chips, status indicators |
| `rounded-2xl` | 16 | 141 | Standard card surface, primary buttons |
| `rounded-xl` | 12 | 32 | Secondary tiles, smaller cards |
| `rounded-3xl` | 24 | 14 | Hero / featured surfaces (coin plates, large icons) |
| `rounded-md` / `rounded-lg` | 6 / 8 | 1 each | One-off — likely should be promoted to `rounded-xl` or down to `rounded-full` |

Effectively a 3-step radius scale: `2xl` for surfaces, `3xl` for emphasized surfaces, `full` for status chrome.

## Shadows

**No formal shadow tokens.** Shadows are written inline at each call site via React Native's `shadowColor` / `shadowOffset` / `shadowOpacity` / `shadowRadius` props. Two patterns appear repeatedly but are not abstracted into reusable tokens:

### Pattern 1 — Colored "glow" (most common)
Used on cards, buttons, pills, and cosmetic previews to project the surface's accent color outward. Always paired with the surface's own accent.
```
shadowColor: <accent>,                  // electric-green / gold / cyan-accent / etc.
shadowOffset: { width: 0, height: 0 },
shadowOpacity: 0.3 – 0.6,               // 0.45 most common
shadowRadius: 8 – 22,                   // 12-14 most common
```

### Pattern 2 — Neutral elevation
Used on modals and floating surfaces.
```
shadowColor: '#000',
shadowOffset: { width: 0, height: <varies> },
shadowOpacity: 0.25 – 0.45,
shadowRadius: 12 – 24,
```


