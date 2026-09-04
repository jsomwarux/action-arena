import { useEffect, useMemo } from 'react';

import { Award, BarChart3, Gauge, Grid3x3, Ribbon, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { CURRENT_SEASON_YEAR } from '@/constants/cosmetics';
import { useAuth } from '@/hooks/use-auth';
import { buildProfileSummary, useProfileData } from '@/hooks/use-profile-stats';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { logAnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { formatProfit, getProfitTone } from '@/lib/format';
import { getPickLegBaseLabel } from '@/lib/pick-labels';
import { ROUTES } from '@/lib/routes';
import type { BetWithLegs } from '@/types/database';

type WeeklyProfitPoint = {
  profit: number;
  week: number;
};

function StatCard({ label, tone, value }: { label: string; tone?: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-white/45">
        {label}
      </p>
      <p className={cn('mt-1 truncate text-xl font-extrabold tracking-[-0.2px] text-white', tone)}>
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  tone = 'cyan',
}: {
  icon: typeof BarChart3;
  title: string;
  tone?: 'cyan' | 'green';
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        aria-hidden
        className={cn('h-3.5 w-3.5', tone === 'green' ? 'text-electric-green' : 'text-cyan-accent')}
      />
      <h2
        className={cn(
          'text-[11px] font-semibold uppercase tracking-[1.2px]',
          tone === 'green' ? 'text-electric-green' : 'text-cyan-accent',
        )}>
        {title}
      </h2>
    </div>
  );
}

/**
 * Profit attributed to the sides a player keeps backing.
 *
 * A multi-leg pick's profit is split evenly across its legs, so a four-leg
 * winner does not credit each team with the whole payout. Same arithmetic as
 * the mobile screen.
 */
function teamSplits(bets: BetWithLegs[]) {
  const splits = new Map<string, { profit: number; total: number }>();

  bets
    .filter((bet) => bet.result !== 'pending')
    .forEach((bet) => {
      bet.bet_legs.forEach((leg) => {
        const team = getPickLegBaseLabel(leg);
        const current = splits.get(team) ?? { profit: 0, total: 0 };
        splits.set(team, {
          profit: current.profit + (bet.profit ?? 0) / Math.max(1, bet.bet_legs.length),
          total: current.total + 1,
        });
      });
    });

  const ordered = [...splits.entries()]
    .map(([team, value]) => ({ team, ...value }))
    .filter((item) => item.total > 0)
    .sort((left, right) => right.profit - left.profit);

  return {
    best: ordered[0] ?? null,
    worst: ordered[ordered.length - 1] ?? null,
  };
}

function HiddenStatPill({ width = 72 }: { width?: number }) {
  return (
    <span
      aria-hidden
      className="block h-[18px] rounded-full border border-white/10 bg-white/[0.08]"
      style={{ width }}
    />
  );
}

/**
 * The gate.
 *
 * Advanced analytics is a Season Pass perk (AGENTS.md: the pass gates premium
 * extras only, never gameplay). Mobile shows the shape of the screen with the
 * numbers blanked; this does the same.
 *
 * There is no rewarded-ad unlock on web — no ad SDK exists here — so the copy
 * names the Season Pass as the only way through, and the single action is the
 * pass itself.
 */
function LockedAnalyticsPreview({ onGetPass }: { onGetPass: () => void }) {
  const previewBars = [42, 68, 55, 82, 63, 76];

  return (
    <Card className="p-6" tone="highlight">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[18rem] flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-gold">
              Advanced Stats Locked
            </p>
            <h2 className="mt-1 text-2xl font-extrabold text-white">
              The shape is here. The numbers stay hidden.
            </h2>
            <p className="mt-1.5 max-w-xl text-sm font-medium leading-6 text-white/55">
              Advanced analytics unlocks with the Season Pass. It opens pick-type trends, team
              reads, and weekly profit movement once your cards settle. Everything else in Action
              Arena stays free.
            </p>
          </div>
          <Badge icon={Ribbon} label="Pass Only" tone="gold" />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] font-semibold uppercase text-white/40">Win Rate</p>
              <div className="mt-2 opacity-55">
                <HiddenStatPill width={84} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] font-semibold uppercase text-white/40">ROI</p>
              <div className="mt-2 opacity-55">
                <HiddenStatPill width={64} />
              </div>
            </div>
          </div>

          <div aria-hidden className="flex items-end gap-2 opacity-45">
            {previewBars.map((height, index) => (
              <div className="flex flex-1 flex-col items-center gap-1.5" key={index}>
                <span className="w-full rounded-t-lg bg-cyan-accent" style={{ height }} />
                <span className="h-2 w-7 rounded-full bg-white/15" />
              </div>
            ))}
          </div>

          {(['straight', 'parlay', 'teaser'] as const).map((type) => (
            <div className="flex items-center justify-between gap-3" key={type}>
              <Badge betType={type} />
              <HiddenStatPill />
            </div>
          ))}
        </div>

        <div className="max-w-sm">
          <Button onClick={onGetPass} title="Get Season Pass" />
        </div>
      </div>
    </Card>
  );
}

