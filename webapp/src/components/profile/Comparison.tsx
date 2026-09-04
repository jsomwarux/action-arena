import { GitCompare } from 'lucide-react';

import { Card } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import type { MemberComparison } from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import { formatProfit } from '@/lib/format';

type CompareKey = 'totalProfit' | 'roi' | 'winRate' | 'totalSettledBets';

const COMPARE_ROWS: {
  format: (value: number) => string;
  key: CompareKey;
  label: string;
}[] = [
  { format: (value) => formatProfit(value), key: 'totalProfit', label: 'Total Profit' },
  { format: (value) => `${value.toFixed(1)}%`, key: 'roi', label: 'ROI' },
  { format: (value) => `${value.toFixed(1)}%`, key: 'winRate', label: 'Win Rate' },
  { format: (value) => `${String(value)}`, key: 'totalSettledBets', label: 'Settled Picks' },
];

function CompareRow({
  format,
  label,
  targetValue,
  viewerValue,
}: {
  format: (value: number) => string;
  label: string;
  targetValue: number;
  viewerValue: number;
}) {
  const viewerWins = viewerValue > targetValue;
  const targetWins = targetValue > viewerValue;
  const tied = !viewerWins && !targetWins;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
      <p className="text-center text-[10px] font-black uppercase tracking-[1.6px] text-white/45">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col items-center rounded-2xl border p-3',
            viewerWins
              ? 'border-electric-green/45 bg-electric-green/10'
              : 'border-white/[0.05] bg-white/[0.03]',
          )}
          style={
            viewerWins
              ? { boxShadow: `0 0 10px ${THEME_COLORS.electricGreen}59` }
              : undefined
          }>
          <span
            className={cn(
              'text-[10px] font-black uppercase tracking-[1.4px]',
              viewerWins ? 'text-electric-green' : 'text-white/45',
            )}>
            You
          </span>
          <span
            className={cn(
              'mt-1 max-w-full truncate text-lg font-black tracking-[-0.4px]',
              viewerWins ? 'text-electric-green' : 'text-white',
            )}>
            {format(viewerValue)}
          </span>
        </div>

        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[10px] font-black tracking-[0.5px]',
            tied
              ? 'border-white/15 bg-white/[0.04] text-white/55'
              : 'border-gold/45 bg-gold/15 text-gold',
          )}>
          VS
        </span>

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col items-center rounded-2xl border p-3',
            targetWins ? 'border-gold/45 bg-gold/10' : 'border-white/[0.05] bg-white/[0.03]',
          )}
          style={targetWins ? { boxShadow: `0 0 10px ${THEME_COLORS.gold}52` } : undefined}>
          <span
            className={cn(
              'text-[10px] font-black uppercase tracking-[1.4px]',
              targetWins ? 'text-gold' : 'text-white/45',
            )}>
            Them
          </span>
          <span
            className={cn(
              'mt-1 max-w-full truncate text-lg font-black tracking-[-0.4px]',
              targetWins ? 'text-gold' : 'text-white',
            )}>
            {format(targetValue)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * You against the member you are looking at, inside one league.
 *
 * Only rendered when the profile is league-scoped and the viewer is not the
 * subject — same condition as mobile's members/[memberId] screen. The h2h line
 * counts settled shared matchups only.
 */
export function Comparison({ comparison }: { comparison: MemberComparison }) {
  const h2hLabel =
    comparison.h2hWins > comparison.h2hLosses
      ? `You lead ${String(comparison.h2hWins)}-${String(comparison.h2hLosses)}${
          comparison.h2hTies > 0 ? `-${String(comparison.h2hTies)}` : ''
        }`
      : comparison.h2hWins < comparison.h2hLosses
        ? `They lead ${String(comparison.h2hLosses)}-${String(comparison.h2hWins)}${
            comparison.h2hTies > 0 ? `-${String(comparison.h2hTies)}` : ''
          }`
        : `Tied ${String(comparison.h2hWins)}-${String(comparison.h2hLosses)}`;

  return (
    <Card tone="highlight">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitCompare aria-hidden className="h-3.5 w-3.5 text-electric-green" />
            <h2 className="text-[10px] font-black uppercase tracking-[2.5px] text-electric-green">
              Head to Head
            </h2>
          </div>
          <span className="rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-[10px] font-black uppercase tracking-[1.4px] text-gold">
            {h2hLabel}
          </span>
        </div>

        {/* Four comparisons, two across — the phone stacks all four. */}
        <div className="grid gap-2 lg:grid-cols-2">
          {COMPARE_ROWS.map((row) => (
            <CompareRow
              format={row.format}
              key={row.key}
              label={row.label}
              targetValue={comparison.targetStats[row.key]}
              viewerValue={comparison.viewerStats[row.key]}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
