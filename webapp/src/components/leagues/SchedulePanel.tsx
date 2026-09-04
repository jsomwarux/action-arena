import { useMemo } from 'react';

import { CalendarClock, ChevronRight, Hourglass, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card } from '@/components/ui';
import type { LeagueDetail } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import { formatProfit, getProfitTone } from '@/lib/format';
import { getLeagueMemberPrimaryName } from '@/lib/league-member-display';
import { buildRoute } from '@/lib/routes';
import type { WeeklyMatchupRow } from '@/types/database';


const PLAYOFF_PLACEHOLDER_WEEKS = [15, 16, 17];

function weekLabel(weekNumber: number) {
  if (weekNumber === 17) return 'Championship';
  if (weekNumber === 16) return 'Semifinals';
  if (weekNumber === 15) return 'Playoff Round 1';
  return `Week ${weekNumber}`;
}

function MatchupRow({
  detail,
  matchup,
  userId,
}: {
  detail: LeagueDetail;
  matchup: WeeklyMatchupRow;
  userId: string;
}) {
  const nameFor = (id: string | null) => {
    if (!id) return 'Bye Week';
    const member = detail.members.find((row) => row.user_id === id);
    return getLeagueMemberPrimaryName(member, detail.profilesById[id], 'Unknown Player');
  };

  const isMine = matchup.home_user_id === userId || matchup.away_user_id === userId;
  const isSettled = matchup.home_profit !== null || matchup.away_profit !== null;

  const side = (id: string | null, profit: number | null, alignEnd: boolean) => (
    <span className={cn('flex min-w-0 flex-1 flex-col', alignEnd && 'items-end text-right')}>
      <span
        className={cn(
          'truncate text-sm font-black',
          matchup.winner_id && matchup.winner_id === id ? 'text-electric-green' : 'text-white',
        )}>
        {nameFor(id)}
      </span>
      {isSettled ? (
        <span className={cn('text-[11px] font-black', getProfitTone(profit ?? 0))}>
          {formatProfit(profit ?? 0)}
        </span>
      ) : null}
    </span>
  );

  return (
    <Link
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition',
        isMine
          ? 'border-electric-green/30 bg-electric-green/[0.06] hover:bg-electric-green/[0.1]'
          : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]',
      )}
      to={buildRoute.matchup(matchup.id)}>
      {side(matchup.home_user_id, matchup.home_profit, false)}
      <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
        vs
      </span>
      {side(matchup.away_user_id, matchup.away_profit, true)}
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/30" />
    </Link>
  );
}

/**
 * Port of the mobile hub's Schedule tab, minus its Start Season button.
 *
 * On desktop the commissioner's controls live in one place — the League
 * Settings panel beside this one — so the empty state here only explains what
 * the league is waiting on. Mobile has to fold the button in here because the
 * schedule tab is the only screen that shows it.
 */
export function SchedulePanel({ detail, userId }: { detail: LeagueDetail; userId: string }) {
  const matchupsByWeek = useMemo(() => {
    const grouped = detail.matchups.reduce<Record<number, WeeklyMatchupRow[]>>(
      (accumulator, matchup) => {
        accumulator[matchup.week_number] = accumulator[matchup.week_number] ?? [];
        accumulator[matchup.week_number].push(matchup);
        return accumulator;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([weekNumber, matchups]) => ({ matchups, weekNumber: Number(weekNumber) }))
      .sort((left, right) => left.weekNumber - right.weekNumber);
  }, [detail.matchups]);

  if (detail.league.type !== 'h2h') {
    return (
      <Card className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          <CalendarClock aria-hidden className="h-5 w-5 text-gold" />
        </span>
        <h3 className="arena-heading text-xl leading-none">No Weekly Matchups</h3>
        <p className="max-w-xs text-sm font-semibold leading-5 text-white/55">
          Cumulative leagues have no opponents. The highest total profit across the season wins.
        </p>
      </Card>
    );
  }

  if (detail.matchups.length === 0) {
    const memberCount = detail.members.length;
    const isCommissioner = detail.league.commissioner_id === userId;
    const hasEnoughPlayers = memberCount >= 2;

    const title = !hasEnoughPlayers
      ? 'Waiting on Players'
      : isCommissioner
        ? 'Ready When You Are'
        : 'Waiting on the Commissioner';
    const body = !hasEnoughPlayers
      ? isCommissioner
        ? 'You need at least 2 players to start. Share the invite code to bring more friends in.'
        : 'The league needs at least one more player before the season can begin.'
      : isCommissioner
        ? 'Start the season from League Settings and the full schedule drops here.'
        : 'More players are joining, or the commissioner is getting ready to start the season. Sit tight.';

    return (
      <Card className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
          <Hourglass aria-hidden className="h-6 w-6 text-white/70" />
        </span>
        <div className="flex flex-col gap-2">
          <h3 className="arena-heading text-xl leading-none">{title}</h3>
          <p className="max-w-xs text-sm font-semibold leading-5 text-white/60">{body}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white/65">
          <Users aria-hidden className="h-3 w-3" />
          {memberCount} / {detail.league.max_members} players
        </span>
      </Card>
    );
  }

  const placeholderWeeks = PLAYOFF_PLACEHOLDER_WEEKS.filter(
    (weekNumber) => !matchupsByWeek.some((week) => week.weekNumber === weekNumber),
  );

  return (
    <Card className="flex h-full flex-col gap-4 overflow-hidden">
      <header className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-electric-green">
          Season Schedule
        </p>
        <Badge label={`${detail.matchups.length} matchups`} tone="neutral" />
      </header>

      <div className="flex max-h-[26rem] flex-col gap-5 overflow-y-auto pr-1">
        {matchupsByWeek.map(({ matchups, weekNumber }) => (
          <section className="flex flex-col gap-2.5" key={weekNumber}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-[10px] font-black uppercase tracking-[0.18em]',
                  weekNumber === detail.league.current_week
                    ? 'text-electric-green'
                    : 'text-white/45',
                )}>
                {weekLabel(weekNumber)}
              </span>
              {weekNumber === detail.league.current_week ? (
                <Badge label="Current" tone="green" />
              ) : null}
            </div>
            {matchups.map((matchup) => (
              <MatchupRow detail={detail} key={matchup.id} matchup={matchup} userId={userId} />
            ))}
          </section>
        ))}

        {placeholderWeeks.map((weekNumber) => (
          <section className="flex flex-col gap-2.5" key={`placeholder-${String(weekNumber)}`}>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
              {weekLabel(weekNumber)}
            </span>
            <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs font-semibold text-white/45">
              Seeded from the regular-season standings once Week 14 settles.
            </p>
          </section>
        ))}
      </div>
    </Card>
  );
}
