import { TrendingUp } from 'lucide-react';

import type { BetTypeBreakdown, TeaserPointBreakdown } from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import { formatProfit, getProfitTone } from '@/lib/format';

import { BET_TYPE_META } from './pick-language';
import { SectionLabel } from './SectionLabel';

/**
 * One pick type's record, profit and win-rate meter, in that type's colour.
 * Straights green, parlays amber, teasers cyan — the AGENTS.md contract.
 */
function BreakdownRow({ breakdown }: { breakdown: BetTypeBreakdown }) {
  const meta = BET_TYPE_META[breakdown.type];
  const Icon = meta.icon;
  const winPercent = Math.max(0, Math.min(breakdown.winRate, 100));

  return (
    <div className={cn('rounded-2xl border p-4', meta.borderClass, meta.bgClass)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
            style={{ backgroundColor: `${meta.accent}1f`, borderColor: `${meta.accent}55` }}>
            <Icon aria-hidden className="h-4 w-4" style={{ color: meta.accent }} />
          </span>
          <div className="min-w-0">
            <p className={cn('text-xs font-black uppercase tracking-[2px]', meta.textClass)}>
              {meta.label}
            </p>
            <p className="truncate text-base font-black tracking-[-0.2px] text-white">
              {breakdown.record} · {breakdown.total} placed
            </p>
          </div>
        </div>
        <p className={cn('shrink-0 text-base font-black tracking-[-0.3px]', getProfitTone(breakdown.profit))}>
          {formatProfit(breakdown.profit)}
        </p>
      </div>

      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
          <div
            className={cn('h-full', meta.barClass)}
            style={{ opacity: 0.85, width: `${String(winPercent)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="arena-label text-white/45">
            Win Rate
          </span>
          <span className={cn('text-[11px] font-black uppercase tracking-[1.2px]', meta.textClass)}>
            {breakdown.winRate.toFixed(1)}%
            {breakdown.type !== 'straight' && breakdown.averageLegs > 0
              ? ` · ${breakdown.averageLegs.toFixed(1)} avg legs`
              : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

function TeaserSpread({ teasers }: { teasers: TeaserPointBreakdown[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <TrendingUp aria-hidden className="h-3 w-3 text-cyan-accent" />
        <p className="arena-eyebrow text-cyan-accent">
          Teaser Sizes
        </p>
      </div>
      <div className="flex gap-2">
        {teasers.map((teaser) => {
          const hasBets = teaser.total > 0;

          return (
            <div
              className={cn(
                'min-w-0 flex-1 rounded-2xl border p-3',
                hasBets
                  ? 'border-cyan-accent/35 bg-cyan-accent/[0.08]'
                  : 'border-white/[0.07] bg-white/[0.03]',
              )}
              key={teaser.points}>
              <p
                className={cn(
                  'text-[10px] font-black uppercase tracking-[0.15em]',
                  hasBets ? 'text-cyan-accent' : 'text-white/45',
                )}>
                {teaser.points} pts
              </p>
              <p className="mt-1 text-base font-black text-white">{teaser.record}</p>
              <p className="mt-1 text-[10px] font-semibold text-white/45">
                {teaser.total} placed
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Breakdown({
  breakdowns,
  teasers,
}: {
  breakdowns: BetTypeBreakdown[];
  teasers: TeaserPointBreakdown[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel title="Pick Type Breakdown" />
      <div className="flex flex-col gap-2">
        {breakdowns.map((breakdown) => (
          <BreakdownRow breakdown={breakdown} key={breakdown.type} />
        ))}
      </div>
      <TeaserSpread teasers={teasers} />
    </section>
  );
}
