import { Flame, Minus, Snowflake } from 'lucide-react';

import { AnimatedNumber, Card } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import type { ProfileSummary } from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import { formatProfit, formatRecord, getProfitTone } from '@/lib/format';

function StatTile({ accent, label, value }: { accent?: string; label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[1.4px] text-white/55">{label}</p>
      <p className={cn('mt-1.5 truncate text-2xl font-black tracking-[-0.4px] text-white', accent)}>
        {value}
      </p>
    </div>
  );
}

/**
 * The season headline: profit, streak, record, and the three rate tiles.
 *
 * Port of the mobile HeroStats block. The one desktop change is that the
 * scope line and the tiles sit beside the big number instead of under it —
 * there is horizontal room here that the phone does not have, and the figure
 * no longer needs `adjustsFontSizeToFit` to survive.
 */
export function HeroStats({ summary }: { summary: ProfileSummary }) {
  const { stats } = summary;
  const seasonScopeLabel = summary.latestStanding
    ? `Through Week ${String(summary.latestStanding.week_number)}`
    : 'Season to date';
  const isStreakWin = stats.currentStreak.includes('W');
  const isStreakLoss = stats.currentStreak.includes('L');
  const StreakIcon = isStreakWin ? Flame : isStreakLoss ? Snowflake : Minus;
  const profitColor =
    stats.totalProfit > 0
      ? THEME_COLORS.electricGreen
      : stats.totalProfit < 0
        ? THEME_COLORS.coralRed
        : THEME_COLORS.textMuted;

  return (
    <Card className="p-6" tone="highlight">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-full bg-electric-green" />
            <span className="text-xs font-black uppercase tracking-[2.5px] text-electric-green">
              Season Stats
            </span>
          </div>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1',
              'arena-label',
              isStreakWin
                ? 'border-electric-green/45 bg-electric-green/15 text-electric-green'
                : isStreakLoss
                  ? 'border-coral-red/35 bg-coral-red/10 text-coral-red'
                  : 'border-white/15 bg-white/[0.05] text-white/65',
            )}>
            <StreakIcon aria-hidden className="h-3 w-3" />
            {stats.currentStreak}
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[2px] text-white/55">
              Season Profit
            </p>
            <AnimatedNumber
              className="mt-1 block text-6xl font-black leading-none tracking-[-2.2px] tabular-nums"
              formatter={formatProfit}
              style={{ color: profitColor }}
              value={stats.totalProfit}
            />
            <p className="mt-2.5 text-sm font-semibold text-white/65">
              {seasonScopeLabel} · {formatRecord(stats.wins, stats.losses, stats.ties)} league
              record · {stats.totalSettledBets} settled pick
              {stats.totalSettledBets === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex min-w-[22rem] flex-1 gap-3">
            <StatTile
              accent={stats.winRate >= 55 ? 'text-electric-green' : 'text-white'}
              label="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
            />
            <StatTile
              accent={getProfitTone(stats.averageProfitPerBet)}
              label="Avg / Pick"
              value={formatProfit(stats.averageProfitPerBet)}
            />
            <StatTile
              accent={getProfitTone(stats.roi)}
              label="ROI"
              value={`${stats.roi.toFixed(1)}%`}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
