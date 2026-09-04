import { Flame, Lock, Trophy, type LucideIcon } from 'lucide-react';

import { Badge, Card } from '@/components/ui';
import type { WeeklyAward, WeeklyAwards } from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import { formatAmericanOdds, formatCurrency, formatProfit, getProfitTone } from '@/lib/format';
import { formatPickTitle } from '@/lib/pick-labels';


type AwardKind = 'coldStreak' | 'lock' | 'sharpest';

const AWARD_THEME: Record<
  AwardKind,
  { bar: string; bg: string; border: string; icon: LucideIcon; subtitle: string; text: string; title: string }
> = {
  coldStreak: {
    bar: 'bg-coral-red/55',
    bg: 'bg-coral-red/[0.07]',
    border: 'border-coral-red/35',
    icon: Flame,
    subtitle: 'A tough week with plenty of room for a comeback.',
    text: 'text-coral-red',
    title: 'Cold Streak',
  },
  lock: {
    bar: 'bg-electric-green',
    bg: 'bg-electric-green/[0.08]',
    border: 'border-electric-green/40',
    icon: Lock,
    subtitle: 'Biggest single profit of the week.',
    text: 'text-electric-green',
    title: 'Pick of the Week',
  },
  sharpest: {
    bar: 'bg-gold',
    bg: 'bg-gold/[0.08]',
    border: 'border-gold/40',
    icon: Trophy,
    subtitle: 'Best ROI across the league.',
    text: 'text-gold',
    title: 'Top Performer',
  },
};

function AwardTrophy({ award, kind }: { award: WeeklyAward; kind: AwardKind }) {
  const theme = AWARD_THEME[kind];
  const Icon = theme.icon;
  const bet = kind === 'lock' ? award.bet : null;
  const winnerName =
    award.displayNames.length > 1
      ? award.displayNames.length <= 2
        ? award.displayNames.join(' + ')
        : `${award.displayNames.length} tied`
      : award.displayName;

  return (
    <div className={cn('overflow-hidden rounded-2xl border', theme.border, theme.bg)}>
      <div className={cn('h-[3px] w-full', theme.bar)} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
              theme.border,
            )}>
            <Icon aria-hidden className={cn('h-5 w-5', theme.text)} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('text-[10px] font-black uppercase tracking-[0.2em]', theme.text)}>
              {theme.title}
            </p>
            <p className="truncate text-base font-black text-white">{winnerName}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
              {kind === 'sharpest' ? 'ROI' : 'Profit'}
            </p>
            <p
              className={cn(
                'text-base font-black',
                kind === 'sharpest' ? 'text-gold' : getProfitTone(award.profit),
              )}>
              {kind === 'sharpest'
                ? `${award.roi >= 0 ? '+' : ''}${award.roi.toFixed(1)}%`
                : formatProfit(award.profit)}
            </p>
          </div>
        </div>

        <p className="text-[11px] font-semibold text-white/55">{theme.subtitle}</p>

        {bet ? (
          <div className="rounded-xl border border-electric-green/25 bg-arena-bg/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <Badge betType={bet.bet_type} />
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-electric-green">
                {formatAmericanOdds(bet.odds)}
              </span>
            </div>
            <p className="mt-2 text-sm font-black text-white">{formatPickTitle(bet)}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-white/55">
                Played {formatCurrency(bet.amount)}
              </span>
              <span className="text-[11px] font-black text-electric-green">
                Profit {formatProfit(award.profit)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Port of the mobile hub's WeeklyAwardsCard / home Trophy Case. */
export function WeeklyAwardsCard({
  awards,
  className,
  weekNumber,
}: {
  awards: WeeklyAwards;
  className?: string;
  weekNumber: number;
}) {
  const hasAward = Boolean(awards.sharpest ?? awards.lock ?? awards.coldStreak);

  return (
    <Card className={cn('flex flex-col gap-4', className)}>
      <header className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Trophy Case</p>
        <Badge label={`Week ${weekNumber}`} tone="neutral" />
      </header>

      {hasAward ? (
        <div className="flex flex-col gap-2.5">
          {awards.sharpest ? <AwardTrophy award={awards.sharpest} kind="sharpest" /> : null}
          {awards.lock ? <AwardTrophy award={awards.lock} kind="lock" /> : null}
          {awards.coldStreak ? <AwardTrophy award={awards.coldStreak} kind="coldStreak" /> : null}
        </div>
      ) : (
        <p className="text-sm font-semibold text-white/50">
          {awards.hasBets
            ? 'Awards land once this week settles.'
            : 'No picks placed in this league yet for this week.'}
        </p>
      )}
    </Card>
  );
}
