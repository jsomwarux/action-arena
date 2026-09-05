import { useMemo } from 'react';

import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Radio,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { MatchupSpotlight } from '@/components/leagues/MatchupSpotlight';
import { WeeklyAwardsCard } from '@/components/leagues/WeeklyAwardsCard';
import { AnimatedProfit, Badge, Button, Card, QueryErrorState, Skeleton } from '@/components/ui';
import { MINIMUM_BETS_PER_WEEK, WEEKLY_BUDGET } from '@/constants/rules';
import { useAuth } from '@/hooks/use-auth';
import { useLeagueDetail } from '@/hooks/use-leagues';
import {
  remainingBetsNeeded,
  useHomeDashboard,
  type BetWithLegs,
  type HomeLeagueCard,
} from '@/hooks/use-matchups';
import { useUpcomingNflOdds } from '@/hooks/use-odds';
import { betTypeTheme } from '@/lib/bet-type-theme';
import { cn } from '@/lib/cn';
import {
  formatAmericanOdds,
  formatCurrency,
  formatProfit,
  formatRecord,
  getProfitTone,
} from '@/lib/format';
import { summarizeRecentResults } from '@/lib/home-results';
import { isGlobalWeekFixture } from '@/lib/league-settings';
import { formatPickTitle } from '@/lib/pick-labels';
import { isParentPickLocked } from '@/lib/pick-locking';
import { ROUTES, buildRoute } from '@/lib/routes';
import { useFocusedLeagueId } from '@/providers/focused-league';

function hasLiveBets(bets: BetWithLegs[]) {
  return bets.some((bet) => bet.result === 'pending' && isParentPickLocked(bet));
}

function picksSubmittedLabel(betsPlaced: number) {
  const needed = remainingBetsNeeded(betsPlaced);

  if (needed > 0) {
    return `${needed} ${needed === 1 ? 'pick' : 'picks'} needed`;
  }

  return `${betsPlaced} ${betsPlaced === 1 ? 'pick' : 'picks'} ready`;
}

