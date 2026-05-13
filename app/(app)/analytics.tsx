import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Badge, Card, ScreenWrapper, SkeletonLoader } from '@/components/ui';
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
import { haptics } from '@/lib/haptics';
import { getPickLegBaseLabel } from '@/lib/pick-labels';
import type { BetWithLegs } from '@/types/database';

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

function TeaseSparkline({ accent = THEME_COLORS.cyanAccent }: { accent?: string }) {
  // A faux sparkline so the user sees the *shape* of the chart they're missing.
  const heights = [16, 22, 18, 30, 26, 38, 34, 46, 40, 52, 48, 60];
  const max = Math.max(...heights);
  return (
    <View className="flex-row items-end gap-1">
      {heights.map((value, idx) => (
        <View
          key={idx}
          className="flex-1 rounded-md"
          style={{
            backgroundColor: idx === heights.length - 1 ? accent : `${accent}55`,
            height: 4 + (value / max) * 64,
            opacity: 0.55,
          }}
        />
      ))}
    </View>
  );
}

function GateOverlay({
  body,
  ctaLabel,
  onUnlock,
  onUpgrade,
  rewardedDisabled,
  variant = 'sparkline',
}: {
  body?: string;
  ctaLabel?: string;
  onUnlock: () => void;
  onUpgrade: () => void;
  rewardedDisabled?: boolean;
  variant?: 'sparkline' | 'distribution';
}) {
  return (
    <View className="absolute inset-0 overflow-hidden rounded-2xl">
      <View className="flex-1 bg-arena-bg/85">
        <View className="absolute inset-x-3 top-3 opacity-50">
          {variant === 'sparkline' ? (
            <TeaseSparkline accent={THEME_COLORS.cyanAccent} />
          ) : (
            <View className="flex-row gap-2">
              {[0.4, 0.7, 0.55, 0.85].map((value, idx) => (
                <View key={idx} className="h-2 flex-1 rounded-full bg-white/15">
                  <View
                    className="h-2 rounded-full bg-cyan-accent/55"
                    style={{ width: `${value * 100}%` }}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
        <View className="flex-1 items-center justify-center gap-3 px-5">
          <View className="h-12 w-12 items-center justify-center rounded-full border border-gold/55 bg-gold/15">
            <Ionicons color={THEME_COLORS.gold} name="lock-closed" size={20} />
          </View>
          <Text className="text-center text-base font-extrabold text-white" style={{ letterSpacing: -0.2 }}>
            See the shape, unlock the numbers
          </Text>
          <Text className="text-center text-xs font-medium leading-4 text-white/65">
            {body ??
              'Season Pass holders see the full breakdown. Or watch a short video to unlock this week’s stats free.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={rewardedDisabled}
            onPress={() => {
              haptics.medium();
              onUnlock();
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <View
              className="flex-row items-center gap-2 rounded-full border border-electric-green bg-electric-green/15 px-4 py-2"
              style={{
                shadowColor: THEME_COLORS.electricGreen,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
              }}>
              <Ionicons color={THEME_COLORS.electricGreen} name="play-circle" size={16} />
              <Text className="text-xs font-bold text-electric-green">
                {ctaLabel ?? 'Watch a short video'}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.light();
              onUpgrade();
            }}>
            <Text className="text-[11px] font-semibold text-gold underline">
              Or unlock the full season with the Pass
            </Text>
          </Pressable>
        </View>
      </View>
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

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [rewardedUnlocked, setRewardedUnlocked] = useState(false);
  const profileQuery = useProfileData({
    targetUserId: user?.id,
    viewerUserId: user?.id,
  });
  const seasonPassQuery = useSeasonPass(user?.id, CURRENT_SEASON_YEAR);
  const hasAccess = Boolean(seasonPassQuery.data) || rewardedUnlocked;

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

  const unlockRewarded = () => {
    setRewardedUnlocked(true);
    logAnalyticsEvent('rewarded_unlock_triggered', {
      feature: 'advanced_analytics',
      user_id: user?.id,
    });
  };

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
        </View>

        {profileQuery.isLoading ? (
          <View className="gap-3">
            {[0, 1, 2].map((item) => (
              <SkeletonLoader height={150} key={item} />
            ))}
          </View>
        ) : null}

        {summary ? (
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
                    {hasAccess ? (
                      <Badge label="Unlocked" tone="green" />
                    ) : (
                      <Badge label="Preview" tone="gold" />
                    )}
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
                </View>
                {!hasAccess ? (
                  <GateOverlay
                    body="Season Pass holders see win rate, ROI, average profit, and the streak you're riding. Or watch a short video to unlock this week's stats free."
                    onUnlock={unlockRewarded}
                    onUpgrade={() => router.push('/season-pass')}
                    variant="distribution"
                  />
                ) : null}
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
              {!hasAccess ? (
                <GateOverlay
                  body="Watch a short video to unlock this week's stats — or grab the Season Pass to keep them all year."
                  onUnlock={unlockRewarded}
                  onUpgrade={() => router.push('/season-pass')}
                  variant="sparkline"
                />
              ) : null}
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
              {!hasAccess ? (
                <GateOverlay
                  body="Free users see the labels — Pass holders see the actual team names and win rates."
                  onUnlock={unlockRewarded}
                  onUpgrade={() => router.push('/season-pass')}
                  variant="distribution"
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}
