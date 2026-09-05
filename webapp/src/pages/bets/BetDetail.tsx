import { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Receipt } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { LockEffect } from '@/components/cosmetics';
import { BET_TYPE_META, LockPill, marketCopy } from '@/components/profile';
import { Badge, Button, Card, Notice, QueryErrorState, Skeleton, type BadgeTone } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { useShareBetToChat } from '@/hooks/use-league-chat';
import {
  getDisplayedPotentialReward,
  getOutcomeRewardTone,
  getRealizedReward,
  isSettledResult,
} from '@/lib/bet-outcome';
import { cn } from '@/lib/cn';
import {
  formatAmericanOdds,
  formatCurrency,
  formatGameTime,
  formatProfit,
  getProfitTone,
} from '@/lib/format';
import { formatBetLegLabel, formatPickLineValue, formatPickTitle } from '@/lib/pick-labels';
import { supabase } from '@/lib/supabase';
import type { BetResult, BetWithLegs } from '@/types/database';

/** Result tone for the status badge, matching the mobile screen's mapping. */
const RESULT_BADGE_TONE: Record<BetResult, BadgeTone> = {
  loss: 'red',
  pending: 'gold',
  push: 'gold',
  win: 'green',
};

function useBetDetail(betId: string | undefined) {
  return useQuery({
    enabled: Boolean(betId),
    queryFn: async (): Promise<BetWithLegs> => {
      if (!betId) {
        throw new Error('Pick is required.');
      }

      const { data, error } = await supabase
        .from('bets')
        .select('*, bet_legs(*)')
        .eq('id', betId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as BetWithLegs;
    },
    queryKey: ['bets', 'detail', betId],
  });
}

function LoadingState() {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <Skeleton height={20} width="45%" />
        <Skeleton height={90} radius={16} />
        <Skeleton height={60} radius={16} />
      </div>
    </Card>
  );
}

function MoneyTile({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
      <p className="arena-label text-white/45">{label}</p>
      <p className={cn('mt-1 truncate text-xl font-black text-white', tone)}>{value}</p>
    </div>
  );
}

/**
 * One placed pick, in full.
 *
 * Port of app/(app)/bets/[betId].tsx: the same header card wrapped in the
 * player's equipped Lock effect when the pick is their Pick of the Week, the
 * same three money tiles, and one card per leg carrying its market, price,
 * result and — for teasers — the line movement the bought points paid for.
 *
 * The profit figure is the settled `bets.profit` column verbatim, never
 * recomputed here: settlement already applied the Lock multiplier and the
 * parlay payout cap, so re-deriving it client-side could only disagree with the
 * standings.
 */
