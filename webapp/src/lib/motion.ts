/**
 * The motion vocabulary.
 *
 * AGENTS.md asks for "spring animations on interactions, animated number
 * counters, staggered card entrances, confetti on big wins". Three rules keep
 * that from becoming noise on a screen a player leaves open all afternoon:
 *
 * 1. **Every resting state is already visible.** Entrances animate an element
 *    that would be legible with no animation at all, so a starved rAF, a
 *    background tab, or an extension that kills animations leaves a correct
 *    screen rather than a blank one.
 * 2. **Motion is interruptible.** Nothing blocks input, nothing blocks scroll,
 *    and nothing waits on an animation before showing a number. There is no
 *    scroll-jacking anywhere in this app.
 * 3. **Reduced motion is honoured.** `prefers-reduced-motion: reduce` skips
 *    entrances and confetti and lands counters on their final value
 *    immediately — see `.arena-enter` in index.css for the CSS half.
 */

/** Read at fire time, not at module load — a player can change it mid-session. */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * Durations, in ms. Deliberately short: this is a data screen, and anything a
 * player waits on twice is too slow the second time.
 */
export const MOTION_DURATION = {
  /** Hover, press, colour and border changes. Matches `duration-150` in Tailwind. */
  instant: 150,
  /** Entrances, expand/collapse. */
  quick: 260,
  /** Number counters — long enough to read as counting, short enough to trust. */
  counter: 360,
} as const;

/** The one entrance curve. `cubic-bezier(0.4, 0, 0.2, 1)` is `ease-arena`. */
export const MOTION_EASE = [0.4, 0, 0.2, 1] as const;

/** The interaction spring, for framer-motion `transition`. */
export const ARENA_SPRING = { damping: 26, stiffness: 320, type: 'spring' } as const;

/**
 * Per-item entrance delay for a list or grid.
 *
 * Capped hard, because the delay is the one window in which the row is not
 * painted: a 40-row leaderboard staggered uncapped would leave the last row
 * blank for two and a half seconds.
 */
export const STAGGER_STEP_MS = 60;
export const STAGGER_MAX_STEPS = 6;

export function staggerDelay(index: number, perItemDelay = STAGGER_STEP_MS) {
  return Math.min(index, STAGGER_MAX_STEPS) * perItemDelay;
}
