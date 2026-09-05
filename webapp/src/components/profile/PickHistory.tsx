import { useEffect, useMemo, useState } from 'react';

import { Check, EyeOff, Filter, Link2, Minus, TrendingUp, X, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MetricGrid } from '@/components/picks/atoms';
import {
  Badge,
  Button,
  Card,
  Notice,
  SegmentedToggle,
  StaggeredItem,
  type SegmentedOption,
} from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useShareBetToChat } from '@/hooks/use-league-chat';
import { filterProfileBets } from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import { formatProfit, getProfitTone } from '@/lib/format';
import { comparePicksByStartTimeDesc, formatBetLegLabel, formatPickTitle } from '@/lib/pick-labels';
import { buildRoute } from '@/lib/routes';
import type { BetResult, BetType, BetWithLegs } from '@/types/database';

import {
  BET_TYPE_META,
  LockPill,
  RESULT_ICON,
  RESULT_TONE,
  getHistoryFinancialMetrics,
  getRewardDisplay,
} from './pick-language';

type FilterState = {
  betType: BetType | 'all';
  result: BetResult | 'all';
  week: number | 'all';
};

type LeagueNameById = Record<string, string>;

const RESULT_FILTER_OPTIONS: SegmentedOption<BetResult | 'all'>[] = [
  { label: 'All', value: 'all' },
  { accent: 'green', icon: Check, label: 'Wins', value: 'win' },
  { accent: 'red', icon: X, label: 'Losses', value: 'loss' },
  { accent: 'gold', icon: Minus, label: 'Pushes', value: 'push' },
];

const TYPE_FILTER_OPTIONS: SegmentedOption<BetType | 'all'>[] = [
  { label: 'All', value: 'all' },
  { accent: 'green', icon: Zap, label: 'Straight', value: 'straight' },
  { accent: 'amber', icon: Link2, label: 'Parlay', value: 'parlay' },
  { accent: 'cyan', icon: TrendingUp, label: 'Teaser', value: 'teaser' },
];

/** How many cards a click of "Load More" adds. Mobile's page size. */
const PAGE_SIZE = 12;

function ShareStatus({ status }: { status: { text: string; tone: 'error' | 'success' } | null }) {
  if (!status) {
    return null;
  }

  return <Notice tone={status.tone}>{status.text}</Notice>;
}

/**
 * One placed pick, as it reads in history.
 *
 * Straight from the mobile BetHistoryCard: bet-type accent on the border, the
 * result bar across the top (gold when it is the Lock), the money grid, and the
 * per-leg result list for anything multi-leg. Desktop adds a link into
 * /bets/:betId; the phone opens the same detail screen by tapping the row.
 */
function BetHistoryCard({
  bet,
  leagueName,
  onShare,
  sharingBetId,
}: {
  bet: BetWithLegs;
  leagueName: string;
  onShare: (bet: BetWithLegs) => void;
  sharingBetId: string | null;
}) {
  const meta = BET_TYPE_META[bet.bet_type];
  const tone = RESULT_TONE[bet.result];
  const ResultIcon = RESULT_ICON[bet.result];
  const profit = bet.profit ?? 0;
  const isMultiLeg = bet.bet_type !== 'straight';
  const isLock = bet.is_lock;
  const reward = getRewardDisplay(bet);
  const financialMetrics = getHistoryFinancialMetrics(bet, reward.label, reward.value);

  return (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl border',
        isLock ? 'bg-gold/[0.06]' : 'bg-white/[0.04]',
      )}
      style={{
        borderColor: isLock ? THEME_COLORS.gold : `${meta.accent}26`,
        borderWidth: isLock ? 1.5 : 1,
        boxShadow: isLock ? `0 0 10px ${THEME_COLORS.gold}40` : undefined,
      }}>
      <div aria-hidden className={cn('h-[3px] w-full', isLock ? 'bg-gold' : tone.bar)} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge betType={bet.bet_type} />
              {isLock ? <LockPill /> : null}
              <span className="min-w-0 truncate arena-tag text-white/45">
                Week {bet.week_number} · {leagueName}
              </span>
            </div>
            <Link
              className="text-base font-black tracking-[-0.3px] text-white hover:text-electric-green"
              to={buildRoute.bet(bet.id)}>
              {formatPickTitle(bet)}
            </Link>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1',
                'arena-label',
                tone.pillBg,
                tone.pillBorder,
                tone.pill,
              )}>
              {ResultIcon ? (
                <ResultIcon aria-hidden className="h-[11px] w-[11px]" />
              ) : (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
              )}
              {tone.label}
            </span>
            <span className={cn('text-lg font-black tracking-[-0.4px]', getProfitTone(profit))}>
              {bet.profit === null ? '–' : formatProfit(profit)}
            </span>
          </div>
        </div>

        <MetricGrid metrics={financialMetrics} showTopBorder={false} />

        {isMultiLeg ? (
          <ul className="flex flex-col gap-1.5">
            {bet.bet_legs.map((leg, index) => {
              const legTone = RESULT_TONE[leg.result];

              return (
                <li
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                  key={leg.id}>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black tracking-[-0.2px]"
                      style={{ backgroundColor: `${meta.accent}26`, color: meta.accent }}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/75">
                      {formatBetLegLabel(leg, { betType: bet.bet_type })}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 arena-tag',
                      legTone.text,
                    )}>
                    {legTone.label}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="mt-auto pt-1">
          <Button
            loading={sharingBetId === bet.id}
            onClick={() => onShare(bet)}
            title="Share to Chat"
            variant="secondary"
          />
        </div>
      </div>
    </article>
  );
}

function WeekFilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'rounded-full border px-3 py-1.5 arena-tag',
        'transition duration-150 ease-arena',
        active
          ? 'border-electric-green/55 bg-electric-green/15 text-electric-green'
          : 'border-white/10 bg-white/[0.04] text-white/55 hover:text-white',
      )}
      onClick={onClick}
      type="button">
      {label}
    </button>
  );
}

