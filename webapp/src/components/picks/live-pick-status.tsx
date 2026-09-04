import { useEffect, useRef, useState } from 'react';

import { motion } from 'framer-motion';

import { THEME_COLORS } from '@/constants/theme';
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

/** Web port of components/picks/live-pick-status.tsx. Same exported names. */

const STATUS_COLOR: Record<LivePickStatus, string> = {
  losing: THEME_COLORS.coralRed,
  neutral: THEME_COLORS.amberAccent,
  winning: THEME_COLORS.electricGreen,
};

const STATUS_BG: Record<LivePickStatus, string> = {
  losing: 'rgba(255,71,87,0.14)',
  neutral: 'rgba(255,165,2,0.14)',
  winning: 'rgba(0,255,135,0.14)',
};

const STATUS_BORDER: Record<LivePickStatus, string> = {
  losing: 'rgba(255,71,87,0.40)',
  neutral: 'rgba(255,165,2,0.40)',
  winning: 'rgba(0,255,135,0.40)',
};

type PillSize = 'sm' | 'md';

const PILL_SIZING: Record<PillSize, { container: string; dot: number; gap: string; text: string }> = {
  md: { container: 'px-2.5 py-1', dot: 7, gap: 'gap-1.5', text: 'text-[10px]' },
  sm: { container: 'px-1.5 py-[2px]', dot: 6, gap: 'gap-1', text: 'text-[9px]' },
};

type LiveLeg = Pick<
  BetLegRow,
  'adjusted_line' | 'game_id' | 'market' | 'original_line' | 'selection'
>;

/**
 * The colour cross-fade between winning/neutral/losing is a CSS transition on
 * real colour values, so the pill is always fully legible — the transition only
 * decides how it travels between two readable states.
 */
export function LiveStatusPill({ size = 'md', status }: { size?: PillSize; status: LivePickStatus }) {
  const sizing = PILL_SIZING[size];
  const color = STATUS_COLOR[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border transition-colors duration-200 ease-arena',
        sizing.container,
        sizing.gap,
      )}
      style={{ backgroundColor: STATUS_BG[status], borderColor: STATUS_BORDER[status] }}>
      <motion.span
        animate={{ opacity: [1, 0.35, 1] }}
        aria-hidden
        className="shrink-0 rounded-full"
        initial={{ opacity: 1 }}
        style={{
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}b3`,
          height: sizing.dot,
          width: sizing.dot,
        }}
        transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
      />
      <span
        className={cn('font-black uppercase tracking-[1px] transition-colors duration-200', sizing.text)}
        style={{ color }}>
        {livePickStatusCopy[status]}
      </span>
    </span>
  );
}

function LivePulseDot() {
  return (
    <motion.span
      animate={{ opacity: [1, 0.35, 1] }}
      aria-hidden
      className="h-1.5 w-1.5 shrink-0 rounded-full"
      initial={{ opacity: 1 }}
      style={{
        backgroundColor: THEME_COLORS.coralRed,
        boxShadow: `0 0 4px ${THEME_COLORS.coralRed}99`,
      }}
      transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
    />
  );
}

function ActiveLegScoreLine({ leg, score }: { leg: LiveLeg; score: LiveGameStateRow }) {
  const status = evaluateLiveLegStatus(leg, score);
  const scoreText = formatLiveScore(score, getLiveLegFocusTeam(leg));
  const previousScoreText = useRef(scoreText);
  const [tickKey, setTickKey] = useState(0);

  useEffect(() => {
    if (previousScoreText.current !== scoreText) {
      previousScoreText.current = scoreText;
      setTickKey((current) => current + 1);
    }
  }, [scoreText]);

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <LivePulseDot />
        {/* Keyed remount replays the mobile score-tick fade. The resting
            opacity is 1, so a skipped animation just means no flicker. */}
        <motion.span
          animate={{ opacity: [0.35, 1] }}
          className="min-w-0 flex-1 text-[11px] font-semibold text-white/65"
          initial={{ opacity: 1 }}
          key={tickKey}
          transition={{ duration: 0.32, ease: 'easeOut' }}>
          {scoreText}
        </motion.span>
      </div>
      {status ? (
        <span className="self-start">
          <LiveStatusPill size="sm" status={status} />
        </span>
      ) : null}
    </div>
  );
}

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

  return <ActiveLegScoreLine leg={leg} score={score} />;
}

export function LiveBetStatusSummary({ status }: { status: LivePickStatus | null }) {
  if (!status) {
    return null;
  }

  return (
    <span className="self-start">
      <LiveStatusPill size="md" status={status} />
    </span>
  );
}
