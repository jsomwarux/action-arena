import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
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
        className="text-[10px] font-black uppercase text-white/45"
        style={{ letterSpacing: 1.4 }}>
        {label}
      </Text>
      <Text className={cn('mt-1 text-xl font-black text-white', tone)}>{value}</Text>
    </View>
  );
}

function GateOverlay({ onUnlock }: { onUnlock: () => void }) {
  return (
    <View className="absolute inset-0 overflow-hidden rounded-2xl">
      <BlurView intensity={28} style={{ flex: 1 }} tint="dark">
        <View className="flex-1 items-center justify-center gap-3 bg-arena-bg/50 p-5">
          <Ionicons color={THEME_COLORS.gold} name="lock-closed" size={28} />
          <Text className="text-center text-xl font-black uppercase text-white">
            Season Pass Analytics
          </Text>
          <Text className="text-center text-sm font-semibold leading-5 text-white/60">
            Unlock the full dashboard with Season Pass or watch a rewarded video placeholder.
          </Text>
          <Button onPress={onUnlock} title="Watch Video to Unlock Stats" />
        </View>
      </BlurView>
    </View>
  );
}

function teamSplits(bets: BetWithLegs[]) {
  const splits = new Map<string, { profit: number; total: number }>();

  bets
    .filter((bet) => bet.result !== 'pending')
    .forEach((bet) => {
      bet.bet_legs.forEach((leg) => {
        const team = leg.selection.replace(/^Over\s+/i, '').replace(/^Under\s+/i, '');
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
        contentContainerStyle={{ gap: 18, paddingBottom: 36 }}
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
            <Ionicons color={THEME_COLORS.cyanAccent} name="analytics" size={14} />
            <Text
              className="text-xs font-black uppercase text-cyan-accent"
              style={{ letterSpacing: 2 }}>
              Advanced Analytics
            </Text>
          </View>
          <Text className="mt-1 text-3xl font-black uppercase text-white">
            Betting Lab
          </Text>
          <Text className="mt-1.5 text-base font-semibold text-white/60">
            Deep stat views are a Season Pass perk. Core gameplay remains free.
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
                    <Text
                      className="text-[10px] font-black uppercase text-electric-green"
                      style={{ letterSpacing: 2 }}>
                      Overview
                    </Text>
                    {hasAccess ? <Badge label="Unlocked" tone="green" /> : <Badge label="Preview" tone="gold" />}
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
                {!hasAccess ? <GateOverlay onUnlock={unlockRewarded} /> : null}
              </Card>
            </View>

            <Card>
              <View className="gap-3">
                <Text className="text-[10px] font-black uppercase text-white/45" style={{ letterSpacing: 2 }}>
                  Win Rate by Bet Type
                </Text>
                {betTypeBreakdowns.map((breakdown) => (
                  <View className="flex-row items-center justify-between" key={breakdown.type}>
                    <Badge betType={breakdown.type} />
                    <Text className="text-sm font-black text-white">
                      {breakdown.record} · {breakdown.winRate.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card>
              <View className="gap-3">
                <Text className="text-[10px] font-black uppercase text-white/45" style={{ letterSpacing: 2 }}>
                  Weekly Profit Trend
                </Text>
                {summary.weeklyProfits.length === 0 ? (
                  <Text className="text-sm font-semibold text-white/55">Settled weeks will appear here.</Text>
                ) : (
                  summary.weeklyProfits.map((week) => (
                    <View className="flex-row items-center justify-between" key={week.week}>
                      <Text className="text-sm font-semibold text-white/65">Week {week.week}</Text>
                      <Text className={cn('text-sm font-black', getProfitTone(week.profit))}>
                        {formatProfit(week.profit)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </Card>

            <Card>
              <View className="gap-3">
                <Text className="text-[10px] font-black uppercase text-white/45" style={{ letterSpacing: 2 }}>
                  Teaser Record by Point Size
                </Text>
                {teaserBreakdowns.map((breakdown) => (
                  <View className="flex-row items-center justify-between" key={breakdown.points}>
                    <Text className="text-sm font-black text-cyan-accent">{breakdown.points} pts</Text>
                    <Text className="text-sm font-black text-white">
                      {breakdown.record} · {breakdown.total} placed
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card>
              <View className="gap-3">
                <Text className="text-[10px] font-black uppercase text-white/45" style={{ letterSpacing: 2 }}>
                  Best / Worst Teams to Bet On
                </Text>
                <View className="flex-row gap-3">
                  <StatCard
                    label="Best Team"
                    tone="text-electric-green"
                    value={teams.best ? `${teams.best.team} ${formatProfit(teams.best.profit)}` : 'Pending'}
                  />
                  <StatCard
                    label="Worst Team"
                    tone="text-coral-red"
                    value={teams.worst ? `${teams.worst.team} ${formatProfit(teams.worst.profit)}` : 'Pending'}
                  />
                </View>
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}
