import { useMemo } from 'react';

import { CalendarClock, ChevronRight, Swords, Trophy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { CosmeticAvatar } from '@/components/cosmetics';
import { useCurrentWeekMatchups, type CurrentWeekMatchupCard } from '@/components/matchups';
import { AnimatedProfit, Badge, Button, Card, QueryErrorState, Skeleton, StaggeredItem } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useEquippedCosmeticsForUsers } from '@/hooks/use-cosmetics';
import { useLeagueDetail } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import { formatRecord } from '@/lib/format';
import { getLeagueMemberPrimaryName } from '@/lib/league-member-display';
import { getMatchupSideStatus, getProfitSwingHeadline } from '@/lib/matchup-language';
import { ROUTES, buildRoute } from '@/lib/routes';
import { useFocusedLeagueId } from '@/providers/focused-league';
import type { EquippedCosmeticsByCategory } from '@/types/database';

const HISTORY_GRID = 'grid grid-cols-[5rem_minmax(9rem,1fr)_7rem_7rem_6rem]';

const STATUS_TONE: Record<string, string> = {
  leading: 'border-gold/50 bg-gold/15 text-gold',
  lost: 'border-coral-red/45 bg-coral-red/15 text-coral-red',
  trailing: 'border-coral-red/45 bg-coral-red/15 text-coral-red',
  won: 'border-electric-green/45 bg-electric-green/15 text-electric-green',
};

function SideRow({
  cosmetics,
  isViewer,
  name,
  profit,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  isViewer: boolean;
  name: string;
  profit: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <CosmeticAvatar cosmetics={cosmetics} name={name} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{name}</span>
      {isViewer ? (
        <span className="shrink-0 rounded-full border border-electric-green/40 bg-electric-green/15 px-2 py-[1px] text-[9px] font-black uppercase tracking-[1.2px] text-electric-green">
          You
        </span>
      ) : null}
      <AnimatedProfit className="shrink-0 text-sm font-black tabular-nums" value={profit} />
    </div>
  );
}

