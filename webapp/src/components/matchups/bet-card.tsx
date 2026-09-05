import { Check, ChevronRight, Lock, MinusCircle, Receipt, Star, X } from 'lucide-react';

import { LockEffect } from '@/components/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import {
  getDisplayedPotentialReward,
  getOutcomeRewardTone,
  getRealizedReward,
  isSettledResult,
} from '@/lib/bet-outcome';
import { betTypeTheme } from '@/lib/bet-type-theme';
import { cn } from '@/lib/cn';
import { formatAmericanOdds, formatCurrency, formatProfit, getProfitTone } from '@/lib/format';
import { evaluateLiveBetStatus } from '@/lib/live-pick-status';
import type { BetWithLegs, MatchupPickVisibility } from '@/hooks/use-matchups';
import { formatBetLegLabel, getPickLogoLabel } from '@/lib/pick-labels';
import { isParentPickLocked } from '@/lib/pick-locking';
import type {
  BetResult,
  BetType,
  EquippedCosmeticsByCategory,
  LiveGameStateRow,
} from '@/types/database';

import { LiveBetStatusSummary, LiveLegScoreLine } from '@/components/picks/live-pick-status';
import { Badge, LivePulse, NflTeamLogo } from '@/components/ui';

export const resultLabel: Record<BetResult, string> = {
  loss: 'Loss',
  pending: 'Pending',
  push: 'Push',
  win: 'Win',
};

export function resultTone(result: BetResult, inProgress = false) {
  if (inProgress) {
    return { bg: 'bg-gold/15', border: 'border-gold/40', text: 'text-gold' };
  }
  if (result === 'win') {
    return {
      bg: 'bg-electric-green/15',
      border: 'border-electric-green/40',
      text: 'text-electric-green',
    };
  }
  if (result === 'loss') {
    return { bg: 'bg-coral-red/15', border: 'border-coral-red/40', text: 'text-coral-red' };
  }
  return { bg: 'bg-white/[0.05]', border: 'border-white/15', text: 'text-white/60' };
}

/**
 * Card surface for a bet type, from the one shared table. It used to be its own
 * copy, at 5% amber where the profile screen's copy said 8%.
 */
export function betTypeAccent(betType: BetType) {
  const theme = betTypeTheme(betType);
  return { bg: theme.bgClass, border: theme.borderClass, hex: theme.hex };
}

export function isInProgress(bet: BetWithLegs) {
  if (bet.result !== 'pending') {
    return false;
  }
  return isParentPickLocked(bet);
}

export function marketCopy(market: string) {
  if (market === 'moneyline') return 'Winner';
  if (market === 'spread') return 'Spread';
  return 'Over/Under';
}

export function formatRevealTime(revealAt: string | null) {
  if (!revealAt) {
    return 'Reveals at first game kickoff';
  }

  const revealDate = new Date(revealAt);
  if (Number.isNaN(revealDate.getTime())) {
    return 'Reveals at first game kickoff';
  }

  const day = revealDate.toLocaleDateString(undefined, { weekday: 'long' });
  const time = revealDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `Reveals ${day} at ${time}`;
}

export function revealMessage(revealAt: string | null) {
  return { body: 'Cards reveal at first game kickoff', time: formatRevealTime(revealAt) };
}

export type PickVisibilityState = 'own' | 'revealed' | 'sealed' | 'did_not_submit';

/**
 * `get_matchup_detail` already answers "why can't I see this card" precisely,
 * on the `hiddenReason` discriminant. Deriving the answer from `isVisible`
 * alone cannot separate "submitted, sealed until kickoff" from "filed nothing":
 * both are invisible, so a player who never submitted was reported to their
 * opponent as holding a card that reveals at first kickoff — in a settled week,
 * a kickoff that had already passed, with `revealAt` null so the notice could
 * not even name a time.
 *
 * Only `'hidden_until_kickoff'` may produce a reveal notice. Everything else
 * that is invisible is a player who did not file, and gets the same
 * "Did not submit" treatment the viewer's own side already gets.
 */
