import { ChevronRight, ShieldCheck, ShieldX, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card, StaggeredItem } from '@/components/ui';
import type { LeagueDetail } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import { formatProfit, formatRecord, getProfitTone } from '@/lib/format';
import {
  getLeagueMemberPrimaryName,
  getLeagueMemberSecondaryName,
} from '@/lib/league-member-display';
import { buildRoute } from '@/lib/routes';
import type { EquippedCosmeticsByCategory, StandingRow } from '@/types/database';

import { TrophySkinIcon } from '@/components/cosmetics';

export type PlayoffStatus = 'clinched' | 'eliminated' | null;

function rankAccent(rank: number) {
  if (rank === 1) {
    return { bg: 'bg-gold/15', ring: 'border-gold/60', text: 'text-gold' };
  }
  if (rank === 2) {
    return { bg: 'bg-silver/20', ring: 'border-silver/60', text: 'text-silver-text' };
  }
  if (rank === 3) {
    return { bg: 'bg-bronze/20', ring: 'border-bronze/60', text: 'text-bronze-text' };
  }
  return { bg: 'bg-white/[0.04]', ring: 'border-white/10', text: 'text-white/70' };
}

/** Same clinch/elimination maths as the mobile hub. */
export function playoffStatusForStanding(detail: LeagueDetail, standing: StandingRow): PlayoffStatus {
  if (detail.league.type !== 'h2h' || detail.standings.length < 2) {
    return null;
  }

  const playoffSpots = Math.min(8, detail.standings.length);
  const viewedWeek = standing.week_number;

  if (viewedWeek > 14) {
    return standing.rank <= playoffSpots ? 'clinched' : 'eliminated';
  }

  const remainingWeeks = Math.max(0, 14 - viewedWeek);

  if (viewedWeek < 8) {
    return null;
  }

  const outsideMaxWins = Math.max(
    ...detail.standings
      .filter((row) => row.rank > playoffSpots)
      .map((row) => row.wins + remainingWeeks),
    -1,
  );
  const cutoffWins = detail.standings[playoffSpots - 1]?.wins ?? 0;

  if (standing.rank <= playoffSpots && standing.wins > outsideMaxWins) {
    return 'clinched';
  }

  if (standing.rank > playoffSpots && standing.wins + remainingWeeks < cutoffWins) {
    return 'eliminated';
  }

  return null;
}

function PlayoffStatusIcon({ status }: { status: PlayoffStatus }) {
  if (!status) {
    return null;
  }

  const isClinched = status === 'clinched';
  const Icon = isClinched ? ShieldCheck : ShieldX;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-[2px]',
        'text-[9px] font-black uppercase tracking-[0.1em]',
        isClinched
          ? 'border-electric-green/40 bg-electric-green/10 text-electric-green'
          : 'border-coral-red/40 bg-coral-red/10 text-coral-red',
      )}
      title={isClinched ? 'Clinched a playoff spot' : 'Eliminated from playoff contention'}>
      <Icon aria-hidden className="h-3 w-3" />
      {isClinched ? 'In' : 'Out'}
    </span>
  );
}

/**
 * Port of the mobile hub's StandingsBoard.
 *
 * `detail` is the week-scoped view of the league (standings already filtered to
 * the snapshot week), exactly as the mobile screen passes it in.
 */