/**
 * The filtered pick log.
 *
 * Filtering, sort order and the 12-at-a-time paging all match mobile exactly —
 * `filterProfileBets` plus `comparePicksByStartTimeDesc`, and the visible count
 * resets whenever a filter or the league scope changes. The desktop change is
 * layout only: the filter bar sits on one row and the cards run two-up.
 */
export function PickHistory({
  bets,
  emptyHint,
  leagueId,
  leagueNameById,
  scopeLabel,
}: {
  bets: BetWithLegs[];
  /**
   * What to say when there is nothing here *before* any filter runs. On another
   * player's profile that is usually redaction, not absence: RLS returns zero
   * rows for an opponent's pending picks until first kickoff, and a bare
   * "0 picks" reads as data loss to someone who can see on the league's Members
   * list that this player has submitted.
   */
  emptyHint?: string;
  leagueId: string | 'all';
  leagueNameById: LeagueNameById;
  scopeLabel: string;
}) {
  const { user } = useAuth();
  const shareBet = useShareBetToChat(user?.id);
  const [filters, setFilters] = useState<FilterState>({
    betType: 'all',
    result: 'all',
    week: 'all',
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sharingBetId, setSharingBetId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<{
    text: string;
    tone: 'error' | 'success';
  } | null>(null);

  const weeks = useMemo(
    () => [...new Set(bets.map((bet) => bet.week_number))].sort((left, right) => right - left),
    [bets],
  );
  const filtered = useMemo(
    () => filterProfileBets({ ...filters, bets, leagueId }).sort(comparePicksByStartTimeDesc),
    [bets, filters, leagueId],
  );
  const visible = filtered.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters.betType, filters.result, filters.week, leagueId]);

  // Success is transient; a failed share stays until the next attempt so the
  // reason does not vanish before it is read.
  useEffect(() => {
    if (shareStatus?.tone !== 'success') {
      return undefined;
    }

    const timeout = window.setTimeout(() => setShareStatus(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  const handleShare = async (bet: BetWithLegs) => {
    setSharingBetId(bet.id);
    try {
      await shareBet.mutateAsync(bet);
      setShareStatus({ text: 'This pick is now in league chat.', tone: 'success' });
    } catch (error) {
      setShareStatus({
        text: error instanceof Error ? error.message : 'Could not share pick.',
        tone: 'error',
      });
    } finally {
      setSharingBetId(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-1 w-6 rounded-full bg-electric-green" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-electric-green">
            Pick History
          </h2>
        </div>
        <p className="shrink-0 text-[10px] font-semibold text-white/45">
          {scopeLabel} · {filtered.length} {filtered.length === 1 ? 'pick' : 'picks'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[18rem] flex-1">
            <SegmentedToggle
              compact
              onChange={(result) => setFilters((current) => ({ ...current, result }))}
              options={RESULT_FILTER_OPTIONS}
              value={filters.result}
            />
          </div>
          <div className="min-w-[18rem] flex-1">
            <SegmentedToggle
              compact
              onChange={(betType) => setFilters((current) => ({ ...current, betType }))}
              options={TYPE_FILTER_OPTIONS}
              value={filters.betType}
            />
          </div>
        </div>

        {weeks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <WeekFilterChip
              active={filters.week === 'all'}
              label="All Weeks"
              onClick={() => setFilters((current) => ({ ...current, week: 'all' }))}
            />
            {/* Mobile shows the eight most recent weeks; desktop has the room
                for the full set of weeks that actually have picks. */}
            {weeks.map((week) => (
              <WeekFilterChip
                active={filters.week === week}
                key={week}
                label={`W${String(week)}`}
                onClick={() => setFilters((current) => ({ ...current, week }))}
              />
            ))}
          </div>
        ) : null}
      </div>

      <ShareStatus status={shareStatus} />

      {visible.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-5">
            {bets.length === 0 && emptyHint ? (
              <>
                <EyeOff aria-hidden className="h-5 w-5 text-cyan-accent/70" />
                <p className="max-w-md text-center text-sm font-semibold text-white/55">
                  {emptyHint}
                </p>
              </>
            ) : (
              <>
                <Filter aria-hidden className="h-5 w-5 text-white/45" />
                <p className="text-sm font-semibold text-white/55">
                  No picks match these filters.
                </p>
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visible.map((bet, index) => (
            <StaggeredItem className="h-full" index={index} key={bet.id} perItemDelay={45}>
              <BetHistoryCard
                bet={bet}
                leagueName={leagueNameById[bet.league_id] ?? 'Unknown league'}
                onShare={(shared) => void handleShare(shared)}
                sharingBetId={sharingBetId}
              />
            </StaggeredItem>
          ))}
        </div>
      )}

      {visible.length < filtered.length ? (
        <Button
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          title="Load More"
          variant="secondary"
        />
      ) : null}
    </section>
  );
}
