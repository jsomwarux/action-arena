import { Star } from 'lucide-react';

import type { SharedBetMetadata } from '@/hooks/use-league-chat';
import { cn } from '@/lib/cn';
import { formatAmericanOdds, formatCurrency, formatProfit, getProfitTone } from '@/lib/format';
import { formatBetLegLabel } from '@/lib/pick-labels';
import { THEME_COLORS } from '@/constants/theme';
import type { BetMarket, BetType } from '@/types/database';

import { Badge } from './Badge';

function isBetMarket(value: string): value is BetMarket {
  return value === 'moneyline' || value === 'spread' || value === 'over_under';
}

function betTypeAccent(type: BetType) {
  if (type === 'parlay') return THEME_COLORS.amberAccent;
  if (type === 'teaser') return THEME_COLORS.cyanAccent;
  return THEME_COLORS.electricGreen;
}

/**
 * Port of the mobile hub's SharedBetCard — the pick attached to a `bet_share`
 * chat message. Bet-type colour language per AGENTS.md: straights green,
 * parlays amber, teasers cyan, with the gold Pick of the Week treatment on top.
 */
export function SharedBetCard({ metadata }: { metadata: SharedBetMetadata }) {
  const accent = betTypeAccent(metadata.betType);
  const isLock = metadata.isLock === true;
  const hasSettledProfit = metadata.result !== 'pending' && typeof metadata.profit === 'number';

  return (
    <div
      className={cn('mt-2 w-full rounded-2xl border bg-arena-bg/50 p-3', isLock && 'bg-gold/[0.07]')}
      style={{
        borderColor: isLock ? THEME_COLORS.gold : `${accent}55`,
        boxShadow: isLock ? `0 0 10px ${THEME_COLORS.gold}4d` : undefined,
      }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Badge betType={metadata.betType} />
          {isLock ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold/55 bg-gold/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-gold">
              <Star aria-hidden className="h-2.5 w-2.5" />
              Pick of the Week 1.5x
            </span>
          ) : null}
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
            Week {metadata.weekNumber}
          </span>
        </div>
        <span className="shrink-0 text-xs font-black" style={{ color: accent }}>
          {formatAmericanOdds(metadata.odds)}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {metadata.legs.map((leg, index) => {
          if (!isBetMarket(leg.market)) {
            return null;
          }

          const labelLeg = {
            adjusted_line: leg.adjustedLine,
            market: leg.market,
            original_line: leg.originalLine,
            selection: leg.selection,
          } as const;

          return (
            <li
              className="flex items-start justify-between gap-2"
              key={`${leg.selection}-${String(index)}`}>
              <span className="min-w-0 flex-1 text-xs font-semibold leading-tight text-white/75">
                {formatBetLegLabel(labelLeg, { betType: metadata.betType })}
              </span>
              <span className="shrink-0 text-[10px] font-black uppercase text-white/45">
                {formatAmericanOdds(leg.odds)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-start justify-between gap-2 border-t border-white/[0.08] pt-3">
        <span className="min-w-0 text-[10px] font-black uppercase leading-tight tracking-[0.14em] text-white/45">
          {formatCurrency(metadata.amount)} played
        </span>
        <span
          className={cn(
            'shrink-0 text-xs font-black',
            hasSettledProfit ? getProfitTone(metadata.profit ?? 0) : 'text-electric-green',
          )}>
          {hasSettledProfit
            ? `Profit ${formatProfit(metadata.profit ?? 0)}`
            : `Reward ${formatCurrency(metadata.potentialReward)}`}
        </span>
      </div>
    </div>
  );
}
