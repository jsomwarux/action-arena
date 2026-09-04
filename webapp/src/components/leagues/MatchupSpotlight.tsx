import { ArrowRight, User, UserMinus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatProfit, getProfitTone } from '@/lib/format';
import { buildRoute } from '@/lib/routes';
import type { LeagueType } from '@/types/database';

import { Badge } from './Badge';

/**
 * The head-to-head strip from mobile's home card and the hub's fight card,
 * reduced to the pieces both screens share: who you are in this league, who you
 * are playing, and the way through to the full matchup.
 */
export function MatchupSpotlight({
  className,
  leagueType,
  matchupId,
  memberCount,
  opponentLabel,
  opponentSecondaryLabel,
  viewerLabel,
  viewerSecondaryLabel,
  weekNumber,
  weeklyProfit,
}: {
  className?: string;
  leagueType: LeagueType;
  matchupId: string | null;
  memberCount: number;
  opponentLabel: string;
  opponentSecondaryLabel?: string | null;
  viewerLabel: string;
  viewerSecondaryLabel?: string | null;
  weekNumber: number;
  weeklyProfit: number;
}) {
  const isH2H = leagueType === 'h2h';

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={isH2H ? 'Head-to-Head' : 'Cumulative'} tone={isH2H ? 'cyan' : 'gold'} />
          <Badge label={`Week ${weekNumber}`} tone="green" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
            Week profit
          </p>
          <p className={cn('text-2xl font-black', getProfitTone(weeklyProfit))}>
            {formatProfit(weeklyProfit)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-electric-green/45 bg-electric-green/15">
          <User aria-hidden className="h-4 w-4 text-electric-green" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">You</p>
          <p className="truncate text-sm font-black text-white">{viewerLabel}</p>
          {viewerSecondaryLabel ? (
            <p className="truncate text-[11px] font-semibold text-white/45">
              {viewerSecondaryLabel}
            </p>
          ) : null}
        </div>

        {isH2H ? (
          <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-[10px] font-black text-gold">
              VS
            </span>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                Opponent
              </p>
              <p className="truncate text-sm font-black text-white">{opponentLabel}</p>
              {opponentSecondaryLabel ? (
                <p className="truncate text-[11px] font-semibold text-white/45">
                  {opponentSecondaryLabel}
                </p>
              ) : null}
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-coral-red/35 bg-coral-red/10">
              <UserMinus aria-hidden className="h-4 w-4 text-coral-red" />
            </span>
          </>
        ) : (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
              Field
            </p>
            <p className="inline-flex items-center gap-1.5 text-sm font-black text-white">
              <Users aria-hidden className="h-4 w-4 text-white/45" />
              {memberCount} players
            </p>
          </div>
        )}
      </div>
    </>
  );

  if (!matchupId) {
    return <Card className={cn('flex flex-col gap-4', className)}>{body}</Card>;
  }

  return (
    <Card className={cn('flex flex-col gap-4 transition hover:border-white/20', className)}>
      {body}
      <Link
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-electric-green/45 bg-electric-green/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-electric-green transition hover:bg-electric-green/20"
        to={buildRoute.matchup(matchupId)}>
        Open Matchup
        <ArrowRight aria-hidden className="h-3 w-3" />
      </Link>
    </Card>
  );
}
