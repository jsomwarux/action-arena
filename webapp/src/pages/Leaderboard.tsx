import { useEffect, useMemo, useRef, useState } from 'react';

import { ArrowDown, ArrowUp, ChevronsUpDown, Flame, Globe, Medal, Trophy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { CosmeticAvatar, TrophySkinIcon } from '@/components/cosmetics';
import { AnimatedNumber, LiveRefreshBadge, StaggeredItem } from '@/components/matchups';
import { Button, Card, SegmentedToggle, Skeleton, type SegmentedOption } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useEquippedCosmeticsForUsers } from '@/hooks/use-cosmetics';
import { type LeaderboardRow, useLeaderboardData } from '@/hooks/use-profile-stats';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { triggerAdHook } from '@/lib/ad-hooks';
import { cn } from '@/lib/cn';
import { formatProfit, formatRecord, getProfitTone } from '@/lib/format';
import {
  getLeagueMemberPrimaryName,
  getLeagueMemberSecondaryName,
} from '@/lib/league-member-display';
import { ROUTES, buildRoute } from '@/lib/routes';
import type { EquippedCosmeticsByCategory } from '@/types/database';

type BoardView = 'season' | 'week';
type SortKey = 'rank' | 'team' | 'record' | 'weekly' | 'total';
type SortDirection = 'asc' | 'desc';
type LeaderboardTrend = Exclude<LeaderboardRow['seasonTrend'], null>;

const BOARD_VIEW_OPTIONS: SegmentedOption<BoardView>[] = [
  { icon: Globe, label: 'Season', value: 'season' },
  { icon: Flame, label: 'This Week', value: 'week' },
];

const BRONZE_COLOR = '#CD7F32';
const SILVER_COLOR = '#C0C0C0';

/**
 * Podium treatment straight off the theme tokens: gold, silver, bronze.
 * Everything below third place is deliberately neutral so the top three read
 * instantly on a wide table.
 */
function rankAccent(rank: number) {
  if (rank === 1) {
    return {
      bg: 'bg-gold/15',
      border: 'border-gold/55',
      glow: THEME_COLORS.gold,
      iconColor: THEME_COLORS.gold,
      label: 'Gold',
      text: 'text-gold',
    };
  }
  if (rank === 2) {
    return {
      bg: 'bg-silver/[0.14]',
      border: 'border-silver/50',
      glow: SILVER_COLOR,
      iconColor: SILVER_COLOR,
      label: 'Silver',
      text: 'text-silver-text',
    };
  }
  if (rank === 3) {
    return {
      bg: 'bg-bronze/15',
      border: 'border-bronze/55',
      glow: BRONZE_COLOR,
      iconColor: BRONZE_COLOR,
      label: 'Bronze',
      text: 'text-bronze-text',
    };
  }
  return {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.08]',
    glow: null,
    iconColor: 'rgba(255,255,255,0.55)',
    label: '—',
    text: 'text-white/65',
  };
}

function trendDescriptor(trend: LeaderboardTrend) {
  if (trend === 'up') {
    return {
      className: 'border-electric-green/40 bg-electric-green/15 text-electric-green',
      Icon: ArrowUp,
      label: 'Up',
    };
  }

  return {
    className: 'border-coral-red/40 bg-coral-red/15 text-coral-red',
    Icon: ArrowDown,
    label: 'Down',
  };
}

function valueForRow(row: LeaderboardRow, boardView: BoardView) {
  return boardView === 'week' ? row.weeklyProfit : row.seasonProfit;
}

function rankForRow(row: LeaderboardRow, boardView: BoardView) {
  return boardView === 'week' ? row.weeklyRank : row.seasonRank;
}

function trendForRow(row: LeaderboardRow, boardView: BoardView) {
  return boardView === 'week' ? row.weeklyTrend : row.seasonTrend;
}