export function BetDetailPage() {
  const { betId } = useParams<{ betId: string }>();
  const { user } = useAuth();
  const betQuery = useBetDetail(betId);
  const shareBet = useShareBetToChat(user?.id);
  const cosmeticsQuery = useUserCosmetics(user?.id);

  const [shareStatus, setShareStatus] = useState<{
    text: string;
    tone: 'error' | 'success';
  } | null>(null);

  // Success is transient; a failure stays put until the next attempt.
  useEffect(() => {
    if (shareStatus?.tone !== 'success') {
      return undefined;
    }

    const timeout = window.setTimeout(() => setShareStatus(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  const bet = betQuery.data;
  const isSettled = bet ? isSettledResult(bet.result) : false;

  const handleShare = async () => {
    if (!bet) return;

    try {
      await shareBet.mutateAsync(bet);
      setShareStatus({ text: 'This pick is now in league chat.', tone: 'success' });
    } catch (error) {
      setShareStatus({
        text: error instanceof Error ? error.message : 'Could not share pick.',
        tone: 'error',
      });
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
          <span className="text-xs font-black uppercase tracking-[0.14em] text-electric-green">
            Pick Detail
          </span>
        </div>
        <h1 className="arena-heading text-5xl leading-none">
          {bet ? `Week ${String(bet.week_number)}` : 'Pick'}
        </h1>
      </header>

      {betQuery.isLoading ? <LoadingState /> : null}

      {bet ? (
        <>
          <LockEffect cosmetics={bet.is_lock ? cosmeticsQuery.data?.equippedByCategory : undefined}>
            <Card className="p-6" tone={bet.result === 'win' ? 'highlight' : 'default'}>
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge betType={bet.bet_type} />
                      {bet.is_lock ? <LockPill /> : null}
                      <Badge label={bet.result} tone={RESULT_BADGE_TONE[bet.result]} />
                      <span className="arena-tag text-white/45">
                        {formatAmericanOdds(bet.odds)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-4xl font-black uppercase leading-tight tracking-[-0.7px] text-white">
                      {formatPickTitle(bet)}
                    </h2>
                    {/* The point size now rides in the title itself, so it is
                        present on every screen a teaser appears on rather than
                        only this one. */}
                  </div>
                  <Receipt aria-hidden className="h-6 w-6 shrink-0 text-electric-green" />
                </div>

                <div className="flex flex-wrap gap-3">
                  <MoneyTile label="Played" value={formatCurrency(bet.amount)} />
                  <MoneyTile
                    label={isSettled ? 'Outcome' : 'Potential'}
                    tone={
                      isSettled ? getOutcomeRewardTone(bet.result) : 'text-electric-green'
                    }
                    // The Lock multiplies profit, so a pending Pick of the Week
                    // pays 1.5x — the badge above already claims it.
                    value={formatCurrency(
                      isSettled ? getRealizedReward(bet) : getDisplayedPotentialReward(bet),
                    )}
                  />
                  <MoneyTile
                    label="Profit"
                    tone={getProfitTone(bet.profit ?? 0)}
                    value={bet.profit === null ? '-' : formatProfit(bet.profit)}
                  />
                </div>

                {shareStatus ? (
                  <Notice tone={shareStatus.tone}>{shareStatus.text}</Notice>
                ) : null}

                <Button
                  loading={shareBet.isPending}
                  onClick={() => void handleShare()}
                  title="Share to Chat"
                  variant="secondary"
                />
              </div>
            </Card>
          </LockEffect>

          {/* One card per leg. Multi-leg picks run two-up on a desktop
              viewport; a straight bet keeps the single full-width card. */}
          <div
            className={cn(
              'grid gap-3',
              bet.bet_legs.length > 1 && 'lg:grid-cols-2',
            )}>
            {bet.bet_legs.map((leg, index) => {
              const meta = BET_TYPE_META[bet.bet_type];

              return (
                <Card key={leg.id}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                          style={{
                            backgroundColor: `${meta.accent}26`,
                            color: meta.accent,
                          }}>
                          {index + 1}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">
                          Leg {index + 1}
                        </span>
                      </span>
                      <Badge label={leg.result} tone={RESULT_BADGE_TONE[leg.result]} />
                    </div>

                    <p className="text-lg font-black text-white">
                      {formatBetLegLabel(leg, {
                        betType: bet.bet_type,
                        includeTeaserMovement: false,
                      })}
                    </p>

                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/45">
                      {marketCopy(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
                    </p>

                    {/* Teasers are the only pick type whose stored line differs
                        from the line played. Showing both is the whole point of
                        buying points. */}
                    {bet.bet_type === 'teaser' ? (
                      <p className="text-sm font-black text-cyan-accent">
                        {formatPickLineValue(leg.original_line, leg.market) || '-'} →{' '}
                        {formatPickLineValue(leg.adjusted_line, leg.market) || '-'}
                      </p>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                      <span className="min-w-0 truncate text-[11px] font-semibold text-white/45">
                        {formatGameTime(leg.game_start_time)}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 arena-tag',
                          leg.locked ? 'text-gold' : 'text-white/45',
                        )}>
                        {leg.locked ? 'Locked' : 'Open'}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      {!betQuery.isLoading && betQuery.isError ? (
        <Card>
          <QueryErrorState
            error={betQuery.error}
            fallback="This pick could not be loaded."
            onRetry={() => void betQuery.refetch()}
            retrying={betQuery.isFetching}
            title="Pick Unavailable"
          />
        </Card>
      ) : null}

      {/* A clean fetch that came back with nothing is a different answer from a
          failed one — this pick does not exist, or is not visible to you. */}
      {!betQuery.isLoading && !betQuery.isError && !bet ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle aria-hidden className="h-6 w-6 text-white/40" />
            <p className="text-center text-base font-semibold text-white/55">
              This pick is not available. It may have been removed, or it belongs to an opponent
              whose card has not revealed yet.
            </p>
          </div>
        </Card>
      ) : null}
    </section>
  );
}