function SectionHeading({ caption, title }: { caption?: string; title: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-electric-green">
        <span aria-hidden className="h-0.5 w-4 rounded-full bg-electric-green" />
        {title}
      </span>
      {caption ? <span className="text-[11px] font-medium text-white/45">{caption}</span> : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="flex flex-col gap-6 xl:col-span-8">
        <Skeleton height={150} radius={16} />
        <Skeleton height={280} radius={16} />
      </div>
      <div className="flex flex-col gap-6 xl:col-span-4">
        <Skeleton height={220} radius={16} />
        <Skeleton height={200} radius={16} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-5 py-14 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
        <Shield aria-hidden className="h-9 w-9 text-electric-green" />
      </span>
      <div className="flex flex-col gap-2.5">
        <h2 className="arena-heading text-3xl leading-none">No Leagues Yet</h2>
        <p className="max-w-md text-base font-semibold leading-snug text-white/65">
          Join a league to see your weekly matchups and results here.
        </p>
      </div>
      <Link to={ROUTES.leagueJoin}>
        <Button fullWidth={false} title="Find a League" variant="secondary" />
      </Link>
    </Card>
  );
}

function NoActiveSlateNotice() {
  return (
    <Card className="flex items-center gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10">
        <CalendarClock aria-hidden className="h-5 w-5 text-cyan-accent" />
      </span>
      <div>
        <h2 className="arena-heading text-xl leading-none">Season Starts Soon</h2>
        <p className="mt-1 text-sm font-semibold leading-5 text-white/55">
          No active NFL slate is available right now. Your leagues are ready, and this board will
          light up when the next slate opens.
        </p>
      </div>
    </Card>
  );
}

function ActionNeeded({ cards }: { cards: HomeLeagueCard[] }) {
  const urgentCards = cards.filter((card) => remainingBetsNeeded(card.betsPlaced) > 0);

  if (urgentCards.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-accent">
        <AlertCircle aria-hidden className="h-4 w-4" />
        Action Needed
      </span>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {urgentCards.map((card) => {
          const needed = remainingBetsNeeded(card.betsPlaced);

          return (
            <Link
              className="flex items-center gap-3 rounded-2xl border border-amber-accent/55 bg-amber-accent/10 p-4 transition hover:bg-amber-accent/[0.16]"
              key={card.league.id}
              to={ROUTES.picks}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-accent/55 bg-amber-accent/20">
                <Zap aria-hidden className="h-5 w-5 text-amber-accent" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-black uppercase text-white">
                  {card.league.name}
                </span>
                <span className="block text-sm font-semibold text-white/70">
                  {needed} more {needed === 1 ? 'pick' : 'picks'} until your card is ready
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-center gap-1.5">
                <Badge label={`${card.betsPlaced}/${MINIMUM_BETS_PER_WEEK}`} tone="amber" />
                <span className="arena-label text-amber-accent">
                  Submit Picks
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function LineupSummary({ card, slateOpen }: { card: HomeLeagueCard; slateOpen: boolean }) {
  const needed = remainingBetsNeeded(card.betsPlaced);
  const allocated = card.thisWeekBets.reduce((sum, bet) => sum + bet.amount, 0);
  const hasLock = card.thisWeekBets.some((bet) => bet.is_lock);
  const live = hasLiveBets(card.thisWeekBets);
  const showSlateClosed = !slateOpen && needed > 0;

  return (
    <Card className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="arena-eyebrow text-electric-green">
            Your Lineup · Week {card.league.current_week}
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {card.betsPlaced}
            <span className="text-white/40">/{MINIMUM_BETS_PER_WEEK} picks</span>
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {live ? <Badge label="Live" tone="gold" /> : null}
          <Badge
            label={hasLock ? 'Lock set' : 'No lock'}
            tone={hasLock ? 'green' : needed > 0 ? 'neutral' : 'red'}
          />
        </div>
      </header>

      <div>
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.15em]">
          <span className="text-white/45">Budget allocated</span>
          <span className="text-white">
            {formatCurrency(allocated)} / {formatCurrency(WEEKLY_BUDGET)}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={cn(
              'h-full rounded-full',
              allocated >= WEEKLY_BUDGET ? 'bg-electric-green' : 'bg-amber-accent',
            )}
            style={{ width: `${String(Math.min(100, (allocated / WEEKLY_BUDGET) * 100))}%` }}
          />
        </div>
      </div>

      {card.thisWeekBets.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {card.thisWeekBets.map((bet) => (
            <li
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border px-3 py-2',
                betTypeTheme(bet.bet_type).borderClass,
                betTypeTheme(bet.bet_type).bgClass,
              )}
              key={bet.id}>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Badge betType={bet.bet_type} />
                <Link
                  className="truncate text-xs font-semibold text-white/80 hover:text-electric-green"
                  to={buildRoute.bet(bet.id)}>
                  {formatPickTitle(bet)}
                </Link>
              </span>
              <span className="shrink-0 text-[11px] font-black text-white/55">
                {formatCurrency(bet.amount)} · {formatAmericanOdds(bet.odds)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-semibold text-white/50">
          No picks placed in this league yet this week.
        </p>
      )}

      <footer className="flex items-center justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em]',
            needed > 0 ? 'text-amber-accent' : 'text-electric-green',
          )}>
          {needed > 0 ? (
            <Clock aria-hidden className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
          )}
          {showSlateClosed ? 'Slate opens soon' : picksSubmittedLabel(card.betsPlaced)}
        </span>

        <Link
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 arena-tag transition',
            needed > 0
              ? 'border-electric-green/55 bg-electric-green/15 text-electric-green hover:bg-electric-green/25'
              : 'border-white/15 bg-white/[0.05] text-white/65 hover:bg-white/10',
          )}
          to={ROUTES.picks}>
          {showSlateClosed ? 'Season Soon' : needed > 0 ? `Place ${String(needed)}` : 'Card Ready'}
          <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      </footer>
    </Card>
  );
}

function NotableBet({ bet, label, tone }: { bet: BetWithLegs; label: string; tone: 'green' | 'red' }) {
  const Icon = tone === 'green' ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5',
        tone === 'green'
          ? 'border-electric-green/25 bg-electric-green/[0.06]'
          : 'border-coral-red/25 bg-coral-red/[0.06]',
      )}>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.13em]',
            tone === 'green' ? 'text-electric-green' : 'text-coral-red',
          )}>
          <Icon aria-hidden className="h-3 w-3" />
          {label}
        </span>
        <p className="mt-1 truncate text-sm font-black text-white">
          {formatPickTitle(bet)} · {formatAmericanOdds(bet.odds)}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-sm font-black',
          tone === 'green' ? 'text-electric-green' : 'text-coral-red',
        )}>
        {formatProfit(bet.profit ?? 0)}
      </span>
    </div>
  );
}

