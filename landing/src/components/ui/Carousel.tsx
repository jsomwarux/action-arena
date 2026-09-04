// Carousel.tsx — the stateful hero carousel primitive.
//
// Owns the full state machine (HANDOFF §4–§6):
//   • 4 cards mounted at once, positioned by Framer Motion role variants
//   • auto-advances every 3.5s until the first user interaction, then
//     hands control to the user permanently for the session
//   • 650ms animation lock blocks rapid clicks mid-transition
//   • prefers-reduced-motion collapses every transition to an instant cut
//
// Emits the active state up to <Hero> (via onActiveChange) so the page
// background tint and ghost text can choreograph on the same beat.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion, type Transition } from 'framer-motion';
import {
  ARENA_TRANSITION,
  AUTO_INTERVAL_MS,
  TRANSITION_MS,
  cardVariants,
  roleFor,
} from '../../lib/animations';
import { PickCard, STATES, STATE_META, type StateKey } from './PickCard';

export interface CarouselProps {
  /** Notified whenever the active state changes (mount + every advance). */
  onActiveChange?: (state: StateKey, index: number) => void;
}

export function Carousel({ onActiveChange }: CarouselProps) {
  const prefersReducedMotion = useReducedMotion();
  const transition: Transition = prefersReducedMotion ? { duration: 0 } : ARENA_TRANSITION;

  const [activeIdx, setActiveIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const isAnimating = useRef(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Single source of truth for "active changed" → keep Hero's tint/ghost in sync.
  useEffect(() => {
    onActiveChange?.(STATES[activeIdx], activeIdx);
  }, [activeIdx, onActiveChange]);

  // Guarded setter. Lock duration MUST equal TRANSITION_MS (HANDOFF §5).
  const setActive = useCallback((next: number, fromUser?: boolean) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setTimeout(() => {
      isAnimating.current = false;
    }, TRANSITION_MS);
    if (fromUser) setUserInteracted(true);
    setActiveIdx(((next % 4) + 4) % 4);
  }, []);

  // Auto-advance until first interaction (HANDOFF §6). Not lock-guarded, by design.
  useEffect(() => {
    if (userInteracted) return undefined;
    const id = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % 4);
    }, AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [userInteracted]);

  const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = activeIdx + 1;
    else if (e.key === 'ArrowLeft') next = activeIdx - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = STATES.length - 1;
    if (next === null) return;
    e.preventDefault();
    const idx = ((next % 4) + 4) % 4;
    setActive(idx, true);
    tabRefs.current[idx]?.focus();
  };

  return (
    <div>
      {/* Stage — all 4 cards mounted, positioned via motion variants */}
      <div
        className="relative flex h-[540px] origin-center scale-[0.82] items-center justify-center sm:scale-90 lg:scale-100"
        style={{ perspective: 800 }}
      >
        {STATES.map((s, i) => {
          const role = roleFor(i, activeIdx);
          const isCenter = role === 'center';
          const isHidden = role === 'hidden';
          return (
            <motion.div
              key={s}
              className="absolute"
              initial={false}
              animate={role}
              variants={cardVariants}
              transition={transition}
              style={{
                transformOrigin: 'center center',
                zIndex: isCenter ? 3 : 1,
                pointerEvents: isHidden ? 'none' : 'auto',
                cursor: !isCenter && !isHidden ? 'pointer' : 'default',
              }}
              onClick={() => !isCenter && !isHidden && setActive(i, true)}
              role="tabpanel"
              id={`pick-card-${s}`}
              aria-labelledby={`pick-tab-${s}`}
              aria-hidden={!isCenter}
            >
              <PickCard state={s} />
            </motion.div>
          );
        })}
      </div>

      {/* State tabs */}
      <div
        role="tablist"
        aria-label="Pick types"
        onKeyDown={onTabsKeyDown}
        className="mx-auto mt-6 flex w-fit gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5"
      >
        {STATES.map((s, i) => {
          const on = i === activeIdx;
          const meta = STATE_META[s];
          return (
            <button
              key={s}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`pick-tab-${s}`}
              aria-selected={on}
              aria-controls={`pick-card-${s}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i, true)}
              className="flex min-h-[44px] items-center rounded-full px-4 font-display text-[13px] font-black leading-none tracking-[0.08em] transition-colors duration-300 ease-arena"
              style={{
                background: on ? meta.accent : 'transparent',
                color: on ? '#0A0E1A' : 'rgba(255,255,255,0.65)',
              }}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Tagline */}
      <p className="mt-3.5 text-center text-xs tracking-[0.04em] text-white/45">
        Four pick types · One weekly budget · One Lock per week
      </p>
    </div>
  );
}
