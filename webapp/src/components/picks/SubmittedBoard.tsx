/**
 * The read-only board a player sees once the week is submitted.
 *
 * Port of the mobile PlacedBetsView + PlacedBetCard. Three things change once a
 * card is in:
 *   - coin amounts are frozen; only sides can be swapped, per pick
 *   - each leg locks on its own game's kickoff, and a pick with any locked leg
 *     stops being editable at all (`update_submitted_bet` says the same)
 *   - Pick of the Week can still move until the week's first kickoff, after
 *     which `set_pick_of_week` refuses
 * Live score lines and status pills appear per leg as games go in progress.
 */

import { useMemo } from 'react';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  MessageSquare,
  Pencil,
  Receipt,
  Star,
  XCircle,
} from 'lucide-react';

import { Button, Card } from '@/components/ui';
import { LOCK_OF_THE_WEEK_MULTIPLIER } from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import type { PlacedBet } from '@/hooks/use-straight-bets';
import { getBetSettlementState } from '@/lib/bet-outcome';
import { cn } from '@/lib/cn';
import {
  formatAmericanOdds,
  formatCurrency,
  formatGameTime,
  formatProfit,
  getProfitTone,
} from '@/lib/format';
import { evaluateLiveBetStatus } from '@/lib/live-pick-status';
import { formatBetLegLabel, formatPickTitle } from '@/lib/pick-labels';
import type { LiveGameStateRow } from '@/types/database';

import {
  ARENA_SPRING,
  BetTypeBadge,
  EmptyState,
  MetricGrid,
  Pill,
  TeamLogo,
  TotalDirectionChip,
  type Metric,
} from './atoms';
import { LiveBetStatusSummary, LiveLegScoreLine } from './LiveStatus';
import {
  formatTeaserMovement,
  getDisplayedPlacedPayout,
  getSettledReward,
  isCappedPlacedParlay,
  isPlacedBetLocked,
  isPlacedLegLocked,
  isSettledPick,
  marketLabel,
} from './pick-board-model';

function SettledOutcomePill({
  result,
}: {
  result: Exclude<PlacedBet['result'], 'pending'>;
}) {
  if (result === 'win') {
    return (
      <Pill icon={CheckCircle2} tone="green">
        Win
      </Pill>
    );
  }

  if (result === 'loss') {
    return (
      <Pill icon={XCircle} tone="red">
        Loss
      </Pill>
    );
  }

  return <Pill tone="muted">Push</Pill>;
}

function PickFinancialSummary({ bet }: { bet: PlacedBet }) {
  const metrics: Metric[] = [
    { label: 'Odds', value: formatAmericanOdds(bet.odds) },
    { label: 'Played', value: formatCurrency(bet.amount) },
  ];

  if (!isSettledPick(bet.result)) {
    metrics.push({
      label: 'Reward',
      tone: bet.is_lock ? 'gold' : 'green',
      value: `${formatCurrency(getDisplayedPlacedPayout(bet))}${
        isCappedPlacedParlay(bet) ? ' capped' : ''
      }`,
    });

    if (bet.is_lock) {
      metrics.push({
        label: 'Base',
        tone: 'gold',
        value: `${formatCurrency(bet.potential_payout)} x ${LOCK_OF_THE_WEEK_MULTIPLIER}`,
      });
    }
  } else {
    metrics.push({ label: 'Outcome', value: formatCurrency(getSettledReward(bet)) });

    if (bet.result === 'push') {
      metrics.push({ label: 'Result', value: 'Push' });
    } else {
      metrics.push({
        label: bet.result === 'win' ? 'Profit' : 'Loss',
        tone: bet.result === 'win' ? 'green' : 'red',
        value: formatProfit(bet.profit ?? 0),
      });
    }
  }

  return <MetricGrid metrics={metrics} />;
}

