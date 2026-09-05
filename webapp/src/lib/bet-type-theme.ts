import { Link2, TrendingUp, Zap, type LucideIcon } from 'lucide-react';

import { THEME_COLORS } from '@/constants/theme';
import type { BetType } from '@/types/database';

/**
 * The one bet-type colour language.
 *
 * AGENTS.md: "Parlays always carry the amber accent (badges, borders,
 * backgrounds). Teasers always carry the cyan accent. This color coding should
 * be consistent across every screen — bet board, bet slip, bet history, matchup
 * detail, profile stats."
 *
 * There were four independent implementations of that sentence, and they had
 * already drifted: a parlay card was 5% amber on the matchup screen and 8% on
 * the profile screen, a straight was `white/[0.03]` in one place and
 * `white/[0.04]` in another, two of the four exported the same name
 * (`betTypeAccent`) with different return shapes, and the same group of picks
 * was labelled "Straight Picks" in the submit dialog and "Straights" in the
 * profile breakdown. Changing the parlay accent took four edits and silently
 * missed three of them.
 *
 * One table, every token a screen needs, consumed everywhere. This lives in
 * `lib/` rather than under `components/picks/` because the profile, matchup,
 * league-chat and pick-board surfaces all read it and none of them owns it.
 */
export type BetTone = 'green' | 'amber' | 'cyan';

export type BetTypeTheme = {
  /** Solid accent, for a progress bar or a filled chip. */
  barClass: string;
  /** Card background wash. Straights stay neutral — green is the default scheme. */
  bgClass: string;
  borderClass: string;
  /** Raw hex, for inline `style` where a class cannot reach (borderColor, SVG fill). */
  hex: string;
  icon: LucideIcon;
  /** Plural, for a section heading over a group of picks. */
  groupLabel: string;
  /** Singular, for a badge on one pick. */
  label: string;
  textClass: string;
  tone: BetTone;
};

export const BET_TYPE_THEME: Record<BetType, BetTypeTheme> = {
  parlay: {
    barClass: 'bg-amber-accent',
    bgClass: 'bg-amber-accent/[0.06]',
    borderClass: 'border-amber-accent/35',
    groupLabel: 'Parlays',
    hex: THEME_COLORS.amberAccent,
    icon: Link2,
    label: 'Parlay',
    textClass: 'text-amber-accent',
    tone: 'amber',
  },
  straight: {
    barClass: 'bg-electric-green',
    bgClass: 'bg-white/[0.04]',
    borderClass: 'border-white/[0.08]',
    groupLabel: 'Straights',
    hex: THEME_COLORS.electricGreen,
    icon: Zap,
    label: 'Straight',
    textClass: 'text-electric-green',
    tone: 'green',
  },
  teaser: {
    barClass: 'bg-cyan-accent',
    bgClass: 'bg-cyan-accent/[0.06]',
    borderClass: 'border-cyan-accent/35',
    groupLabel: 'Teasers',
    hex: THEME_COLORS.cyanAccent,
    icon: TrendingUp,
    label: 'Teaser',
    textClass: 'text-cyan-accent',
    tone: 'cyan',
  },
};

export function betTypeTheme(betType: BetType) {
  return BET_TYPE_THEME[betType];
}

export function betTypeHex(betType: BetType) {
  return BET_TYPE_THEME[betType].hex;
}

export function betTypeTone(betType: BetType): BetTone {
  return BET_TYPE_THEME[betType].tone;
}