function RankMedal({ rank, size = 'md' }: { rank: number; size?: 'md' | 'lg' }) {
  const accent = rankAccent(rank);
  const box = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const iconSize = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const Icon = rank === 1 ? Trophy : Medal;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl border',
        box,
        accent.bg,
        accent.border,
      )}
      style={accent.glow ? { boxShadow: `0 0 8px ${accent.glow}66` } : undefined}>
      {rank <= 3 ? (
        <Icon aria-hidden className={iconSize} style={{ color: accent.iconColor }} />
      ) : (
        <span className={cn('text-sm font-black', accent.text)}>{rank}</span>
      )}
    </span>
  );
}

function PodiumCard({
  cosmetics,
  featured = false,
  isUser,
  rank,
  row,
  to,
  trend,
  value,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  featured?: boolean;
  isUser: boolean;
  rank: number;
  row: LeaderboardRow;
  to: string;
  trend: LeaderboardTrend | null;
  value: number;
}) {
  const accent = rankAccent(rank);
  const trendMeta = trend ? trendDescriptor(trend) : null;
  const displayName = getLeagueMemberPrimaryName(row.member, row.profile, 'Player');

  return (
    <Link
      className={cn(
        'flex flex-col items-center rounded-2xl border transition duration-150 ease-arena',
        'hover:-translate-y-0.5 hover:brightness-110',
        featured ? 'p-6' : 'p-5',
        accent.bg,
        accent.border,
      )}
      style={{
        boxShadow: accent.glow
          ? `0 0 ${featured ? 22 : 12}px ${accent.glow}${featured ? '8c' : '4d'}`
          : undefined,
        minHeight: featured ? 232 : 200,
      }}
      to={to}>
      {rank === 1 ? (
        <TrophySkinIcon cosmetics={cosmetics} size={featured ? 22 : 16} />
      ) : (
        <RankMedal rank={rank} size={featured ? 'lg' : 'md'} />
      )}

      <span className="mt-3">
        <CosmeticAvatar cosmetics={cosmetics} name={displayName} size={featured ? 'lg' : 'md'} />
      </span>

      <span
        className={cn(
          'mt-3 w-full truncate text-center font-black text-white',
          featured ? 'text-lg' : 'text-base',
        )}>
        {displayName}
      </span>

      <span className={cn('mt-0.5 text-[11px] font-black uppercase tracking-[1.4px]', accent.text)}>
        {accent.label}
      </span>

      <span className="mt-2 flex items-center gap-1.5">
        {trendMeta ? <trendMeta.Icon aria-hidden className="h-3.5 w-3.5" /> : null}
        <AnimatedNumber
          className={cn(
            'font-black tabular-nums tracking-[-0.2px]',
            featured ? 'text-2xl' : 'text-xl',
            getProfitTone(value),
          )}
          formatter={formatProfit}
          value={value}
        />
      </span>

      {isUser ? (
        <span className="mt-2 rounded-full border border-electric-green/40 bg-electric-green/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[1.2px] text-electric-green">
          You
        </span>
      ) : null}
    </Link>
  );
}

function SortableHeader({
  activeKey,
  align = 'left',
  direction,
  label,
  onSort,
  sortKey,
}: {
  activeKey: SortKey;
  align?: 'left' | 'right';
  direction: SortDirection;
  label: string;
  onSort: (key: SortKey) => void;
  sortKey: SortKey;
}) {
  const isActive = activeKey === sortKey;
  const Icon = !isActive ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[1.2px] transition',
        align === 'right' && 'justify-end',
        isActive ? 'text-electric-green' : 'text-white/50 hover:text-white/80',
      )}
      onClick={() => onSort(sortKey)}
      type="button">
      {label}
      <Icon aria-hidden className="h-3 w-3" />
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton height={44} radius={16} />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((item) => (
          <Skeleton height={200} key={item} radius={20} />
        ))}
      </div>
      <Skeleton height={320} radius={20} />
    </div>
  );
}

/**
 * Desktop leaderboard.
 *
 * Same data and same podium language as app/(app)/(tabs)/leaderboard.tsx; the
 * list becomes a sortable table because a desktop screen can show rank, record,
 * weekly profit and total profit at once instead of one metric at a time.
 * The Season / This Week toggle still decides which rank and trend the rank
 * column reports, exactly as it does on mobile.
 */