function RecentResults({ card }: { card: HomeLeagueCard }) {
  const lastWeekMatchup = card.lastWeekMatchup;
  const recentResult = summarizeRecentResults(card.lastWeekBets);
  const { biggestLoss, biggestWin, hasSettledPicks, profit: lastProfit } = recentResult;
  const won =
    hasSettledPicks &&
    Boolean(lastWeekMatchup?.winner_id) &&
    lastWeekMatchup?.winner_id === card.lastWeekStanding?.user_id;
  const lost =
    hasSettledPicks &&
    Boolean(lastWeekMatchup?.winner_id) &&
    Boolean(card.lastWeekStanding) &&
    lastWeekMatchup?.winner_id !== card.lastWeekStanding?.user_id;
  const isWin = won || (!lastWeekMatchup && lastProfit !== null && lastProfit > 0);
  const isLoss = lost || (!lastWeekMatchup && lastProfit !== null && lastProfit < 0);
  const outcome = !hasSettledPicks
    ? 'Pending'
    : won
      ? 'Win'
      : lost
        ? 'Loss'
        : lastWeekMatchup
          ? 'Tie'
          : lastProfit !== null && lastProfit !== 0
            ? lastProfit > 0
              ? 'Profit'
              : 'Loss'
            : 'Settled';

  return (
    <Card className="flex flex-col gap-4 overflow-hidden" padded={false}>
      <div
        className={cn(
          'h-[3px] w-full',
          isWin ? 'bg-electric-green' : isLoss ? 'bg-coral-red/60' : 'bg-white/10',
        )}
      />
      <div className="flex flex-col gap-4 px-4 pb-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p
              className={cn(
                'text-[10px] font-black uppercase tracking-[0.16em]',
                isWin ? 'text-electric-green' : isLoss ? 'text-coral-red' : 'text-white/55',
              )}>
              Week {Math.max(1, card.league.current_week - 1)} · {outcome}
            </p>
            <p className="mt-1 text-base font-black text-white">{card.league.name}</p>
          </div>
          {lastProfit !== null ? (
            <AnimatedProfit className="text-2xl font-black" value={lastProfit} />
          ) : (
            <span className="arena-label text-white/45">
              No Result
            </span>
          )}
        </header>

        <div className="flex flex-col gap-2">
          {biggestWin ? <NotableBet bet={biggestWin} label="Biggest win" tone="green" /> : null}
          {biggestLoss && biggestLoss.id !== biggestWin?.id ? (
            <NotableBet bet={biggestLoss} label="Biggest loss" tone="red" />
          ) : null}
          {!biggestWin && !biggestLoss ? (
            <p className="text-sm font-semibold text-white/45">
              No settled picks from last week yet.
            </p>
          ) : null}
        </div>

        {lastWeekMatchup ? (
          <Link
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 arena-label text-white transition hover:bg-white/10"
            to={buildRoute.matchup(lastWeekMatchup.id)}>
            Open Matchup
            <ArrowRight aria-hidden className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

function StandingsSnapshot({ card, userId }: { card: HomeLeagueCard; userId: string }) {
  const detailQuery = useLeagueDetail(card.league.id, userId);
  const detail = detailQuery.data;
  const isH2H = card.league.type === 'h2h';

  const latestWeek = detail?.standings.reduce<number | null>((latest, standing) => {
    if (latest === null || standing.week_number > latest) {
      return standing.week_number;
    }
    return latest;
  }, null);
  const rows = (detail?.standings ?? [])
    .filter((standing) => standing.week_number === latestWeek)
    .sort((left, right) => left.rank - right.rank);
  const topRows = rows.slice(0, 5);
  const viewerRow = rows.find((standing) => standing.user_id === userId);
  const showViewerRow = Boolean(viewerRow) && !topRows.some((row) => row.user_id === userId);

  return (
    <Card className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <p className="arena-eyebrow text-electric-green">
          Standings
        </p>
        <Link
          className="arena-tag text-white/55 transition hover:text-electric-green"
          to={buildRoute.league(card.league.id)}>
          Open league
        </Link>
      </header>

      {detailQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((item) => (
            <Skeleton height={34} key={item} radius={10} />
          ))}
        </div>
      ) : detailQuery.isError ? (
        <QueryErrorState
          className="py-4"
          error={detailQuery.error}
          fallback="Standings could not be loaded."
          onRetry={() => void detailQuery.refetch()}
          retrying={detailQuery.isFetching}
          title="Standings Unavailable"
        />
      ) : rows.length === 0 ? (
        <p className="text-sm font-semibold text-white/50">
          Season standings appear once the first week is settled.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {[...topRows, ...(showViewerRow && viewerRow ? [viewerRow] : [])].map((standing) => {
            const isCurrentUser = standing.user_id === userId;
            const member = detail?.members.find((row) => row.user_id === standing.user_id);
            const profile = detail?.profilesById[standing.user_id];
            const name = member?.team_name.trim() || profile?.display_name || 'Player';

            return (
              <li
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2',
                  isCurrentUser ? 'bg-electric-green/[0.08]' : 'bg-white/[0.02]',
                )}
                key={standing.id}>
                <span
                  className={cn(
                    'w-6 shrink-0 text-sm font-black',
                    standing.rank === 1 ? 'text-gold' : 'text-white/60',
                  )}>
                  {standing.rank}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm font-bold',
                    isCurrentUser ? 'text-electric-green' : 'text-white/85',
                  )}>
                  {name}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-sm font-black',
                    isH2H ? 'text-white/80' : getProfitTone(standing.total_profit),
                  )}>
                  {isH2H
                    ? formatRecord(standing.wins, standing.losses, standing.ties)
                    : formatProfit(standing.total_profit)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * The desktop home dashboard.
 *
 * Mobile's home is one scrolling column of per-league cards. Desktop has the
 * room to be a cockpit instead: one league in focus across a wide main column
 * (matchup, this week's lineup, last week's result) with its standings and
 * trophy case in the rail beside it, and every other league one click away.
 * Same data as mobile — useHomeDashboard — plus the focused league's standings.
 */
export function HomePage() {
  const { user } = useAuth();
  const dashboardQuery = useHomeDashboard(user?.id);
  const oddsQuery = useUpcomingNflOdds();
  // Focus is shared with the top bar and every other league-aware screen.

  const cards = dashboardQuery.data?.cards ?? [];
  const hasFixtureCard = cards.some((card) => isGlobalWeekFixture(card.league));
  const showNoActiveSlate =
    cards.length > 0 &&
    oddsQuery.isSuccess &&
    (oddsQuery.data?.length ?? 0) === 0 &&
    !hasFixtureCard;

  // With nothing focused yet the cockpit opens on the league that needs picks
  // most urgently, so it lands on the thing the player has to act on. An
  // explicit choice — here or in the top bar — outranks that.
  const { focusedLeagueId, setFocusedLeagueId } = useFocusedLeagueId(
    useMemo(() => cards.map((card) => card.league.id), [cards]),
    {
      fallbackId: cards.find((card) => remainingBetsNeeded(card.betsPlaced) > 0)?.league.id,
    },
  );

  const focusedCard = cards.find((card) => card.league.id === focusedLeagueId) ?? cards[0] ?? null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-electric-green">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            Command Center
          </span>
          <h1 className="arena-heading mt-1 text-5xl leading-none">Home</h1>
          <p className="mt-1.5 text-base font-medium text-white/60">
            Track the week, spot urgent leagues, and jump into picks.
          </p>
        </div>

        <Link to={ROUTES.picks}>
          <Button fullWidth={false} icon={Zap} title="Open Pick Board" />
        </Link>
      </header>

      {dashboardQuery.isLoading ? (
        <LoadingState />
      ) : dashboardQuery.isError ? (
        // An empty state has to mean empty: `cards` falls back to [], so a
        // failed dashboard fetch used to render "no leagues yet".
        <Card>
          <QueryErrorState
            error={dashboardQuery.error}
            fallback="We could not load your leagues right now."
            onRetry={() => void dashboardQuery.refetch()}
            retrying={dashboardQuery.isFetching}
            title="Leagues Unavailable"
          />
        </Card>
      ) : cards.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {showNoActiveSlate ? <NoActiveSlateNotice /> : <ActionNeeded cards={cards} />}

          {cards.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {cards.map((card) => {
                const isFocused = card.league.id === focusedCard?.league.id;
                const needed = remainingBetsNeeded(card.betsPlaced);

                return (
                  <button
                    aria-pressed={isFocused}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition',
                      isFocused
                        ? 'border-electric-green bg-electric-green/15 text-electric-green'
                        : 'border-white/10 bg-white/[0.04] text-white/65 hover:text-white',
                    )}
                    key={card.league.id}
                    onClick={() => setFocusedLeagueId(card.league.id)}
                    type="button">
                    {card.league.name}
                    {needed > 0 ? (
                      <span className="rounded-full bg-amber-accent/20 px-1.5 py-[1px] text-[10px] text-amber-accent">
                        {needed}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {focusedCard && user ? (
            <div className="grid gap-6 xl:grid-cols-12">
              <div className="flex flex-col gap-6 xl:col-span-8">
                <SectionHeading caption={`Week ${focusedCard.league.current_week}`} title="This Week" />

                <MatchupSpotlight
                  leagueType={focusedCard.league.type}
                  matchupId={focusedCard.currentMatchup?.id ?? null}
                  memberCount={focusedCard.memberCount}
                  opponentLabel={focusedCard.opponentLabel}
                  opponentSecondaryLabel={focusedCard.opponentSecondaryLabel}
                  viewerLabel={focusedCard.viewerLabel}
                  viewerSecondaryLabel={focusedCard.viewerSecondaryLabel}
                  weekNumber={focusedCard.league.current_week}
                  weeklyProfit={focusedCard.weeklyProfit}
                />

                <LineupSummary card={focusedCard} slateOpen={!showNoActiveSlate} />

                <SectionHeading caption="Last week" title="Recent Results" />
                <div className="grid gap-4 md:grid-cols-2">
                  {cards.map((card) => (
                    <RecentResults card={card} key={card.league.id} />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-6 xl:col-span-4">
                <StandingsSnapshot card={focusedCard} userId={user.id} />

                <WeeklyAwardsCard
                  awards={focusedCard.weeklyAwards}
                  weekNumber={Math.max(
                    1,
                    focusedCard.league.current_week > 1
                      ? focusedCard.league.current_week - 1
                      : focusedCard.league.current_week,
                  )}
                />

                {cards.length > 1 ? (
                  <Card className="flex flex-col gap-3">
                    <p className="arena-eyebrow text-electric-green">
                      Your Other Leagues
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {cards
                        .filter((card) => card.league.id !== focusedCard.league.id)
                        .map((card) => (
                          <li key={card.league.id}>
                            <Link
                              className="arena-row-interactive flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2"
                              to={buildRoute.league(card.league.id)}>
                              <span className="min-w-0 flex-1 truncate text-sm font-bold text-white/85">
                                {card.league.name}
                              </span>
                              <AnimatedProfit
                                className="shrink-0 text-xs font-black"
                                value={card.weeklyProfit}
                              />
                              {hasLiveBets(card.thisWeekBets) ? (
                                <Radio aria-hidden className="h-3.5 w-3.5 shrink-0 text-gold" />
                              ) : null}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </Card>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