function CurrentWeekCard({
  card,
  cosmeticsByUserId,
  userId,
}: {
  card: CurrentWeekMatchupCard;
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory | undefined>;
  userId: string | undefined;
}) {
  const { league, matchup } = card;
  const isCumulative = league.type !== 'h2h';
  const viewerStatus = matchup
    ? getMatchupSideStatus({
        opposingProfit: card.viewerIsHome ? card.awayProfit : card.homeProfit,
        sideProfit: card.viewerProfit,
        sideUserId: userId ?? null,
        winnerId: matchup.winner_id,
      })
    : null;
  const isBye = Boolean(matchup) && matchup?.away_user_id === null;

  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="arena-eyebrow text-electric-green">
            Week {league.current_week}
          </p>
          <h3 className="mt-1 truncate text-lg font-black tracking-[-0.3px] text-white">
            {league.name}
          </h3>
        </div>
        {matchup?.is_championship ? (
          <Badge label="Championship" tone="gold" />
        ) : matchup?.is_playoff ? (
          <Badge label="Playoff" tone="cyan" />
        ) : viewerStatus ? (
          <span
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 arena-tag',
              STATUS_TONE[viewerStatus],
            )}>
            {viewerStatus}
          </span>
        ) : null}
      </header>

      {isCumulative ? (
        <div className="flex flex-1 flex-col justify-between gap-4">
          <p className="text-sm font-semibold leading-5 text-white/55">
            Cumulative league — no head-to-head matchups. Season position is decided on total
            profit.
          </p>
          <Link
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-electric-green transition hover:text-white"
            to={ROUTES.leaderboard}>
            <Trophy aria-hidden className="h-3.5 w-3.5" />
            Open leaderboard
          </Link>
        </div>
      ) : !matchup ? (
        <div className="flex flex-1 flex-col justify-between gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
            <CalendarClock aria-hidden className="h-5 w-5 shrink-0 text-white/45" />
            <p className="text-xs font-semibold text-white/55">
              No matchup scheduled for this week yet.
            </p>
          </div>
          <Link
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-white/50 transition hover:text-white"
            to={buildRoute.league(league.id)}>
            League hub
            <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <SideRow
              cosmetics={card.homeUserId ? cosmeticsByUserId[card.homeUserId] : undefined}
              isViewer={card.homeUserId === userId}
              name={card.homeName}
              profit={card.homeProfit}
            />
            <div className="flex items-center gap-3">
              <span aria-hidden className="h-px flex-1 bg-white/[0.08]" />
              <span className="arena-label text-white/35">
                {isBye ? 'Bye' : 'vs'}
              </span>
              <span aria-hidden className="h-px flex-1 bg-white/[0.08]" />
            </div>
            <SideRow
              cosmetics={card.awayUserId ? cosmeticsByUserId[card.awayUserId] : undefined}
              isViewer={card.awayUserId === userId}
              name={card.awayName}
              profit={card.awayProfit}
            />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-white/50">
              {isBye
                ? 'You are on bye — picks still count toward season profit.'
                : getProfitSwingHeadline({
                    awayName: card.awayName,
                    awayProfit: card.awayProfit,
                    awayUserId: card.awayUserId,
                    homeName: card.homeName,
                    homeProfit: card.homeProfit,
                    homeUserId: card.homeUserId ?? '',
                    winnerId: matchup.winner_id,
                  })}
              {' · '}
              {card.picksPlaced} {card.picksPlaced === 1 ? 'pick' : 'picks'} placed
            </p>
            <Link
              className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-electric-green transition hover:text-white"
              to={buildRoute.matchup(matchup.id)}>
              Open matchup
              <ChevronRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

function MatchupHistory({
  activeLeagueId,
  userId,
}: {
  activeLeagueId: string | undefined;
  userId: string | undefined;
}) {
  const leagueDetailQuery = useLeagueDetail(activeLeagueId, userId);
  const detail = leagueDetailQuery.data;
  // Past opponents are not necessarily in this week's matchup, so this list
  // needs its own cosmetics lookup rather than the index's.
  const cosmeticsQuery = useEquippedCosmeticsForUsers(
    (detail?.members ?? []).map((member) => member.user_id),
  );
  const cosmeticsByUserId = cosmeticsQuery.data ?? {};

  const rows = useMemo(() => {
    if (!detail || !userId) {
      return [];
    }

    const membersByUserId = detail.members.reduce<Record<string, (typeof detail.members)[number]>>(
      (accumulator, member) => {
        accumulator[member.user_id] = member;
        return accumulator;
      },
      {},
    );

    return detail.matchups
      .filter(
        (matchup) =>
          matchup.week_number < detail.league.current_week &&
          (matchup.home_user_id === userId || matchup.away_user_id === userId),
      )
      .sort((left, right) => right.week_number - left.week_number)
      .map((matchup) => {
        const viewerIsHome = matchup.home_user_id === userId;
        const opponentId = viewerIsHome ? matchup.away_user_id : matchup.home_user_id;
        const viewerProfit = (viewerIsHome ? matchup.home_profit : matchup.away_profit) ?? 0;
        const opponentProfit = (viewerIsHome ? matchup.away_profit : matchup.home_profit) ?? 0;
        const standing = detail.standings.find(
          (row) => row.user_id === userId && row.week_number === matchup.week_number,
        );

        return {
          matchup,
          opponentCosmetics: opponentId ? cosmeticsByUserId[opponentId] : undefined,
          opponentName: opponentId
            ? getLeagueMemberPrimaryName(
                membersByUserId[opponentId],
                detail.profilesById[opponentId],
                'Opponent',
              )
            : 'Bye Week',
          opponentProfit,
          record: standing
            ? formatRecord(standing.wins, standing.losses, standing.ties)
            : null,
          status: getMatchupSideStatus({
            opposingProfit: opponentProfit,
            sideProfit: viewerProfit,
            sideUserId: userId,
            winnerId: matchup.winner_id,
          }),
          viewerProfit,
        };
      });
  }, [cosmeticsByUserId, detail, userId]);

  if (leagueDetailQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((item) => (
          <Skeleton height={64} key={item} radius={16} />
        ))}
      </div>
    );
  }

  if (leagueDetailQuery.isError) {
    return (
      <Card className="p-8">
        <QueryErrorState
          error={leagueDetailQuery.error}
          fallback="We could not load this league's matchup history."
          onRetry={() => void leagueDetailQuery.refetch()}
          retrying={leagueDetailQuery.isFetching}
          title="History Unavailable"
        />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center gap-2">
          <Swords aria-hidden className="h-6 w-6 text-white/40" />
          <p className="text-center text-sm font-semibold text-white/55">
            No settled matchups yet in this league. Past weeks show up here as they finish.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" padded={false}>
      {/* Same reasoning as the leaderboard table: scroll rather than let the
          fixed profit columns squeeze the opponent name to nothing. */}
      <div className="overflow-x-auto">
      <div className="min-w-[44rem]">
      <div className={cn(HISTORY_GRID, 'items-center gap-3 border-b border-white/[0.08] px-5 py-3')}>
        {['Week', 'Opponent', 'Your profit', 'Their profit', 'Result'].map((heading) => (
          <span
            className="text-[11px] font-black uppercase tracking-[1.2px] text-white/50 last:text-right"
            key={heading}>
            {heading}
          </span>
        ))}
      </div>
      {rows.map((row, index) => (
        <StaggeredItem index={index} key={row.matchup.id} perItemDelay={40}>
          <Link
            className={cn(
              HISTORY_GRID,
              'items-center gap-3 px-5 py-3.5',
              'arena-row-interactive',
              index > 0 && 'border-t border-white/[0.05]',
            )}
            to={buildRoute.matchup(row.matchup.id)}>
            <span className="text-sm font-black text-white/70">Week {row.matchup.week_number}</span>
            <span className="flex min-w-0 items-center gap-2">
              <CosmeticAvatar
                cosmetics={row.opponentCosmetics}
                name={row.opponentName}
                size="sm"
              />
              <span className="min-w-0 truncate text-sm font-bold text-white">
                {row.opponentName}
              </span>
              {row.record ? (
                <span className="shrink-0 text-[11px] font-semibold text-white/40">
                  {row.record}
                </span>
              ) : null}
            </span>
            <AnimatedProfit
              className="text-sm font-black tabular-nums"
              value={row.viewerProfit}
            />
            <AnimatedProfit
              className="text-sm font-black tabular-nums"
              value={row.opponentProfit}
            />
            <span className="text-right">
              <span
                className={cn(
                  'inline-flex rounded-full border px-2.5 py-1 arena-tag',
                  row.status
                    ? STATUS_TONE[row.status]
                    : 'border-white/15 bg-white/[0.05] text-white/55',
                )}>
                {row.status ?? 'Tie'}
              </span>
            </span>
          </Link>
        </StaggeredItem>
      ))}
      </div>
      </div>
    </Card>
  );
}

/**
 * Matchups index — the desktop-only screen the sidebar's "Matchups" tab points
 * at. Mobile has no equivalent: on a phone this week's matchup lives on the
 * home dashboard, one league at a time. Here every league is visible at once,
 * with one league's full history underneath.
 */
export function MatchupsIndexPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;
  const cardsQuery = useCurrentWeekMatchups(userId);
  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const h2hLeagues = useMemo(
    () => cards.filter((card) => card.league.type === 'h2h'),
    [cards],
  );
  // Only head-to-head leagues have a history table here, so those are the ones
  // the shared focus is reconciled against.
  const { focusedLeagueId: activeLeagueId, setFocusedLeagueId: setActiveLeagueId } =
    useFocusedLeagueId(useMemo(() => h2hLeagues.map((card) => card.league.id), [h2hLeagues]));

  const cosmeticsQuery = useEquippedCosmeticsForUsers(
    cards.flatMap((card) => [card.homeUserId, card.awayUserId, userId ?? null]),
  );
  const cosmeticsByUserId = cosmeticsQuery.data ?? {};

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
          <span className="text-xs font-black uppercase tracking-[0.14em] text-electric-green">
            Head to Head
          </span>
        </div>
        <h1 className="arena-heading text-5xl leading-none">Matchups</h1>
        <p className="max-w-2xl text-textMuted">
          This week&rsquo;s matchup in every league you&rsquo;re in, and your full history in one of
          them.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-white/50">This week</h2>

        {cardsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Skeleton height={240} key={item} radius={20} />
            ))}
          </div>
        ) : cardsQuery.isError ? (
          // `cards` falls back to [], so a failed fetch used to render
          // "No Leagues Yet — join or create one" to a player who has leagues.
          <Card className="p-8">
            <QueryErrorState
              error={cardsQuery.error}
              fallback="We could not load this week's matchups."
              onRetry={() => void cardsQuery.refetch()}
              retrying={cardsQuery.isFetching}
              title="Matchups Unavailable"
            />
          </Card>
        ) : cards.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-5">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
                <Swords aria-hidden className="h-8 w-8 text-electric-green" />
              </span>
              <div className="flex flex-col items-center gap-2">
                <h3 className="arena-heading text-2xl leading-none">No Leagues Yet</h3>
                <p className="max-w-md text-center text-base font-semibold text-white/60">
                  Join or create a league to get a weekly matchup.
                </p>
              </div>
              <div className="flex w-full max-w-xs flex-col gap-3">
                <Button onClick={() => navigate(ROUTES.leagueJoin)} title="Join a League" />
                <Button
                  onClick={() => navigate(ROUTES.leagueCreate)}
                  title="Create a League"
                  variant="secondary"
                />
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {cards.map((card, index) => (
              <StaggeredItem className="h-full" index={index} key={card.league.id}>
                <CurrentWeekCard
                  card={card}
                  cosmeticsByUserId={cosmeticsByUserId}
                  userId={userId}
                />
              </StaggeredItem>
            ))}
          </div>
        )}
      </section>

      {h2hLeagues.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-black uppercase tracking-[0.14em] text-white/50">
              Your matchup history
            </h2>
            {h2hLeagues.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {h2hLeagues.map((card) => (
                  <button
                    className={cn(
                      'rounded-xl border px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] transition duration-150 ease-arena',
                      card.league.id === activeLeagueId
                        ? 'border-electric-green/50 bg-electric-green/15 text-electric-green'
                        : 'border-white/[0.1] bg-white/[0.04] text-white/55 hover:text-white',
                    )}
                    key={card.league.id}
                    onClick={() => setActiveLeagueId(card.league.id)}
                    type="button">
                    {card.league.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <MatchupHistory activeLeagueId={activeLeagueId} userId={userId} />
        </section>
      ) : null}
    </div>
  );
}
