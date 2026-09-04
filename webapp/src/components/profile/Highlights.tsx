import { CheckCircle2, Medal, TrendingDown, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import type { ProfileSummary } from '@/hooks/use-profile-stats';
import { formatAmericanOdds, formatCurrency, formatProfit } from '@/lib/format';
import { formatBetLegLabel, formatPickTitle } from '@/lib/pick-labels';
import { buildRoute } from '@/lib/routes';
import type { BetWithLegs } from '@/types/database';

import { BET_TYPE_META, LockPill, getRewardDisplay, marketCopy } from './pick-language';
import { SectionLabel } from './SectionLabel';

/**
 * The best settled pick, in gold.
 *
 * A multi-leg winner also shows its chain, because "all four hit" is the story
 * — same treatment as the mobile BestBetCard. Desktop adds the link through to
 * /bets/:betId that the phone reaches by tapping the row in history.
 */
function BestBetCard({ bet }: { bet: BetWithLegs }) {
  const meta = BET_TYPE_META[bet.bet_type];
  const isMultiLeg = bet.bet_type !== 'straight';
  const reward = getRewardDisplay(bet);

  return (
    <Link
      className="block overflow-hidden rounded-2xl border border-gold/40 bg-gold/[0.08] transition duration-150 ease-arena hover:-translate-y-0.5 hover:brightness-110"
      style={{ boxShadow: `0 0 16px ${THEME_COLORS.gold}66` }}
      to={buildRoute.bet(bet.id)}>
      <div aria-hidden className="h-[3px] w-full bg-gold" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/55 bg-gold/15">
              <Trophy aria-hidden className="h-4 w-4 text-gold" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-black uppercase tracking-[2px] text-gold">
                Best Pick
              </span>
              <span className="block truncate text-lg font-black uppercase tracking-[-0.3px] text-white">
                {formatPickTitle(bet)}
              </span>
            </span>
          </div>
          <Badge betType={bet.bet_type} />
        </div>

        {bet.is_lock ? <LockPill /> : null}

        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[1.5px] text-white/45">
              Played · Value
            </p>
            <p className="truncate text-sm font-black text-white">
              {formatCurrency(bet.amount)} · {formatAmericanOdds(bet.odds)}
            </p>
            <p className="truncate text-[11px] font-semibold text-white/55">
              {reward.label} {formatCurrency(reward.value)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-black uppercase tracking-[1.5px] text-white/45">
              Profit
            </p>
            <p className="text-3xl font-black tracking-[-0.8px] text-electric-green">
              {formatProfit(bet.profit ?? 0)}
            </p>
          </div>
        </div>

        {isMultiLeg ? (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-[1.4px] text-gold">
              {bet.bet_legs.length}-leg chain · all hit
            </p>
            <div className="flex gap-2.5">
              <span aria-hidden className="flex flex-col items-center pt-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.accent }}
                />
                <span className="mt-0.5 w-[2px] flex-1 rounded-full bg-gold/40" />
              </span>
              <ul className="flex flex-1 flex-col gap-2">
                {bet.bet_legs.map((leg, index) => (
                  <li
                    className="flex items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2.5"
                    key={leg.id}>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/45 bg-gold/15 text-[10px] font-black text-gold">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black tracking-[-0.2px] text-white">
                          {formatBetLegLabel(leg, { betType: bet.bet_type })}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-semibold uppercase text-white/45">
                          {marketCopy(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
                        </span>
                      </span>
                    </span>
                    <CheckCircle2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-electric-green" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

/** The worst settled pick. Deliberately quieter than the best one. */
function WorstBetCard({ bet }: { bet: BetWithLegs }) {
  return (
    <Link
      className="flex flex-col gap-3 rounded-2xl border border-coral-red/20 bg-white/[0.03] p-5 transition duration-150 ease-arena hover:-translate-y-0.5 hover:bg-white/[0.05]"
      to={buildRoute.bet(bet.id)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-coral-red/35 bg-coral-red/[0.08]">
            <TrendingDown aria-hidden className="h-3.5 w-3.5 text-coral-red" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[1.6px] text-white/45">
              Toughest Pick
            </span>
            <span className="block truncate text-sm font-black tracking-[-0.2px] text-white">
              {formatPickTitle(bet)}
            </span>
          </span>
        </div>
        <Badge betType={bet.bet_type} />
      </div>

      {bet.is_lock ? <LockPill /> : null}

      <div className="flex items-end justify-between gap-3">
        <p className="min-w-0 flex-1 text-[11px] font-semibold text-white/45">
          Week {bet.week_number} · {formatCurrency(bet.amount)} played ·{' '}
          {formatAmericanOdds(bet.odds)}
        </p>
        <p className="shrink-0 text-base font-black text-coral-red">
          {formatProfit(bet.profit ?? 0)}
        </p>
      </div>
    </Link>
  );
}

export function Highlights({ summary }: { summary: ProfileSummary }) {
  if (!summary.bestBet && !summary.worstBet) {
    return (
      <section className="flex flex-col gap-3">
        <SectionLabel title="Highlights" />
        <Card>
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <Medal aria-hidden className="h-6 w-6 text-white/40" />
            </span>
            <p className="max-w-sm text-center text-base font-semibold leading-snug text-white/65">
              Best &amp; toughest picks show up once you settle a few cards.
            </p>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel title="Highlights" />
      {summary.bestBet ? <BestBetCard bet={summary.bestBet} /> : null}
      {summary.worstBet && summary.worstBet.id !== summary.bestBet?.id ? (
        <WorstBetCard bet={summary.worstBet} />
      ) : null}
    </section>
  );
}
