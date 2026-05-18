import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { Badge, Button, Card, ScreenWrapper, SkeletonLoader } from '@/components/ui';
import { CURRENT_SEASON_YEAR } from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  buildProfileSummary,
  calculateBetTypeBreakdowns,
  calculateTeaserBreakdowns,
  useProfileData,
} from '@/hooks/use-profile-stats';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { logAnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { formatProfit, getProfitTone } from '@/lib/format';
import { getPickLegBaseLabel } from '@/lib/pick-labels';
import type { BetWithLegs } from '@/types/database';

type WeeklyProfitPoint = {
  profit: number;
  week: number;
};

function StatCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
      <Text
        className="text-[10px] font-semibold uppercase text-white/45"
        style={{ letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text className={cn('mt-1 text-xl font-extrabold text-white', tone)} style={{ letterSpacing: -0.2 }}>
        {value}
      </Text>
    </View>
  );
}

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
    <View
      className="rounded-full border border-white/10 bg-white/[0.08]"
      style={{ height: 18, width }}
    />
  );
}

function LockedAnalyticsPreview({
  onGetPass,
  onRewardedUnlock,
}: {
  onGetPass: () => void;
  onRewardedUnlock: () => void;
}) {
  const previewBars = [42, 68, 55, 82, 63, 76];

  return (
    <View className="gap-4">
      <Card tone="highlight">
        <View className="gap-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text
                className="text-[11px] font-semibold uppercase text-gold"
                style={{ letterSpacing: 1.2 }}>
                Advanced Stats Locked
              </Text>
              <Text className="mt-1 text-lg font-extrabold text-white">
                The shape is here. The numbers stay hidden.
              </Text>
              <Text className="mt-1 text-sm font-medium leading-5 text-white/55">
                Season Pass unlocks the full analytics dashboard. A rewarded-video placeholder can unlock this view immediately for testing.
              </Text>
            </View>
            <Badge label="Pass Only" tone="gold" />
          </View>

          <View className="gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
            <View className="flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <Text className="text-[10px] font-semibold uppercase text-white/40">
                  Win Rate
                </Text>
                <View className="mt-2 opacity-55">
                  <HiddenStatPill width={84} />
                </View>
              </View>
              <View className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <Text className="text-[10px] font-semibold uppercase text-white/40">
                  ROI
                </Text>
                <View className="mt-2 opacity-55">
                  <HiddenStatPill width={64} />
                </View>
              </View>
            </View>

            <View className="flex-row items-end gap-2 opacity-45">
              {previewBars.map((height, index) => (
                <View className="flex-1 items-center gap-1.5" key={index}>
                  <View
                    className="w-full rounded-t-lg bg-cyan-accent"
                    style={{ height }}
                  />
                  <View className="h-2 w-7 rounded-full bg-white/15" />
                </View>
              ))}
            </View>

            {(['straight', 'parlay', 'teaser'] as const).map((type) => (
              <View className="flex-row items-center justify-between" key={type}>
                <Badge betType={type} />
                <HiddenStatPill />
              </View>
            ))}
          </View>

          <View className="gap-2">
            <Button onPress={onGetPass} title="Get Season Pass" />
            <Button
              icon="play-circle"
              onPress={onRewardedUnlock}
              title="Watch video to unlock stats"
              variant="secondary"
            />
          </View>
        </View>
      </Card>
    </View>
  );
}

