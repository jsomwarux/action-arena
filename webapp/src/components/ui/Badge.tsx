import type { LucideIcon } from 'lucide-react';

import { BET_TYPE_THEME } from '@/lib/bet-type-theme';
import { cn } from '@/lib/cn';
import type { BetType } from '@/types/database';

export type BadgeTone = 'amber' | 'cyan' | 'gold' | 'green' | 'neutral' | 'red';

export type BadgeProps = {
  betType?: BetType;
  className?: string;
  icon?: LucideIcon;
  label?: string;
  tone?: BadgeTone;
};

/**
 * Port of components/ui/badge.tsx.
 *
 * Mobile's five tones, bet-type mapping and default labels verbatim, plus the
 * two things the desktop layouts need and the phone has no use for: a `neutral`
 * tone for non-status chips and an optional leading icon.
 */
const containerByTone: Record<BadgeTone, string> = {
  amber: 'border-amber-accent/40 bg-amber-accent/15',
  cyan: 'border-cyan-accent/40 bg-cyan-accent/15',
  gold: 'border-gold/40 bg-gold/15',
  green: 'border-electric-green/40 bg-electric-green/15',
  neutral: 'border-white/12 bg-white/[0.05]',
  red: 'border-coral-red/40 bg-coral-red/15',
};

const textByTone: Record<BadgeTone, string> = {
  amber: 'text-amber-accent',
  cyan: 'text-cyan-accent',
  gold: 'text-gold',
  green: 'text-electric-green',
  neutral: 'text-white/70',
  red: 'text-coral-red',
};

// Straights are the default green scheme; parlays amber, teasers cyan. Read off
// the one bet-type table so a change to the accent reaches the badge too.
const toneByBetType: Record<BetType, BadgeTone> = {
  parlay: BET_TYPE_THEME.parlay.tone,
  straight: 'green',
  teaser: BET_TYPE_THEME.teaser.tone,
};

const defaultBetTypeLabels: Record<BetType, string> = {
  parlay: BET_TYPE_THEME.parlay.label,
  straight: BET_TYPE_THEME.straight.label,
  teaser: BET_TYPE_THEME.teaser.label,
};

export function Badge({ betType, className, icon: Icon, label, tone }: BadgeProps) {
  const resolvedTone: BadgeTone = tone ?? (betType ? toneByBetType[betType] : 'green');
  const resolvedLabel = label ?? (betType ? defaultBetTypeLabels[betType] : '');

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 self-start rounded-full border px-3 py-1',
        'text-[10px] font-black uppercase tracking-[0.15em]',
        containerByTone[resolvedTone],
        textByTone[resolvedTone],
        className,
      )}>
      {Icon ? <Icon aria-hidden className="h-3 w-3 shrink-0" /> : null}
      {resolvedLabel}
    </span>
  );
}