export function getPickVisibilityState(
  visibility: MatchupPickVisibility,
  isUser: boolean,
): PickVisibilityState {
  if (isUser || visibility.hiddenReason === 'own_card') {
    return 'own';
  }

  if (visibility.hiddenReason === 'hidden_until_kickoff') {
    return 'sealed';
  }

  if (visibility.hiddenReason === 'not_submitted') {
    return 'did_not_submit';
  }

  // 'revealed', 'no_user', or an older server that sends no discriminant.
  if (!visibility.isVisible) {
    return visibility.isSubmitted ? 'sealed' : 'did_not_submit';
  }

  return visibility.isSubmitted ? 'revealed' : 'did_not_submit';
}

export function ResultPill({ bet }: { bet: BetWithLegs }) {
  const inProgress = isInProgress(bet);
  const tone = resultTone(bet.result, inProgress);
  const label = inProgress ? 'Live' : resultLabel[bet.result];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1',
        tone.bg,
        tone.border,
      )}>
      {inProgress ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
      ) : bet.result === 'win' ? (
        <Check aria-hidden className="h-3 w-3 text-electric-green" />
      ) : bet.result === 'loss' ? (
        <X aria-hidden className="h-3 w-3 text-coral-red" />
      ) : null}
      <span className={cn('arena-label', tone.text)}>
        {label}
      </span>
    </span>
  );
}

export function LockPill() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-gold/55 bg-gold/15 px-2.5 py-1"
      style={{ boxShadow: `0 0 8px ${THEME_COLORS.gold}59` }}>
      <Star aria-hidden className="h-3 w-3 text-gold" fill={THEME_COLORS.gold} />
      <span className="arena-tag text-gold">
        Pick of the Week 1.5x
      </span>
    </span>
  );
}

export function LegResultPill({ result }: { result: BetResult }) {
  const tone = resultTone(result);
  return (
    <span className={cn('shrink-0 rounded-full border px-2 py-[2px]', tone.bg, tone.border)}>
      <span className={cn('text-[9px] font-black uppercase tracking-[1px]', tone.text)}>
        {resultLabel[result]}
      </span>
    </span>
  );
}

export function EmptyBets({ side }: { side: 'You' | 'Opponent' | 'Player' }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6">
      <Receipt aria-hidden className="h-6 w-6 text-white/35" />
      <p className="text-center text-sm font-semibold text-white/45">
        {side === 'You'
          ? 'You haven’t submitted any picks yet.'
          : 'No picks placed for this matchup.'}
      </p>
    </div>
  );
}

/**
 * The sealed-card notice. Reached only from `getPickVisibilityState` returning
 * `'sealed'`, which means the opponent has submitted and the card is waiting on
 * kickoff — so this always says something true.
 */
export function HiddenPicksPlaceholder({ revealAt }: { revealAt: string | null }) {
  const message = revealMessage(revealAt);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06]">
        <Lock aria-hidden className="h-4 w-4 text-white/60" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white/55">{message.body}</p>
        <p className="mt-0.5 arena-tag text-electric-green">
          {message.time}
        </p>
      </div>
    </div>
  );
}

export function DidNotSubmitPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-3',
        compact ? 'py-6' : 'py-8',
      )}>
      <MinusCircle aria-hidden className="h-6 w-6 text-gold/55" />
      <p className="mt-2 text-center text-xs font-semibold text-white/45">Did not submit</p>
    </div>
  );
}

export function NoLockFiledPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-3 py-8">
      <Star aria-hidden className="h-6 w-6 text-gold/55" />
      <p className="mt-2 text-center text-xs font-semibold text-white/45">
        No Pick of the Week filed
      </p>
    </div>
  );
}