function ProfitTrendChart({ points }: { points: WeeklyProfitPoint[] }) {
  if (points.length === 0) {
    return null;
  }

  const maxMagnitude = Math.max(
    1,
    ...points.map((point) => Math.abs(point.profit)),
  );

  return (
    <View className="flex-row items-end gap-2 rounded-2xl border border-cyan-accent/25 bg-cyan-accent/[0.06] p-3">
      {points.map((point) => {
        const positive = point.profit >= 0;
        const height = 12 + (Math.abs(point.profit) / maxMagnitude) * 68;

        return (
          <View className="flex-1 items-center gap-1.5" key={point.week}>
            <View
              className={cn('w-full rounded-t-lg', positive ? 'bg-electric-green' : 'bg-coral-red')}
              style={{ height }}
            />
            <Text className="text-[10px] font-bold text-white/45">W{point.week}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [rewardedUnlock, setRewardedUnlock] = useState(false);
  const profileQuery = useProfileData({
    targetUserId: user?.id,
    viewerUserId: user?.id,
  });
  const seasonPassQuery = useSeasonPass(user?.id, CURRENT_SEASON_YEAR);

  useEffect(() => {
    logAnalyticsEvent('profile_viewed', {
      screen: 'advanced_analytics',
      user_id: user?.id,
    });
  }, [user?.id]);

  const summary = useMemo(
    () => (profileQuery.data ? buildProfileSummary(profileQuery.data, 'all') : null),
    [profileQuery.data],
  );
  const betTypeBreakdowns = useMemo(
    () => calculateBetTypeBreakdowns(profileQuery.data?.bets ?? []),
    [profileQuery.data?.bets],
  );
  const teaserBreakdowns = useMemo(
    () => calculateTeaserBreakdowns(profileQuery.data?.bets ?? []),
    [profileQuery.data?.bets],
  );
  const teams = useMemo(() => teamSplits(profileQuery.data?.bets ?? []), [profileQuery.data?.bets]);
  const hasSeasonPass = Boolean(seasonPassQuery.data);
  const hasAnalyticsAccess = hasSeasonPass || rewardedUnlock;
  const parlayBreakdown = useMemo(
    () => betTypeBreakdowns.find((breakdown) => breakdown.type === 'parlay') ?? null,
    [betTypeBreakdowns],
  );

  const unlockWithRewardedVideo = () => {
    setRewardedUnlock(true);
    logAnalyticsEvent('rewarded_unlock_triggered', {
      placement: 'advanced_analytics',
      user_id: user?.id,
    });
  };

  if (seasonPassQuery.isLoading) {
    return (
      <ScreenWrapper className="pb-0">
        <View className="gap-3">
          {[0, 1, 2].map((item) => (
            <SkeletonLoader height={150} key={item} />
          ))}
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={profileQuery.isRefetching}
            onRefresh={profileQuery.refetch}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View>
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-cyan-accent" />
            <Text
              className="text-[11px] font-semibold uppercase text-cyan-accent"
              style={{ letterSpacing: 1.2 }}>
              Advanced Analytics
            </Text>
          </View>
          <Text
            className="mt-1 text-2xl font-extrabold text-white"
            style={{ letterSpacing: -0.4 }}>
            Strategy Lab
          </Text>
          <Text className="mt-1 text-sm font-medium text-white/55">
            Deep stat views are a Season Pass perk. Core gameplay stays free.
          </Text>
          <View className="mt-3">
            <Badge
              label={
                hasSeasonPass
                  ? 'Season Pass Holder'
                  : rewardedUnlock
                    ? 'Video Unlock Active'
                    : 'Preview Locked'
              }
              tone={hasAnalyticsAccess ? 'green' : 'gold'}
            />
          </View>
        </View>

        {!hasAnalyticsAccess ? (
          <LockedAnalyticsPreview
            onGetPass={() => router.push('/season-pass')}
            onRewardedUnlock={unlockWithRewardedVideo}
          />
        ) : null}

        {hasAnalyticsAccess && profileQuery.isLoading ? (
          <View className="gap-3">
            {[0, 1, 2].map((item) => (
              <SkeletonLoader height={150} key={item} />
            ))}
          </View>
        ) : null}

        {hasAnalyticsAccess && summary ? (
          <View className="gap-4">
            <View>
              <Card>
                <View className="gap-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Ionicons color={THEME_COLORS.electricGreen} name="speedometer" size={14} />
                      <Text
                        className="text-[11px] font-semibold uppercase text-electric-green"
                        style={{ letterSpacing: 1.2 }}>
                        Overview
                      </Text>
                    </View>
                    <Badge label="Unlocked" tone="green" />
                  </View>
                  <View className="flex-row gap-3">
                    <StatCard label="Win Rate" value={`${summary.stats.winRate.toFixed(1)}%`} />
                    <StatCard
                      label="ROI"
                      tone={getProfitTone(summary.stats.roi)}
                      value={`${summary.stats.roi.toFixed(1)}%`}
                    />
                  </View>
                  <View className="flex-row gap-3">
                    <StatCard
                      label="Avg Profit"
                      tone={getProfitTone(summary.stats.averageProfitPerBet)}
                      value={formatProfit(summary.stats.averageProfitPerBet)}
                    />
                    <StatCard label="Current Streak" value={summary.stats.currentStreak} />
                  </View>
                  <View className="flex-row gap-3">
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
                  </View>
                </View>
              </Card>
            </View>

            <Card>
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons color={THEME_COLORS.cyanAccent} name="bar-chart" size={14} />
                  <Text
                    className="text-[11px] font-semibold uppercase text-cyan-accent"
                    style={{ letterSpacing: 1.2 }}>
                    Win Rate by Pick Type
                  </Text>
                </View>
                {betTypeBreakdowns.map((breakdown) => (
                  <View
                    className="flex-row items-center justify-between"
                    key={breakdown.type}>
                    <Badge betType={breakdown.type} />
                    <Text className="text-sm font-bold text-white">
                      {breakdown.record} · {breakdown.winRate.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            <View>
              <Card>
                <View className="gap-3">
                  <View className="flex-row items-center gap-2">
                    <Ionicons color={THEME_COLORS.cyanAccent} name="trending-up" size={14} />
                    <Text
                      className="text-[11px] font-semibold uppercase text-cyan-accent"
                      style={{ letterSpacing: 1.2 }}>
                      Weekly Profit Trend
                    </Text>
                  </View>
                  {summary.weeklyProfits.length > 0 ? (
                    <ProfitTrendChart points={summary.weeklyProfits} />
                  ) : null}
                  {summary.weeklyProfits.length === 0 ? (
                    <Text className="text-sm font-medium text-white/55">
                      Settled weeks will appear here.
                    </Text>
                  ) : (
                    summary.weeklyProfits.map((week) => (
                      <View
                        className="flex-row items-center justify-between"
                        key={week.week}>
                        <Text className="text-sm font-medium text-white/65">
                          Week {week.week}
                        </Text>
                        <Text className={cn('text-sm font-bold', getProfitTone(week.profit))}>
                          {formatProfit(week.profit)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </Card>
            </View>

            <Card>
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons color={THEME_COLORS.cyanAccent} name="grid" size={14} />
                  <Text
                    className="text-[11px] font-semibold uppercase text-cyan-accent"
                    style={{ letterSpacing: 1.2 }}>
                    Teaser Record by Point Size
                  </Text>
                </View>
                {teaserBreakdowns.map((breakdown) => (
                  <View
                    className="flex-row items-center justify-between"
                    key={breakdown.points}>
                    <Text className="text-sm font-bold text-cyan-accent">
                      {breakdown.points} pts
                    </Text>
                    <Text className="text-sm font-bold text-white">
                      {breakdown.record} · {breakdown.total} placed
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            <View>
              <Card>
                <View className="gap-3">
                  <View className="flex-row items-center gap-2">
                    <Ionicons color={THEME_COLORS.cyanAccent} name="podium" size={14} />
                    <Text
                      className="text-[11px] font-semibold uppercase text-cyan-accent"
                      style={{ letterSpacing: 1.2 }}>
                      Best / Toughest Team Reads
                    </Text>
                  </View>
                  <View className="flex-row gap-3">
                    <StatCard
                      label="Best Team"
                      tone="text-electric-green"
                      value={
                        teams.best
                          ? `${teams.best.team} ${formatProfit(teams.best.profit)}`
                          : 'Pending'
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
                  </View>
                </View>
              </Card>
            </View>
          </View>
        ) : null}

        {hasAnalyticsAccess && !profileQuery.isLoading && !summary ? (
          <Card>
            <Text className="text-base font-semibold text-white/55">
              Analytics will appear once your first league card is settled.
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}