function ProfitTrendChart({ points }: { points: WeeklyProfitPoint[] }) {
  if (points.length === 0) {
    return null;
  }

  const maxMagnitude = Math.max(1, ...points.map((point) => Math.abs(point.profit)));

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-cyan-accent/25 bg-cyan-accent/[0.06] p-4">
      {points.map((point) => {
        const positive = point.profit >= 0;
        // A floor of 12px so a zero-profit week is still a visible column
        // rather than a missing one.
        const height = 12 + (Math.abs(point.profit) / maxMagnitude) * 96;

        return (
          <div className="flex flex-1 flex-col items-center gap-1.5" key={point.week}>
            <span
              className={cn(
                'w-full rounded-t-lg',
                positive ? 'bg-electric-green' : 'bg-coral-red',
              )}
              style={{ height }}
              title={`Week ${String(point.week)} · ${formatProfit(point.profit)}`}
            />
            <span className="text-[10px] font-bold text-white/45">W{point.week}</span>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsNotice({ body, title }: { body: string; title: string }) {
  return (
    <Card>
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-cyan-accent">
          {title}
        </p>
        <p className="text-base font-semibold leading-6 text-white/60">{body}</p>
      </div>
    </Card>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {[0, 1, 2, 3].map((item) => (
        <Skeleton height={180} key={item} radius={20} />
      ))}
    </div>
  );
}

/**
 * Strategy Lab — the advanced analytics screen.
 *
 * Port of app/(app)/analytics.tsx. Every figure comes from the same
 * `buildProfileSummary(data, 'all')` the profile uses, so the two screens can
 * never disagree; this one just asks harder questions of it.
 *
 * Access is Season Pass only. The mobile screen resolves to the same rule —
 * `hasAnalyticsAccess = hasSeasonPass` — and web has no rewarded-ad path to add
 * to it.
 */
export function AnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  const profileQuery = useProfileData({ targetUserId: userId, viewerUserId: userId });
  const seasonPassQuery = useSeasonPass(userId, CURRENT_SEASON_YEAR);

  useEffect(() => {
    logAnalyticsEvent('profile_viewed', { screen: 'advanced_analytics', user_id: userId });
  }, [userId]);

  const summary = useMemo(
    () => (profileQuery.data ? buildProfileSummary(profileQuery.data, 'all') : null),
    [profileQuery.data],
  );
  const betTypeBreakdowns = summary?.betTypeBreakdowns ?? [];
  const teaserBreakdowns = summary?.teaserBreakdowns ?? [];
  const teams = useMemo(() => teamSplits(summary?.bets ?? []), [summary?.bets]);
  const hasSeasonPass = Boolean(seasonPassQuery.data);
  const hasAnalyticsAccess = hasSeasonPass;
  const hasSettledHistory = Boolean(summary && summary.stats.totalSettledBets > 0);
  const parlayBreakdown = useMemo(
    () => betTypeBreakdowns.find((breakdown) => breakdown.type === 'parlay') ?? null,
    [betTypeBreakdowns],
  );

  if (seasonPassQuery.isLoading) {
    return (
      <section className="flex flex-col gap-4">
        <Skeleton height={44} width="40%" />
        <LoadingCards />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cyan-accent" />
          <span className="text-xs font-black uppercase tracking-[0.14em] text-cyan-accent">
            Advanced Analytics
          </span>
        </div>
        <h1 className="arena-heading text-5xl leading-none">Strategy Lab</h1>
        <p className="text-textMuted">
          Deep stat views are a Season Pass perk. Core gameplay stays free.
        </p>
        <div className="mt-1">
          <Badge
            label={hasSeasonPass ? 'Season Pass Holder' : 'Preview Locked'}
            tone={hasAnalyticsAccess ? 'green' : 'gold'}
          />
        </div>
      </header>

      {!hasAnalyticsAccess ? (
        <LockedAnalyticsPreview onGetPass={() => navigate(ROUTES.seasonPass)} />
      ) : null}

      {hasAnalyticsAccess && profileQuery.isLoading ? <LoadingCards /> : null}

      {hasAnalyticsAccess && profileQuery.isError ? (
        <AnalyticsNotice
          body={
            profileQuery.error instanceof Error
              ? profileQuery.error.message
              : 'Refresh and try again.'
          }
          title="Could Not Load Analytics"
        />
      ) : null}

      {hasAnalyticsAccess && summary && hasSettledHistory ? (
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <SectionHeading icon={Gauge} title="Overview" tone="green" />
                <Badge label="Unlocked" tone="green" />
              </div>
              {/* Six figures the phone shows two at a time. */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard label="Win Rate" value={`${summary.stats.winRate.toFixed(1)}%`} />
                <StatCard
                  label="ROI"
                  tone={getProfitTone(summary.stats.roi)}
                  value={`${summary.stats.roi.toFixed(1)}%`}
                />
                <StatCard
                  label="Avg Profit"
                  tone={getProfitTone(summary.stats.averageProfitPerBet)}
                  value={formatProfit(summary.stats.averageProfitPerBet)}
                />
                <StatCard label="Current Streak" value={summary.stats.currentStreak} />
                <StatCard
                  label="Parlay Hit Rate"
                  tone="text-amber-accent"
                  value={parlayBreakdown ? `${parlayBreakdown.hitRate.toFixed(1)}%` : '0.0%'}
                />
                <StatCard
                  label="Parlay Record"
                  tone="text-amber-accent"
                  value={parlayBreakdown?.record ?? '0-0-0'}
                />
              </div>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <div className="flex flex-col gap-3">
                <SectionHeading icon={BarChart3} title="Win Rate by Pick Type" />
                {betTypeBreakdowns.map((breakdown) => (
                  <div className="flex items-center justify-between gap-3" key={breakdown.type}>
                    <Badge betType={breakdown.type} />
                    <span className="text-sm font-bold text-white">
                      {breakdown.record} · {breakdown.winRate.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex flex-col gap-3">
                <SectionHeading icon={Grid3x3} title="Teaser Record by Point Size" />
                {teaserBreakdowns.map((breakdown) => (
                  <div className="flex items-center justify-between gap-3" key={breakdown.points}>
                    <span className="text-sm font-bold text-cyan-accent">
                      {breakdown.points} pts
                    </span>
                    <span className="text-sm font-bold text-white">
                      {breakdown.record} · {breakdown.total} placed
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex flex-col gap-3">
              <SectionHeading icon={TrendingUp} title="Weekly Profit Trend" />
              {summary.weeklyProfits.length > 0 ? (
                <>
                  <ProfitTrendChart points={summary.weeklyProfits} />
                  <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                    {summary.weeklyProfits.map((week) => (
                      <li
                        className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-1.5"
                        key={week.week}>
                        <span className="text-sm font-medium text-white/65">
                          Week {week.week}
                        </span>
                        <span className={cn('text-sm font-bold', getProfitTone(week.profit))}>
                          {formatProfit(week.profit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm font-medium text-white/55">
                  Settled weeks will appear here.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <SectionHeading icon={Award} title="Best / Toughest Team Reads" />
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Best Team"
                  tone="text-electric-green"
                  value={
                    teams.best ? `${teams.best.team} ${formatProfit(teams.best.profit)}` : 'Pending'
                  }
                />
                <StatCard
                  label="Worst Team"
                  tone="text-coral-red"
                  value={
                    teams.worst
                      ? `${teams.worst.team} ${formatProfit(teams.worst.profit)}`
                      : 'Pending'
                  }
                />
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {hasAnalyticsAccess &&
      !profileQuery.isLoading &&
      !profileQuery.isError &&
      !hasSettledHistory ? (
        <AnalyticsNotice
          body="No settled picks were found in your all-leagues Strategy Lab scope yet. Once a card settles, win rate, ROI, streaks, pick-type records, and team reads will populate here."
          title="No Settled Picks"
        />
      ) : null}
    </section>
  );
}
