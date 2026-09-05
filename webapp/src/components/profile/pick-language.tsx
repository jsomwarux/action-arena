import { Check, Minus, Star, X, type LucideIcon } from 'lucide-react';

import { type Metric } from '@/components/picks/atoms';
import { THEME_COLORS } from '@/constants/theme';
import { isCappedPlacedParlay } from '@/components/picks/pick-board-model';
import { betTypeTheme } from '@/lib/bet-type-theme';
import {
  getDisplayedPotentialReward,
  getRealizedReward,
  isSettledResult,
} from '@/lib/bet-outcome';
import { formatAmericanOdds, formatCurrency, formatProfit } from '@/lib/format';
import type { BetResult, BetType, BetWithLegs } from '@/types/database';

/**
 * The shared colour language for the identity + history surfaces.
 *
 * Ported verbatim from components/profile/profile-content.tsx. AGENTS.md makes
 * this a cross-screen contract, not a per-screen choice: straights green,
 * parlays amber, teasers cyan, everywhere. Keeping the tables here means
 * /profile, /members/:memberId and /bets/:betId cannot drift from each other.
 */

export type ResultTone = {
  bar: string;
  label: string;
  pill: string;
  pillBg: string;
  pillBorder: string;
  text: string;
};

export const RESULT_TONE: Record<BetResult, ResultTone> = {
  loss: {
    bar: 'bg-coral-red/55',
    label: 'Loss',
    pill: 'text-coral-red',
    pillBg: 'bg-coral-red/15',
    pillBorder: 'border-coral-red/40',
    text: 'text-coral-red',
  },
  pending: {
    bar: 'bg-gold/55',
    label: 'Pending',
    pill: 'text-gold',
    pillBg: 'bg-gold/15',
    pillBorder: 'border-gold/40',
    text: 'text-gold',
  },
  push: {
    bar: 'bg-white/15',
    label: 'Push',
    pill: 'text-white/65',
    pillBg: 'bg-white/[0.05]',
    pillBorder: 'border-white/15',
    text: 'text-white/65',
  },
  win: {
    bar: 'bg-electric-green',
    label: 'Win',
    pill: 'text-electric-green',
    pillBg: 'bg-electric-green/15',
    pillBorder: 'border-electric-green/40',
    text: 'text-electric-green',
  },
};

export type BetTypeMeta = {
  accent: string;
  barClass: string;
  bgClass: string;
  borderClass: string;
  icon: LucideIcon;
  label: string;
  textClass: string;
};

/**
 * The profile screen's view of the one shared table. It used to be its own
 * copy, at 8% amber where the matchup screen's copy said 5%.
 */
export const BET_TYPE_META: Record<BetType, BetTypeMeta> = {
  parlay: fromTheme('parlay'),
  straight: fromTheme('straight'),
  teaser: fromTheme('teaser'),
};

function fromTheme(betType: BetType): BetTypeMeta {
  const theme = betTypeTheme(betType);
  return {
    accent: theme.hex,
    barClass: theme.barClass,
    bgClass: theme.bgClass,
    borderClass: theme.borderClass,
    icon: theme.icon,
    label: theme.groupLabel,
    textClass: theme.textClass,
  };
}

/** The `Ionicons` glyph the mobile result pill uses, as a lucide component. */
export const RESULT_ICON: Record<BetResult, LucideIcon | null> = {
  loss: X,
  pending: null,
  push: Minus,
  win: Check,
};

export function marketCopy(market: string) {
  if (market === 'moneyline') return 'Winner';
  if (market === 'spread') return 'Spread';
  return 'Over/Under';
}

/** The Pick of the Week chip. Same copy and multiplier wording as mobile. */
export function LockPill() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-gold/55 bg-gold/15 px-2.5 py-1 arena-tag text-gold"
      style={{ boxShadow: `0 0 8px ${THEME_COLORS.gold}59` }}>
      <Star aria-hidden className="h-[11px] w-[11px] shrink-0" />
      Pick of the Week 1.5x
    </span>
  );
}

/**
 * What an unsettled pick is still playing for.
 *
 * A Lock pays 1.5x on the *winnings*, not the stake, so the displayed reward
 * grows the profit half only — same arithmetic as mobile's
 * getDisplayedHistoryPayout.
 */
export function getDisplayedHistoryPayout(
  bet: Pick<BetWithLegs, 'amount' | 'is_lock' | 'potential_payout'>,
) {
  return getDisplayedPotentialReward(bet);
}

export function isCappedHistoryParlay(bet: Pick<BetWithLegs, 'amount' | 'bet_type' | 'odds'>) {
  return isCappedPlacedParlay(bet);
}

/**
 * The four money tiles under a history card: odds, stake, reward, outcome.
 *
 * A settled pick reports what it actually returned; an open one reports what it
 * is still playing for, flagged `capped` when the parlay ceiling binds.
 */
export function getHistoryFinancialMetrics(
  bet: BetWithLegs,
  rewardLabel: string,
  displayedReward: number,
): Metric[] {
  const metrics: Metric[] = [
    { label: 'Odds', value: formatAmericanOdds(bet.odds) },
    { label: 'Played', value: formatCurrency(bet.amount) },
    {
      label: rewardLabel,
      tone: !isSettledResult(bet.result) ? (bet.is_lock ? 'gold' : 'green') : undefined,
      value: `${formatCurrency(displayedReward)}${
        !isSettledResult(bet.result) && isCappedHistoryParlay(bet) ? ' capped' : ''
      }`,
    },
  ];

  if (bet.result === 'push') {
    metrics.push({ label: 'Result', value: 'Push' });
  } else {
    metrics.push({
      label: bet.result === 'loss' ? 'Loss' : 'Profit',
      tone: bet.result === 'loss' ? 'red' : bet.result === 'win' ? 'green' : undefined,
      value: bet.profit === null ? '-' : formatProfit(bet.profit),
    });
  }

  return metrics;
}

/** The reward figure and its label, for both settled and open picks. */
export function getRewardDisplay(bet: BetWithLegs) {
  const settled = isSettledResult(bet.result);

  return {
    label: settled ? 'Outcome' : 'Reward',
    value: settled ? getRealizedReward(bet) : getDisplayedHistoryPayout(bet),
  };
}