export function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | undefined>();
  const [boardView, setBoardView] = useState<BoardView>('season');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const leaderboardQuery = useLeaderboardData(userId, selectedLeagueId);
  const seasonPassQuery = useSeasonPass(userId);
  const adHookTriggered = useRef(false);
  const leagues = useMemo(() => leaderboardQuery.data?.leagues ?? [], [leaderboardQuery.data]);
  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0] ?? null,
    [leagues, selectedLeagueId],
  );
  const isH2H = selectedLeague?.type === 'h2h';

  const rows = useMemo(() => leaderboardQuery.data?.rows ?? [], [leaderboardQuery.data]);
  const cosmeticsQuery = useEquippedCosmeticsForUsers(rows.map((row) => row.member.user_id));
  const cosmeticsByUserId = cosmeticsQuery.data ?? {};

  // Mirrors the mobile screen: one banner placement, fired once per visit.
  useEffect(() => {
    if (adHookTriggered.current || leaderboardQuery.isLoading || seasonPassQuery.isLoading) {
      return;
    }

    adHookTriggered.current = true;
    triggerAdHook({
      isSeasonPassHolder: Boolean(seasonPassQuery.data),
      placement: 'leaderboard_banner',
      userId,
    });
  }, [leaderboardQuery.isLoading, seasonPassQuery.data, seasonPassQuery.isLoading, userId]);

  const podiumRows = useMemo(
    () =>
      [...rows]
        .sort((left, right) => rankForRow(left, boardView) - rankForRow(right, boardView))
        .slice(0, 3),
    [boardView, rows],
  );

  const sortedRows = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    const compare = (left: LeaderboardRow, right: LeaderboardRow) => {
      if (sortKey === 'team') {
        return getLeagueMemberPrimaryName(left.member, left.profile, 'Player').localeCompare(
          getLeagueMemberPrimaryName(right.member, right.profile, 'Player'),
        );
      }
      if (sortKey === 'record') {
        return (left.standing?.wins ?? 0) - (right.standing?.wins ?? 0);
      }
      if (sortKey === 'weekly') {
        return left.weeklyProfit - right.weeklyProfit;
      }
      if (sortKey === 'total') {
        return left.seasonProfit - right.seasonProfit;
      }
      return rankForRow(left, boardView) - rankForRow(right, boardView);
    };

    return [...rows].sort((left, right) => {
      const result = compare(left, right) * direction;
      // Rank is the stable tiebreaker so equal profits never shuffle between
      // renders while a week is settling.
      return result !== 0 ? result : rankForRow(left, boardView) - rankForRow(right, boardView);
    });
  }, [boardView, rows, sortDirection, sortKey]);

  const hasResults = rows.some(
    (row) => row.standing || row.seasonProfit !== 0 || row.weeklyProfit !== 0,
  );

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    // Rank and team read best ascending; money reads best highest-first.
    setSortDirection(key === 'rank' || key === 'team' ? 'asc' : 'desc');
  };

  const memberRoute = (row: LeaderboardRow) =>
    `${buildRoute.member(row.member.user_id)}?leagueId=${row.member.league_id}`;

  // Fixed columns for everything countable, the rest to the team name. The
  // wrapper below scrolls horizontally rather than letting those fixed columns
  // crush the name — at 1000px the name column was collapsing to ~4rem and the
  // "You" badge was landing on top of the record.
  const gridTemplate = isH2H
    ? 'grid-cols-[4.5rem_minmax(10rem,1fr)_6rem_8rem_8rem]'
    : 'grid-cols-[4.5rem_minmax(10rem,1fr)_8rem_8rem]';
  const tableMinWidth = isH2H ? 'min-w-[46rem]' : 'min-w-[40rem]';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            <span className="text-xs font-black uppercase tracking-[0.14em] text-electric-green">
              League Ladder
            </span>
          </div>
          <h1 className="arena-heading text-5xl leading-none">Leaderboard</h1>
          <p className="text-textMuted">
            Profit, records, and weekly movement across your league.
          </p>
        </div>
        <LiveRefreshBadge
          isLive={false}
          isRefreshing={leaderboardQuery.isRefetching}
          lastRefreshedAt={leaderboardQuery.dataUpdatedAt || Date.now()}
          onRefresh={() => void leaderboardQuery.refetch()}
        />
      </header>

      {leaderboardQuery.isLoading ? <LoadingState /> : null}

      {!leaderboardQuery.isLoading && rows.length > 0 ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {leagues.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {leagues.map((league) => (
                  <button
                    className={cn(
                      'rounded-xl border px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] transition duration-150 ease-arena',
                      league.id === selectedLeague?.id
                        ? 'border-electric-green/50 bg-electric-green/15 text-electric-green'
                        : 'border-white/[0.1] bg-white/[0.04] text-white/55 hover:text-white',
                    )}
                    key={league.id}
                    onClick={() => setSelectedLeagueId(league.id)}
                    type="button">
                    {league.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm font-bold text-white/60">{selectedLeague?.name}</p>
            )}
            <div className="w-64">
              <SegmentedToggle
                accent="green"
                compact
                onChange={setBoardView}
                options={BOARD_VIEW_OPTIONS}
                value={boardView}
              />
            </div>
          </div>

          {!hasResults ? (
            <Card className="p-8">
              <div className="flex flex-col items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10">
                  <Trophy aria-hidden className="h-6 w-6 text-cyan-accent" />
                </span>
                <h2 className="arena-heading text-2xl leading-none">No Results Yet</h2>
                <p className="max-w-md text-center text-sm font-semibold leading-5 text-white/55">
                  Settled weeks will appear here once league cards resolve.
                </p>
              </div>
            </Card>
          ) : null}

          {hasResults && podiumRows.length >= 3 ? (
            <div className="grid grid-cols-3 items-end gap-4">
              {/* Silver left, gold raised in the middle, bronze right. */}
              <div className="pb-5">
                <PodiumCard
                  cosmetics={cosmeticsByUserId[podiumRows[1].member.user_id]}
                  isUser={podiumRows[1].member.user_id === userId}
                  rank={rankForRow(podiumRows[1], boardView)}
                  row={podiumRows[1]}
                  to={memberRoute(podiumRows[1])}
                  trend={trendForRow(podiumRows[1], boardView)}
                  value={valueForRow(podiumRows[1], boardView)}
                />
              </div>
              <PodiumCard
                cosmetics={cosmeticsByUserId[podiumRows[0].member.user_id]}
                featured
                isUser={podiumRows[0].member.user_id === userId}
                rank={rankForRow(podiumRows[0], boardView)}
                row={podiumRows[0]}
                to={memberRoute(podiumRows[0])}
                trend={trendForRow(podiumRows[0], boardView)}
                value={valueForRow(podiumRows[0], boardView)}
              />
              <div className="pb-5">
                <PodiumCard
                  cosmetics={cosmeticsByUserId[podiumRows[2].member.user_id]}
                  isUser={podiumRows[2].member.user_id === userId}
                  rank={rankForRow(podiumRows[2], boardView)}
                  row={podiumRows[2]}
                  to={memberRoute(podiumRows[2])}
                  trend={trendForRow(podiumRows[2], boardView)}
                  value={valueForRow(podiumRows[2], boardView)}
                />
              </div>
            </div>
          ) : null}

          {hasResults ? (
            <Card className="overflow-hidden" padded={false}>
              <div className="overflow-x-auto">
              <div className={tableMinWidth}>
              <div
                className={cn(
                  'grid items-center gap-4 border-b border-white/[0.08] px-5 py-3',
                  gridTemplate,
                )}>
                <SortableHeader
                  activeKey={sortKey}
                  direction={sortDirection}
                  label="Rank"
                  onSort={handleSort}
                  sortKey="rank"
                />
                <SortableHeader
                  activeKey={sortKey}
                  direction={sortDirection}
                  label="Team"
                  onSort={handleSort}
                  sortKey="team"
                />
                {isH2H ? (
                  <SortableHeader
                    activeKey={sortKey}
                    direction={sortDirection}
                    label="Record"
                    onSort={handleSort}
                    sortKey="record"
                  />
                ) : null}
                <SortableHeader
                  activeKey={sortKey}
                  align="right"
                  direction={sortDirection}
                  label="This week"
                  onSort={handleSort}
                  sortKey="weekly"
                />
                <SortableHeader
                  activeKey={sortKey}
                  align="right"
                  direction={sortDirection}
                  label="Total"
                  onSort={handleSort}
                  sortKey="total"
                />
              </div>

              {sortedRows.map((row, index) => {
                const isUser = row.member.user_id === userId;
                const displayName = getLeagueMemberPrimaryName(row.member, row.profile, 'Player');
                const secondaryName = getLeagueMemberSecondaryName(row.member, row.profile);
                const rank = rankForRow(row, boardView);
                const trend = trendForRow(row, boardView);
                const trendMeta = trend ? trendDescriptor(trend) : null;

                return (
                  <StaggeredItem index={index} key={row.member.id} perItemDelay={35}>
                    <Link
                      className={cn(
                        'grid items-center gap-4 px-5 py-3.5 transition duration-150 ease-arena',
                        gridTemplate,
                        index > 0 && 'border-t border-white/[0.05]',
                        isUser
                          ? 'border-l-[3px] border-l-electric-green bg-electric-green/[0.10] hover:bg-electric-green/[0.16]'
                          : 'hover:bg-white/[0.05]',
                      )}
                      to={memberRoute(row)}>
                      <span className="flex items-center gap-2">
                        <RankMedal rank={rank} />
                        {trendMeta ? (
                          <span
                            className={cn(
                              'flex items-center gap-0.5 rounded-full border px-1.5 py-px',
                              trendMeta.className,
                            )}
                            title={`${trendMeta.label} from last week`}>
                            <trendMeta.Icon aria-hidden className="h-2.5 w-2.5" />
                          </span>
                        ) : null}
                      </span>

                      <span className="flex min-w-0 items-center gap-3">
                        <CosmeticAvatar
                          cosmetics={cosmeticsByUserId[row.member.user_id]}
                          name={displayName}
                          size="sm"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                            <span className="truncate text-base font-bold tracking-[-0.2px] text-white">
                              {displayName}
                            </span>
                            {isUser ? (
                              <span className="shrink-0 rounded-full border border-electric-green/40 bg-electric-green/15 px-2 py-[1px] text-[9px] font-black uppercase tracking-[1.2px] text-electric-green">
                                You
                              </span>
                            ) : null}
                          </span>
                          {secondaryName ? (
                            <span className="truncate text-xs font-medium text-white/45">
                              {secondaryName}
                            </span>
                          ) : null}
                        </span>
                      </span>

                      {isH2H ? (
                        <span className="text-sm font-bold tabular-nums text-white/70">
                          {row.standing
                            ? formatRecord(
                                row.standing.wins,
                                row.standing.losses,
                                row.standing.ties,
                              )
                            : '0-0'}
                        </span>
                      ) : null}

                      <AnimatedNumber
                        className={cn(
                          'text-right text-sm font-black tabular-nums',
                          getProfitTone(row.weeklyProfit),
                        )}
                        formatter={formatProfit}
                        value={row.weeklyProfit}
                      />
                      <AnimatedNumber
                        className={cn(
                          'text-right text-sm font-black tabular-nums',
                          getProfitTone(row.seasonProfit),
                        )}
                        formatter={formatProfit}
                        value={row.seasonProfit}
                      />
                    </Link>
                  </StaggeredItem>
                );
              })}
              </div>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {!leaderboardQuery.isLoading && rows.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-5">
            <span className="flex h-20 w-20 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
              <Trophy aria-hidden className="h-9 w-9 text-electric-green" />
            </span>
            <div className="flex flex-col items-center gap-2.5">
              <h2 className="arena-heading text-3xl leading-none">No Standings Yet</h2>
              <p className="max-w-lg text-center text-base font-semibold leading-snug text-white/65">
                Join a league to start climbing the ladder and stacking profit on the board.
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
      ) : null}
    </div>
  );
}
