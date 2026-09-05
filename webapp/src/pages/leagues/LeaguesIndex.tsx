import { Plus, Shield, Trophy, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Button, Card, Skeleton, StaggeredItem } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useMyLeagues, type LeagueSummary } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import { formatLeagueType, formatProfit, formatRecord, formatSport, getProfitTone } from '@/lib/format';
import { ROUTES, buildRoute } from '@/lib/routes';
import type { LeagueStatus } from '@/types/database';

const STATUS_LABELS: Record<LeagueStatus, string> = {
  active: 'Active',
  complete: 'Complete',
  drafting: 'Drafting',
  playoffs: 'Playoffs',
};

const STATUS_TONES: Record<LeagueStatus, 'gold' | 'green' | 'neutral'> = {
  active: 'green',
  complete: 'neutral',
  drafting: 'gold',
  playoffs: 'gold',
};

function LeagueCard({ item }: { item: LeagueSummary }) {
  const { currentUserStanding, league, memberCount } = item;
  const isH2H = league.type === 'h2h';
  const totalProfit = currentUserStanding?.total_profit ?? 0;

  return (
    <Link
      className="group block h-full rounded-2xl transition focus-visible:outline-none"
      to={buildRoute.league(league.id)}>
      <Card className="flex h-full flex-col gap-4 transition group-hover:border-electric-green/30">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-electric-green/30 bg-electric-green/10">
            <Shield aria-hidden className="h-5 w-5 text-electric-green" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 flex-1 text-xl font-black uppercase leading-tight text-white group-hover:text-electric-green">
                {league.name}
              </h2>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">
                  Roster
                </p>
                <p className="mt-1 text-base font-black text-white">
                  {memberCount}
                  <span className="text-white/40">/{league.max_members}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge label={formatLeagueType(league.type)} tone={isH2H ? 'cyan' : 'gold'} />
              <Badge label={formatSport(league.sport)} tone="green" />
              <Badge label={STATUS_LABELS[league.status]} tone={STATUS_TONES[league.status]} />
              <Badge label={`Week ${league.current_week}`} tone="neutral" />
            </div>
          </div>
        </div>

        <div className="h-px bg-white/[0.08]" />

        <div className="mt-auto flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">Rank</p>
            <p
              className={cn(
                'mt-1 text-3xl font-black',
                currentUserStanding?.rank === 1 ? 'text-gold' : 'text-white',
                !currentUserStanding?.rank && 'text-white/35',
              )}>
              {currentUserStanding?.rank ? `#${currentUserStanding.rank}` : '#—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">
              {isH2H ? 'Record' : 'Total Profit'}
            </p>
            <p
              className={cn(
                'mt-1 text-3xl font-black',
                isH2H ? 'text-white' : getProfitTone(totalProfit),
              )}>
              {isH2H
                ? formatRecord(
                    currentUserStanding?.wins ?? 0,
                    currentUserStanding?.losses ?? 0,
                    currentUserStanding?.ties ?? 0,
                  )
                : formatProfit(totalProfit)}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function LeagueSkeletons() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <Card className="flex flex-col gap-4" key={item}>
          <div className="flex items-center gap-3">
            <Skeleton height={48} radius={16} width={48} />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton height={20} width="65%" />
              <Skeleton height={14} width="38%" />
            </div>
          </div>
          <Skeleton height={70} radius={12} />
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-5 py-12 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-electric-green/20 bg-electric-green/5">
        <Trophy aria-hidden className="h-8 w-8 text-electric-green" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="arena-heading text-3xl leading-none">Your Arena Awaits</h2>
        <p className="max-w-md text-base font-semibold leading-snug text-white/65">
          Spin up a league for your crew or jump into a public room and start stacking profit.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link to={ROUTES.leagueCreate}>
          <Button icon={Plus} title="Create a League" />
        </Link>
        <Link to={ROUTES.leagueJoin}>
          <Button icon={UserPlus} title="Join with Code" variant="secondary" />
        </Link>
      </div>
    </Card>
  );
}

/** Port of app/(app)/(tabs)/leagues/index.tsx. Same data, desktop grid. */
export function LeaguesIndexPage() {
  const { user } = useAuth();
  const leaguesQuery = useMyLeagues(user?.id);
  const leagues = leaguesQuery.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-electric-green">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            The Arena
          </span>
          <h1 className="arena-heading mt-1 text-5xl leading-none">My Leagues</h1>
          <p className="mt-1.5 text-base font-medium text-white/60">
            Track your standings, matchups, and league rooms.
          </p>
        </div>

        <div className="flex gap-3">
          <Link to={ROUTES.leagueCreate}>
            <Button fullWidth={false} icon={Plus} title="Create" />
          </Link>
          <Link to={ROUTES.leagueJoin}>
            <Button fullWidth={false} icon={UserPlus} title="Join" variant="secondary" />
          </Link>
        </div>
      </header>

      {leaguesQuery.isLoading ? (
        <LeagueSkeletons />
      ) : leaguesQuery.isError ? (
        <Card>
          <p className="text-sm font-semibold text-coral-red">
            {leaguesQuery.error instanceof Error
              ? leaguesQuery.error.message
              : 'Could not load your leagues.'}
          </p>
        </Card>
      ) : leagues.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {leagues.map((item, index) => (
            <StaggeredItem className="h-full" index={index} key={item.league.id}>
              <LeagueCard item={item} />
            </StaggeredItem>
          ))}
        </div>
      )}
    </section>
  );
}
