// Framer Motion variants + timing, ported 1:1 from HANDOFF.md §4–§6.
// The carousel, background tint, ghost text, and state tabs all share
// ARENA_TRANSITION so they choreograph together over a single 650ms beat.
import type { Transition, Variants } from 'framer-motion';

/** Master transition duration. The animation lock MUST equal this (HANDOFF §5). */
export const TRANSITION_MS = 650;

/** Raw CSS easing (kept for any non-Framer surface). */
export const EASING_CSS = 'cubic-bezier(0.4, 0, 0.2, 1)';

/** Material-standard easing as a cubic-bezier tuple. */
export const ARENA_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

/** Framer Motion transition used across every animated landing surface. */
export const ARENA_TRANSITION: Transition = {
  duration: 0.65,
  ease: ARENA_EASE,
};

/** Auto-advance cadence — locked production value (HANDOFF §6). */
export const AUTO_INTERVAL_MS = 3500;

/** Background radial-tint intensity. Production ships `bold` (0.14). */
export const INTENSITY = { subtle: 0.06, bold: 0.14, extreme: 0.28 } as const;
export const PROD_INTENSITY = INTENSITY.bold;

export type CardRole = 'center' | 'right' | 'left' | 'hidden';

/**
 * Compute a card's stage role from its index relative to the active index.
 * off 0 → center, 1 → right (next), 3 → left (prev), 2 → hidden (far).
 */
export function roleFor(i: number, active: number): CardRole {
  const off = (((i - active) % 4) + 4) % 4;
  if (off === 0) return 'center';
  if (off === 1) return 'right';
  if (off === 3) return 'left';
  return 'hidden';
}

/** Carousel card position variants (HANDOFF §4). */
export const cardVariants: Variants = {
  center: { x: '0%', scale: 1, rotateY: 0, opacity: 1, filter: 'blur(0px)' },
  right: { x: '110%', scale: 0.75, rotateY: -12, opacity: 0.4, filter: 'blur(2px)' },
  left: { x: '-110%', scale: 0.75, rotateY: 12, opacity: 0.4, filter: 'blur(2px)' },
  hidden: { x: '0%', scale: 0.6, rotateY: 0, opacity: 0, filter: 'blur(2px)' },
};