function PotwStarButton({
  canSet,
  isActive,
  onSetPotw,
  visible,
}: {
  canSet: boolean;
  isActive: boolean;
  onSetPotw: () => void;
  visible: boolean;
}) {
  if (!visible && !isActive) {
    return null;
  }

  if (isActive || !canSet) {
    return (
      <span
        aria-label={isActive ? 'Current Pick of the Week' : 'Pick of the Week unavailable'}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
          isActive ? 'border-gold/55 bg-gold/15 text-gold' : 'border-white/10 bg-white/[0.04] text-white/30',
        )}>
        <Star aria-hidden className={cn('h-4 w-4', isActive && 'fill-current')} />
      </span>
    );
  }

  return (
    <button
      aria-label="Make Pick of the Week"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/45 bg-gold/10 text-gold transition hover:bg-gold/20"
      onClick={onSetPotw}
      type="button">
      <Star aria-hidden className="h-4 w-4" />
    </button>
  );
}

function PlacedPickCard({
  bet,
  liveScoresByGameId,
  now,
  onEdit,
  onShare,
  onSetPotw,
  potwSwapClosed,
  potwSwapPending,
  readOnly,
  shareLoading,
}: {
  bet: PlacedBet;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  now: number;
  onEdit: () => void;
  onShare: () => void;
  onSetPotw: () => void;
  potwSwapClosed: boolean;
  potwSwapPending: boolean;
  readOnly: boolean;
  shareLoading: boolean;
}) {
  const isLocked = isPlacedBetLocked(bet, now);
  const settledResult = isSettledPick(bet.result) ? bet.result : null;
  const isSettled = Boolean(settledResult);
  const isLock = bet.is_lock;
  const liveStatus = evaluateLiveBetStatus(bet, liveScoresByGameId);
  const showPotwStar = !readOnly && !potwSwapClosed && !isLocked && !isSettled;
  const canSetPotw = showPotwStar && !isLock && !potwSwapPending;

  const settledBorder =
    settledResult === 'win'
      ? 'border-electric-green/35 bg-electric-green/[0.07]'
      : settledResult === 'loss'
        ? 'border-coral-red/35 bg-coral-red/[0.07]'
        : settledResult === 'push'
          ? 'border-white/15 bg-white/[0.05]'
          : null;

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border bg-white/[0.04] backdrop-blur-xl',
        settledBorder ?? (isLock ? 'border-gold/70 bg-gold/[0.10]' : 'border-white/[0.08]'),
      )}
      style={
        isLock && !isSettled
          ? { borderWidth: 2, boxShadow: `0 8px 22px ${THEME_COLORS.gold}55` }
          : undefined
      }>
      {isLock ? (
        <p className="flex items-center justify-center gap-1.5 border-b border-gold/40 bg-gold/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-gold">
          <Star aria-hidden className="h-3 w-3 fill-current" />
          Pick of the Week · {LOCK_OF_THE_WEEK_MULTIPLIER}x profit/loss
        </p>
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PotwStarButton
                canSet={canSetPotw}
                isActive={isLock}
                onSetPotw={onSetPotw}
                visible={showPotwStar}
              />
              <BetTypeBadge betType={bet.bet_type} />
              {liveStatus ? <LiveBetStatusSummary status={liveStatus} /> : null}
            </div>
            <h3
              className={cn(
                'mt-2 font-black uppercase leading-tight tracking-[-0.01em] text-white',
                isLock ? 'text-xl' : 'text-base',
              )}>
              {formatPickTitle(bet)}
            </h3>
          </div>

          <div className="shrink-0">
            {settledResult ? (
              <SettledOutcomePill result={settledResult} />
            ) : readOnly ? (
              <Pill icon={Eye} tone="muted">
                View
              </Pill>
            ) : isLocked ? (
              <Pill icon={Lock} tone="muted">
                Locked
              </Pill>
            ) : (
              <button
                className="flex items-center gap-1.5 rounded-full border border-electric-green/45 bg-electric-green/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-electric-green transition hover:bg-electric-green/25"
                onClick={onEdit}
                type="button">
                <Pencil aria-hidden className="h-3 w-3" />
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {bet.bet_legs.map((leg) => {
            const settledLegResult = isSettledPick(leg.result) ? leg.result : null;
            const legLocked = isPlacedLegLocked(leg, now);
            const legLabel = formatBetLegLabel(leg, {
              betType: bet.bet_type,
              includeTeaserMovement: false,
            });

            return (
              <div className="rounded-2xl bg-white/[0.04] p-3" key={leg.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {leg.market === 'over_under' ? (
                      <TotalDirectionChip
                        isOver={leg.selection.toLowerCase().startsWith('over')}
                        size={22}
                      />
                    ) : (
                      <TeamLogo size={22} teamName={legLabel} />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{legLabel}</p>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-white/45">
                        {marketLabel(leg.market)} · {formatGameTime(leg.game_start_time)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {settledLegResult ? (
                      <SettledOutcomePill result={settledLegResult} />
                    ) : legLocked ? (
                      <Pill icon={Lock} tone="muted">
                        Locked
                      </Pill>
                    ) : (
                      <Pill tone="green">Open</Pill>
                    )}
                  </div>
                </div>

                {bet.bet_type === 'teaser' ? (
                  <p className="mt-2 text-[11px] font-black text-cyan-accent">
                    {formatTeaserMovement(leg)}
                  </p>
                ) : null}

                <LiveLegScoreLine leg={leg} score={liveScoresByGameId[leg.game_id]} />
              </div>
            );
          })}
        </div>

        <PickFinancialSummary bet={bet} />

        <Button
          className="min-h-11 text-xs"
          icon={MessageSquare}
          loading={shareLoading}
          onClick={onShare}
          title="Share to Chat"
          variant="secondary"
        />
      </div>
    </div>
  );
}

/**
 * The submitted card itself, in the wide pane. Pick of the Week leads.
 */
export function SubmittedPicksGrid({
  bets,
  liveScoresByGameId,
  now,
  onEdit,
  onSetPotw,
  onShare,
  potwSwapClosed,
  potwSwapPendingBetId,
  readOnly,
  sharingBetId,
  weekNumber,
}: {
  bets: PlacedBet[];
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  now: number;
  onEdit: (bet: PlacedBet) => void;
  onSetPotw: (bet: PlacedBet) => void;
  onShare: (bet: PlacedBet) => void;
  potwSwapClosed: boolean;
  potwSwapPendingBetId: string | null;
  readOnly: boolean;
  sharingBetId: string | null;
  weekNumber: number;
}) {
  const orderedBets = useMemo(() => {
    const lock = bets.find((bet) => bet.is_lock);
    const rest = bets.filter((bet) => !bet.is_lock);
    return lock ? [lock, ...rest] : bets;
  }, [bets]);

  if (bets.length === 0) {
    return (
      <Card>
        <EmptyState icon={Receipt} title="No picks this week" tone="muted">
          There is no submitted card for Week {weekNumber}.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      {orderedBets.map((bet, index) => (
        <motion.div
          animate={{ y: 0 }}
          initial={{ y: 12 }}
          key={bet.id}
          transition={{ ...ARENA_SPRING, delay: Math.min(index, 8) * 0.035 }}>
          <PlacedPickCard
            bet={bet}
            liveScoresByGameId={liveScoresByGameId}
            now={now}
            onEdit={() => onEdit(bet)}
            onSetPotw={() => onSetPotw(bet)}
            onShare={() => onShare(bet)}
            potwSwapClosed={potwSwapClosed}
            potwSwapPending={potwSwapPendingBetId === bet.id}
            readOnly={readOnly}
            shareLoading={sharingBetId === bet.id}
          />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * The rail once the card is in.
 *
 * The rail is the one part of the board that never goes away, so after submit it
 * carries the week's ledger — what was allocated, what is still live, what has
 * come back — in the same place the budget meter stood while the card was being
 * built.
 */
export function SubmittedSummaryPanel({
  bets,
  isRefreshing,
  onRefresh,
  potwSwapClosed,
  readOnly,
  weekNumber,
}: {
  bets: PlacedBet[];
  isRefreshing: boolean;
  onRefresh: () => void;
  potwSwapClosed: boolean;
  readOnly: boolean;
  weekNumber: number;
}) {
  const settlementState = getBetSettlementState(bets);
  const settledBets = bets.filter((bet) => isSettledPick(bet.result));
  const pendingBets = bets.filter((bet) => !isSettledPick(bet.result));
  const totalAllocated = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const totalSettledReward = settledBets.reduce((sum, bet) => sum + getSettledReward(bet), 0);
  const totalPendingReward = pendingBets.reduce(
    (sum, bet) => sum + getDisplayedPlacedPayout(bet),
    0,
  );
  const totalSettledProfit = settledBets.reduce((sum, bet) => sum + (bet.profit ?? 0), 0);
  const lockBet = bets.find((bet) => bet.is_lock);

  const header =
    settlementState === 'settled'
      ? {
          headline: 'Week Results Final',
          helper: 'All picks have settled. Returns and net profit are final for this card.',
          Icon: CheckCircle2,
          label: 'Card Settled',
          textClass: 'text-electric-green',
        }
      : settlementState === 'partially_settled'
        ? {
            headline: 'Picks Are Settling',
            helper: `${settledBets.length} of ${bets.length} picks have settled. Pending picks still show potential reward.`,
            Icon: Clock,
            label: 'Results Updating',
            textClass: 'text-gold',
          }
        : readOnly
          ? {
              headline: 'Read-Only Card',
              helper: 'Past weeks show submitted picks and cannot be edited.',
              Icon: Eye,
              label: `Week ${weekNumber} Card`,
              textClass: 'text-cyan-accent',
            }
          : {
              headline: 'This Week is Submitted',
              helper: potwSwapClosed
                ? 'Picks stay editable until their own game starts. Pick of the Week is locked in — the week has kicked off.'
                : 'Picks stay editable until their own game starts. Pick of the Week can be moved until first kickoff.',
              Icon: Lock,
              label: 'Card Submitted',
              textClass: 'text-electric-green',
            };

  const rows: { label: string; tone?: string; value: string }[] = [
    { label: 'Allocated', value: formatCurrency(totalAllocated) },
    { label: 'Picks', value: `${bets.length}` },
  ];

  if (settlementState === 'settled') {
    rows.push(
      {
        label: 'Total returned',
        tone: 'text-electric-green',
        value: formatCurrency(totalSettledReward),
      },
      {
        label: 'Net profit',
        tone: getProfitTone(totalSettledProfit),
        value: formatProfit(totalSettledProfit),
      },
    );
  } else if (settlementState === 'partially_settled') {
    rows.push(
      {
        label: 'Returned so far',
        tone: 'text-electric-green',
        value: formatCurrency(totalSettledReward),
      },
      { label: 'Pending potential', tone: 'text-gold', value: formatCurrency(totalPendingReward) },
      {
        label: 'Net so far',
        tone: getProfitTone(totalSettledProfit),
        value: formatProfit(totalSettledProfit),
      },
    );
  } else {
    rows.push({
      label: 'Potential reward',
      tone: 'text-electric-green',
      value: formatCurrency(totalPendingReward),
    });
  }

  return (
    <div className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-arena-surface/70 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <header className="shrink-0 border-b border-white/[0.08] p-4">
        <p
          className={cn(
            'flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]',
            header.textClass,
          )}>
          <header.Icon aria-hidden className="h-3.5 w-3.5" />
          {header.label}
        </p>
        <h2 className="arena-heading mt-2 text-2xl leading-none">{header.headline}</h2>
        <p className="mt-2 text-sm font-semibold leading-5 text-white/55">{header.helper}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <dl className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2"
              key={row.label}>
              <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                {row.label}
              </dt>
              <dd className={cn('text-sm font-black', row.tone ?? 'text-white')}>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div
          className={cn(
            'mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2',
            lockBet ? 'border-gold/45 bg-gold/[0.08]' : 'border-white/10 bg-white/[0.03]',
          )}>
          <p
            className={cn(
              'flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]',
              lockBet ? 'text-gold' : 'text-white/55',
            )}>
            <Star aria-hidden className={cn('h-3 w-3', lockBet && 'fill-current')} />
            Pick of the Week
          </p>
          <p
            className={cn(
              'min-w-0 truncate text-right text-sm font-black',
              lockBet ? 'text-white' : 'text-white/40',
            )}>
            {lockBet ? formatPickTitle(lockBet) : 'None'}
          </p>
        </div>
      </div>

      <footer className="shrink-0 border-t border-white/[0.08] bg-arena-bg/40 p-4">
        <Button
          loading={isRefreshing}
          onClick={onRefresh}
          title="Refresh Card"
          variant="secondary"
        />
      </footer>
    </div>
  );
}
