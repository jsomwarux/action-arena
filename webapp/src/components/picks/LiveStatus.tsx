/**
 * Leg-level live status on a submitted card.
 *
 * Port of components/picks/live-pick-status.tsx. All of the judgement — is this
 * leg winning, what does the projected total say, how is the score phrased —
 * already lives in src/lib/live-pick-status.ts; this file is only the paint.
 */

import { motion } from 'framer-motion';

import { cn } from '@/lib/cn';
import {
  evaluateLiveLegStatus,
  formatLiveScore,
  getLiveLegFocusTeam,
  isLiveScoreActive,
  livePickStatusCopy,
  type LivePickStatus,
} from '@/lib/live-pick-status';
import type { BetLegRow, LiveGameStateRow } from '@/types/database';

type PillSize = 'sm' | 'md';

const STATUS_CLASS: Record<LivePickStatus, string> = {
  losing: 'border-coral-red/40 bg-coral-red/[0.14] text-coral-red',
  neutral: 'border-amber-accent/40 bg-amber-accent/[0.14] text-amber-accent',
  winning: 'border-electric-green/40 bg-electric-green/[0.14] text-electric-green',
};

const STATUS_DOT_CLASS: Record<LivePickStatus, string> = {
  losing: 'bg-coral-red shadow-[0_0_4px_rgba(255,71,87,0.7)]',
  neutral: 'bg-amber-accent shadow-[0_0_4px_rgba(255,165,2,0.7)]',
  winning: 'bg-electric-green shadow-[0_0_4px_rgba(0,255,135,0.7)]',
};

const PILL_SIZING: Record<PillSize, { container: string; dot: string; text: string }> = {
  md: { container: 'gap-1.5 px-2.5 py-1', dot: 'h-[7px] w-[7px]', text: 'text-[10px]' },
  sm: { container: 'gap-1 px-1.5 py-[2px]', dot: 'h-1.5 w-1.5', text: 'text-[9px]' },
};

export function LiveStatusPill({
  size = 'md',
  status,
}: {
  size?: PillSize;
  status: LivePickStatus;
}) {
  const sizing = PILL_SIZING[size];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border transition-colors duration-200',
        sizing.container,
        STATUS_CLASS[status],
      )}>
      <span aria-hidden className={cn('rounded-full', sizing.dot, STATUS_DOT_CLASS[status])} />
      <span className={cn('font-black uppercase tracking-[0.1em]', sizing.text)}>
        {livePickStatusCopy[status]}
      </span>
    </span>
  );
}

/**
 * The "this game is live" dot.
 *
 * Opacity is animated between 1 and 0.35 and starts at 1, so the dot is visible
 * whether or not the loop ever runs.
 */
function LivePulseDot() {
  return (
    <motion.span
      animate={{ opacity: [1, 0.35, 1] }}
      aria-hidden
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral-red shadow-[0_0_4px_rgba(255,71,87,0.6)]"
      initial={false}
      transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
    />
  );
}

type LiveLeg = Pick<
  BetLegRow,
  'adjusted_line' | 'game_id' | 'market' | 'original_line' | 'selection'
>;

export function LiveLegScoreLine({
  leg,
  score,
}: {
  leg: LiveLeg;
  score: LiveGameStateRow | undefined;
}) {
  if (!isLiveScoreActive(score)) {
    return null;
  }

  const status = evaluateLiveLegStatus(leg, score);
  const scoreText = formatLiveScore(score, getLiveLegFocusTeam(leg));

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <LivePulseDot />
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/65">
          {scoreText}
        </p>
      </div>
      {status ? <LiveStatusPill size="sm" status={status} /> : null}
    </div>
  );
}

export function LiveBetStatusSummary({ status }: { status: LivePickStatus | null }) {
  if (!status) {
    return null;
  }

  return <LiveStatusPill size="md" status={status} />;
}