export function BetCard({
  bet,
  cosmetics,
  isUser,
  liveScoresByGameId = {},
  onOpen,
}: {
  bet: BetWithLegs;
  cosmetics?: EquippedCosmeticsByCategory;
  isUser: boolean;
  liveScoresByGameId?: Record<string, LiveGameStateRow | undefined>;
  onOpen?: () => void;
}) {
  const accent = betTypeAccent(bet.bet_type);
  const inProgress = isInProgress(bet);
  const isMultiLeg = bet.bet_type !== 'straight';
  const firstLeg = bet.bet_legs[0];
  const isLock = bet.is_lock;
  const liveStatus = evaluateLiveBetStatus(bet, liveScoresByGameId);
  const isSettled = isSettledResult(bet.result);
  // The Lock multiplies profit, so a pending Pick of the Week pays 1.5x. The
  // badge above says so; the number has to agree. Shared rule, one definition.
  const displayedReward = isSettled
    ? getRealizedReward(bet)
    : getDisplayedPotentialReward(bet);
  const rewardLabel = isSettled ? 'Outcome' : 'Reward';
  const rewardTone = isSettled ? getOutcomeRewardTone(bet.result) : '';

  const inner = (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-4 text-left',
        isLock ? 'border-white/15 bg-white/[0.04]' : cn(accent.border, accent.bg),
        onOpen && 'arena-card-interactive',
      )}
      style={isUser ? { boxShadow: `0 0 10px ${accent.hex}2e` } : undefined}>
      {isLock ? (
        <div className="self-start">
          <LockPill />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge betType={bet.bet_type} />
            <span className="arena-label text-white/45">
              {formatAmericanOdds(bet.odds)}
            </span>
          </div>

          {isMultiLeg ? (
            <p className="text-base font-black tracking-[-0.3px] text-white">
              {bet.bet_legs.length}-leg {bet.bet_type}
            </p>
          ) : firstLeg ? (
            <div className="flex items-center gap-2">
              {firstLeg.market !== 'over_under' ? (
                <NflTeamLogo size={28} teamName={getPickLogoLabel(firstLeg)} />
              ) : null}
              <p className="min-w-0 flex-1 text-base font-black tracking-[-0.3px] text-white">
                {formatBetLegLabel(firstLeg, { betType: bet.bet_type })}
              </p>
            </div>
          ) : (
            <p className="text-base font-black tracking-[-0.3px] text-white">
              Selection unavailable
            </p>
          )}

          <LiveBetStatusSummary status={liveStatus} />
          {!isMultiLeg && firstLeg ? (
            <LiveLegScoreLine leg={firstLeg} score={liveScoresByGameId[firstLeg.game_id]} />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ResultPill bet={bet} />
          {onOpen ? <ChevronRight aria-hidden className="h-4 w-4 text-white/35" /> : null}
        </div>
      </div>

      <div className="flex justify-between rounded-xl bg-white/[0.04] px-3 py-3">
        <div>
          <p className="arena-label text-white/40">Played</p>
          <p className="mt-1 text-sm font-black text-white">{formatCurrency(bet.amount)}</p>
        </div>
        <div className="text-center">
          <p className="arena-label text-white/40">
            {rewardLabel}
          </p>
          <p
            className={cn('mt-1 text-sm font-black text-white', rewardTone)}
            style={isSettled ? undefined : { color: accent.hex }}>
            {formatCurrency(displayedReward)}
          </p>
        </div>
        <div className="text-right">
          <p className="arena-label text-white/40">Profit</p>
          <p className={cn('mt-1 text-sm font-black', getProfitTone(bet.profit ?? 0))}>
            {bet.profit === null ? '–' : formatProfit(bet.profit)}
          </p>
        </div>
      </div>

      {isMultiLeg ? (
        <div className="ml-1 mt-1 flex gap-3">
          <div className="flex flex-col items-center pt-2">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: `${accent.hex}cc` }}
            />
            <span
              aria-hidden
              className="mt-0.5 w-[2px] flex-1 rounded-full"
              style={{ backgroundColor: `${accent.hex}55` }}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {bet.bet_legs.map((leg, index) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-3"
                key={leg.id}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {leg.market !== 'over_under' ? (
                    <NflTeamLogo size={24} teamName={getPickLogoLabel(leg)} />
                  ) : (
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-black"
                      style={{
                        backgroundColor: `${accent.hex}1a`,
                        borderColor: `${accent.hex}66`,
                        color: accent.hex,
                      }}>
                      {index + 1}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black tracking-[-0.2px] text-white">
                      {formatBetLegLabel(leg, { betType: bet.bet_type })}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase text-white/40">
                      {marketCopy(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
                    </p>
                    <LiveLegScoreLine leg={leg} score={liveScoresByGameId[leg.game_id]} />
                  </div>
                </div>
                <LegResultPill result={leg.result} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  const decorated = isLock ? <LockEffect cosmetics={cosmetics}>{inner}</LockEffect> : inner;
  const interactive = onOpen ? (
    <button className="block w-full text-left" onClick={onOpen} type="button">
      {decorated}
    </button>
  ) : (
    decorated
  );

  if (inProgress) {
    return (
      <LivePulse color={THEME_COLORS.gold} intensity={0.55}>
        {interactive}
      </LivePulse>
    );
  }

  return interactive;
}