export function StandingsBoard({
  cosmeticsByUserId,
  detail,
  hasSeasonStandings,
  leagueId,
  selectedWeekNumber,
  selectedWeekSettled,
  standingsWeekNumber,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  hasSeasonStandings: boolean;
  leagueId: string;
  selectedWeekNumber: number;
  selectedWeekSettled: boolean;
  standingsWeekNumber: number | null;
  userId: string;
}) {
  const isH2H = detail.league.type === 'h2h';

  if (detail.standings.length === 0) {
    const isFutureWeek = selectedWeekNumber > detail.league.current_week;
    const isPastWeek = selectedWeekNumber < detail.league.current_week;
    const title = hasSeasonStandings
      ? isFutureWeek
        ? `Week ${selectedWeekNumber} Standings Pending`
        : `No Week ${selectedWeekNumber} Snapshot`
      : 'Standings Coming Soon';
    const description = hasSeasonStandings
      ? isPastWeek
        ? 'This league does not have a saved standings row for that completed week yet.'
        : 'Cumulative standings will update here once this week is played.'
      : 'Season standings will appear once the first week is settled.';

    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
          <BarChart3 aria-hidden className="h-5 w-5 text-white/60" />
        </span>
        <h3 className="arena-heading text-xl leading-none">{title}</h3>
        <p className="max-w-sm text-sm font-semibold leading-5 text-white/55">{description}</p>
      </Card>
    );
  }

  const resolvedStandingsWeekNumber = standingsWeekNumber ?? selectedWeekNumber;
  const badgeLabel =
    detail.league.status === 'complete' && resolvedStandingsWeekNumber === detail.league.current_week
      ? 'Final'
      : selectedWeekSettled && resolvedStandingsWeekNumber === selectedWeekNumber
        ? 'Final'
        : resolvedStandingsWeekNumber === selectedWeekNumber
          ? selectedWeekNumber === detail.league.current_week
            ? 'Live'
            : 'Snapshot'
          : 'Latest';

  return (
    <Card className="overflow-hidden" padded={false}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <p className="arena-eyebrow text-electric-green">
          Standings Through Week {resolvedStandingsWeekNumber}
        </p>
        <Badge label={badgeLabel} tone={badgeLabel === 'Live' ? 'green' : 'gold'} />
      </div>

      <div className="flex items-center gap-3 px-5 pb-3 pt-5 text-[10px] font-black uppercase tracking-[0.15em] text-white/40">
        <span className="w-10">Rank</span>
        <span className="flex-1">Team</span>
        <span>{isH2H ? 'Record' : 'Profit'}</span>
      </div>
      <div className="h-px bg-white/[0.08]" />

      <ul>
        {detail.standings.map((standing, index) => {
          const accent = rankAccent(standing.rank);
          const isCurrentUser = standing.user_id === userId;
          const lastRow = index === detail.standings.length - 1;
          const member = detail.members.find((row) => row.user_id === standing.user_id);
          const profile = detail.profilesById[standing.user_id];
          const primaryName = getLeagueMemberPrimaryName(member, profile, 'Unknown Player');
          const secondaryName = getLeagueMemberSecondaryName(member, profile);
          const standingSummary = isH2H
            ? `Season ${formatProfit(standing.total_profit)} · Week ${standing.week_number} ${formatProfit(standing.weekly_profit)}`
            : `Week ${standing.week_number} ${formatProfit(standing.weekly_profit)}`;

          return (
            <StaggeredItem index={index} key={standing.id} perItemDelay={35}>
              <li>
                <Link
                  className={cn(
                    'flex items-center gap-3 px-5 py-4 transition duration-150 ease-arena',
                    isCurrentUser
                      ? 'border-l-[3px] border-l-electric-green bg-electric-green/[0.06] hover:bg-electric-green/[0.12]'
                      : 'hover:bg-white/[0.07]',
                    !lastRow && 'border-b border-white/[0.05]',
                  )}
                  state={{ leagueId }}
                  to={buildRoute.member(standing.user_id)}>
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                      accent.bg,
                      accent.ring,
                    )}>
                    {standing.rank === 1 ? (
                      <TrophySkinIcon cosmetics={cosmeticsByUserId[standing.user_id]} size={14} />
                    ) : (
                      <span className={cn('text-sm font-black', accent.text)}>{standing.rank}</span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-black text-white">
                        {primaryName}
                      </span>
                      {isCurrentUser ? (
                        <span className="rounded-full border border-electric-green/40 bg-electric-green/15 px-2 py-[2px] text-[9px] font-black uppercase tracking-[0.1em] text-electric-green">
                          You
                        </span>
                      ) : null}
                      <PlayoffStatusIcon status={playoffStatusForStanding(detail, standing)} />
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-semibold text-white/45">
                      {secondaryName ? `${secondaryName} · ${standingSummary}` : standingSummary}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        'text-base font-black',
                        isH2H ? 'text-white' : getProfitTone(standing.total_profit),
                      )}>
                      {isH2H
                        ? formatRecord(standing.wins, standing.losses, standing.ties)
                        : formatProfit(standing.total_profit)}
                    </span>
                    <ChevronRight aria-hidden className="h-4 w-4 text-white/35" />
                  </span>
                </Link>
              </li>
            </StaggeredItem>
          );
        })}
      </ul>
    </Card>
  );
}
