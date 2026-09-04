// Hero.tsx — top-of-page fold: nav + state-reactive background + ghost
// text + headline/CTAs + the pick-type carousel.
//
// The <Carousel> owns the active-state machine and reports changes up via
// onActiveChange; Hero mirrors that into `active` so the radial background
// tint, ghost word, and eyebrow accent all transition on the same 650ms beat.
//
// Layout: mobile stacks header → carousel → actions (the carousel is the
// hero visual, so it sits right under the headline). Desktop is a 2-column
// grid — copy stack left, carousel right. The left wrapper uses
// display:contents on mobile so header/carousel/actions reorder as siblings.
import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'framer-motion';
import { ARENA_TRANSITION, PROD_INTENSITY } from '../lib/animations';
import { Carousel } from './ui/Carousel';
import { STATE_META, type StateKey } from './ui/PickCard';
import { ArenaLogo } from './ui/ArenaLogo';

// Pre-launch placeholder — swap for the real App Store listing when live.
const APP_STORE_URL = 'https://apps.apple.com/app/id000000000';

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: 'Leagues', href: APP_STORE_URL },
  { label: 'How it works', href: '#how-it-runs' },
  { label: 'Locker', href: APP_STORE_URL },
  { label: 'Compliance', href: '#compliance' },
];

const KEY_STATS: Array<{ v: string; l: string }> = [
  { v: '$100', l: 'weekly virtual budget' },
  { v: '18', l: 'weeks of competition' },
  { v: '1.5×', l: 'Lock of the Week boost' },
];

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden focusable="false">
      <path d="M17.05 12.04c-.03-3.1 2.53-4.59 2.65-4.67-1.45-2.12-3.71-2.41-4.5-2.44-1.91-.2-3.74 1.13-4.71 1.13-.99 0-2.48-1.11-4.08-1.08-2.1.03-4.04 1.22-5.12 3.09-2.19 3.79-.56 9.38 1.57 12.45 1.04 1.5 2.27 3.18 3.87 3.12 1.56-.06 2.15-1 4.03-1 1.88 0 2.41 1 4.06.97 1.68-.03 2.74-1.52 3.76-3.03 1.19-1.74 1.67-3.43 1.7-3.51-.04-.02-3.26-1.25-3.29-4.97zM14.04 3.36C14.91 2.32 15.49.86 15.33-.6c-1.27.05-2.81.84-3.71 1.88-.81.92-1.52 2.4-1.33 3.84 1.41.11 2.85-.72 3.75-1.76z" />
    </svg>
  );
}

function AppStoreLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex justify-center ${className ?? ''}`}
    >
      {children}
    </a>
  );
}

function Nav() {
  return (
    <nav aria-label="Primary" className="relative z-[4] flex items-center justify-between pb-6 lg:pb-10">
      <a href="#hero-h1" className="flex items-center gap-2.5">
        <ArenaLogo size={28} />
        <span className="font-display text-lg font-black tracking-[0.08em] lg:text-[22px]">ACTION ARENA</span>
      </a>

      <div className="hidden items-center gap-7 lg:flex">
        {NAV_LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            className="text-sm font-medium tracking-[0.01em] text-white/70 transition-colors hover:text-textPrimary"
          >
            {l.label}
          </a>
        ))}
        <AppStoreLink className="min-h-[44px] items-center rounded-full bg-electric-green px-[18px] font-display text-[13px] font-black tracking-[0.08em] text-arena-bg shadow-[0_6px_24px_rgba(0,255,135,0.25)]">
          GET THE APP
        </AppStoreLink>
      </div>

      <AppStoreLink className="min-h-[44px] items-center rounded-full bg-electric-green px-3.5 font-display text-[13px] font-black tracking-[0.06em] text-arena-bg lg:hidden">
        GET THE APP
      </AppStoreLink>
    </nav>
  );
}

function HeroHeader({ active, transition, className }: { active: StateKey; transition: Transition; className?: string }) {
  const meta = STATE_META[active];
  return (
    <div className={className}>
      {/* Eyebrow badge — accent follows the active state */}
      <motion.div
        className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] lg:mb-7"
        animate={{
          backgroundColor: `hsla(${meta.tint} / 0.14)`,
          borderColor: `hsla(${meta.tint} / 0.4)`,
          color: meta.accent,
        }}
        transition={transition}
        style={{ borderWidth: 1, borderStyle: 'solid' }}
      >
        <motion.span
          className="h-1.5 w-1.5 rounded-full"
          animate={{ backgroundColor: meta.accent, boxShadow: `0 0 10px ${meta.accent}` }}
          transition={transition}
        />
        NFL PICK LEAGUE · WEEKS 1–18
      </motion.div>

      <h1
        id="hero-h1"
        className="m-0 font-display text-[56px] font-black leading-[0.9] tracking-[-0.02em] lg:text-[clamp(64px,7vw,104px)] lg:leading-[0.92]"
      >
        <span className="block">Settle it</span>
        <span className="block">in the Arena.</span>
      </h1>

      <p className="mt-5 max-w-[480px] text-[15px] leading-[1.5] text-white/72 lg:mt-6 lg:text-lg lg:leading-[1.55]">
        Your league, your picks, your bragging rights, all season long.
      </p>
    </div>
  );
}

function HeroActions({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <AppStoreLink className="min-h-[44px] items-center gap-2.5 rounded-xl bg-electric-green px-7 py-4 font-display text-base font-black tracking-[0.08em] text-arena-bg shadow-[0_12px_32px_rgba(0,255,135,0.35)] lg:text-[17px]">
          <AppleIcon className="h-[18px] w-[18px]" />
          DOWNLOAD ON THE APP STORE
        </AppStoreLink>
        <a
          href="#how-it-runs"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/[0.18] px-6 py-4 font-display text-base font-black tracking-[0.08em] text-textPrimary transition-colors hover:border-white/40 lg:text-[17px]"
        >
          SEE HOW IT WORKS
        </a>
      </div>

      <div className="mt-9 flex border-t border-white/[0.08] pt-6">
        {KEY_STATS.map((it) => (
          <div key={it.l} className="flex-1">
            <div className="mb-1 font-display text-2xl font-black leading-none tracking-[0.01em] text-textPrimary lg:text-4xl">
              {it.v}
            </div>
            <div className="text-[10px] leading-[1.3] tracking-[0.04em] text-white/55 lg:text-xs">{it.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const transition: Transition = prefersReducedMotion ? { duration: 0 } : ARENA_TRANSITION;
  const [active, setActive] = useState<StateKey>('straight');
  const meta = STATE_META[active];

  const mobileTint = `radial-gradient(ellipse 80% 60% at 50% 45%, hsla(${meta.tint} / ${PROD_INTENSITY}), transparent 70%)`;
  const desktopTint = `radial-gradient(ellipse 50% 70% at 70% 50%, hsla(${meta.tint} / ${PROD_INTENSITY}), transparent 70%)`;

  return (
    <section
      aria-labelledby="hero-h1"
      className="relative min-h-[760px] overflow-hidden bg-arena-bg px-5 pb-9 pt-5 text-textPrimary lg:min-h-[880px] lg:px-14 lg:pb-14 lg:pt-6"
    >
      {/* State-tinted radial glow (responsive: two layers, one per viewport) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 lg:hidden"
        animate={{ background: mobileTint }}
        transition={transition}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        animate={{ background: desktopTint }}
        transition={transition}
      />
      {/* Stadium-light gradient at the top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[300px]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent)' }}
      />

      {/* Ghost word */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.05 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="pointer-events-none absolute inset-x-0 top-[14%] z-[1] whitespace-nowrap text-center font-display text-[clamp(60px,32vw,220px)] font-black leading-[0.85] tracking-[-0.02em] text-white lg:top-[18%] lg:text-[clamp(90px,28vw,380px)]"
        >
          {meta.ghost}
        </motion.div>
      </AnimatePresence>

      <div className="relative z-[2]">
        <Nav />
        {/* Mobile: flex column (header → carousel → actions). Desktop: 2-col grid. */}
        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-x-[60px] lg:gap-y-0">
          {/* Left stack on desktop; display:contents on mobile so its children
              become flex siblings of the carousel and reorder via `order`. */}
          <div className="contents lg:flex lg:flex-col lg:gap-9">
            <HeroHeader active={active} transition={transition} className="order-1 lg:order-none" />
            <HeroActions className="order-3 lg:order-none" />
          </div>
          <div className="order-2 lg:order-none">
            <Carousel onActiveChange={setActive} />
          </div>
        </div>
      </div>
    </section>
  );
}
