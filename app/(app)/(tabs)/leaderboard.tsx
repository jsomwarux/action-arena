import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CosmeticAvatar } from '@/components/cosmetics';
import {
  Badge,
  Button,
  Card,
  ScreenWrapper,
  SegmentedToggle,
  type SegmentedOption,
  StaggeredItem,
} from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useEquippedCosmeticsForUsers } from '@/hooks/use-cosmetics';
import { type LeaderboardRow, useLeaderboardData } from '@/hooks/use-profile-stats';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { triggerAdHook } from '@/lib/ad-hooks';
import { cn } from '@/lib/cn';
import { formatProfit, formatRecord, getProfitTone } from '@/lib/format';
import type { EquippedCosmeticsByCategory } from '@/types/database';

type BoardView = 'season' | 'week';

type RankAccent = {
  bg: string;
  border: string;
  glow?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  label: string;
  text: string;
};

const BRONZE_COLOR = '#CD7F32';

const BOARD_VIEW_OPTIONS: SegmentedOption<BoardView>[] = [
  { icon: 'globe', label: 'Season', value: 'season' },
  { icon: 'flame', label: 'This Week', value: 'week' },
];

function TapTarget({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

function StaticSkeleton({
  height,
  radius = 10,
  width,
}: {
  height: number;
  radius?: number;
  width: number | `${number}%`;
}) {
  return (
    <View
      className="bg-white/[0.08]"
      style={{
        borderRadius: radius,
        height,
        width,
      }}
    />
  );
}

function rankAccent(rank: number): RankAccent {
  if (rank === 1) {
    return {
      bg: 'bg-gold/15',
      border: 'border-gold/55',
      glow: THEME_COLORS.gold,
      icon: 'trophy',
      iconColor: THEME_COLORS.gold,
      label: 'Gold',
      text: 'text-gold',
    };
  }
  if (rank === 2) {
    return {
      bg: 'bg-white/[0.12]',
      border: 'border-white/40',
      glow: '#D8E0EE',
      icon: 'medal',
      iconColor: '#E8EEF7',
      label: 'Silver',
      text: 'text-white',
    };
  }
  if (rank === 3) {
    return {
      bg: 'bg-bronze/15',
      border: 'border-bronze/55',
      glow: BRONZE_COLOR,
      icon: 'medal',
      iconColor: BRONZE_COLOR,
      label: 'Bronze',
      text: 'text-bronze-text',
    };
  }
  return {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.08]',
    icon: 'ellipse-outline',
    iconColor: 'rgba(255,255,255,0.55)',
    label: '—',
    text: 'text-white/65',
  };
}

type LeaderboardTrend = Exclude<LeaderboardRow['seasonTrend'], null>;

function valueForRow(row: LeaderboardRow, boardView: BoardView) {
  return boardView === 'week' ? row.weeklyProfit : row.seasonProfit;
}

function rankForRow(row: LeaderboardRow, boardView: BoardView) {
  return boardView === 'week' ? row.weeklyRank : row.seasonRank;
}

function trendForRow(row: LeaderboardRow, boardView: BoardView) {
  return boardView === 'week' ? row.weeklyTrend : row.seasonTrend;
}

function trendDescriptor(trend: LeaderboardTrend) {
  if (trend === 'up') {
    return {
      bg: 'bg-electric-green/15',
      border: 'border-electric-green/40',
      color: THEME_COLORS.electricGreen,
      icon: 'arrow-up' as const,
      label: 'Up',
      text: 'text-electric-green',
    };
  }
  if (trend === 'down') {
    return {
      bg: 'bg-coral-red/15',
      border: 'border-coral-red/40',
      color: THEME_COLORS.coralRed,
      icon: 'arrow-down' as const,
      label: 'Down',
      text: 'text-coral-red',
    };
  }

  return null;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
}

function LoadingState() {
  return (
    <View className="gap-4">
      {[0, 1, 2, 3].map((item) => (
        <Card key={item}>
          <View className="flex-row items-center gap-3">
            <StaticSkeleton height={40} width={40} radius={16} />
            <View className="flex-1 gap-2">
              <StaticSkeleton height={18} width="60%" />
              <StaticSkeleton height={12} width="40%" />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

function PodiumCard({
  cosmetics,
  featured = false,
  isUser,
  onPress,
  rank,
  row,
  trend,
  value,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  featured?: boolean;
  isUser: boolean;
  onPress: () => void;
  rank: number;
  row: LeaderboardRow;
  trend: LeaderboardTrend | null;
  value: number;
}) {
  const accent = rankAccent(rank);
  const trendMeta = trend ? trendDescriptor(trend) : null;
  const avatarName = row.member.team_name || row.profile?.display_name || '?';
  const iconSize = featured ? 20 : 14;
  const nameSize = featured ? 'text-sm' : 'text-xs';
  const valueSize = featured ? 'text-base' : 'text-sm';
  const padding = featured ? 'p-4' : 'p-3';
  const minHeight = featured ? 168 : 144;

  return (
    <TapTarget onPress={onPress} style={{ flex: 1 }}>
      <View
        className={cn(
          'flex-1 items-center rounded-2xl border',
          padding,
          accent.bg,
          accent.border,
        )}
        style={[
          { minHeight },
          accent.glow
            ? {
                shadowColor: accent.glow,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: featured ? 0.55 : 0.3,
                shadowRadius: featured ? 14 : 8,
              }
            : undefined,
        ]}>
        <Ionicons color={accent.iconColor} name={accent.icon} size={iconSize} />
        <View className="mt-2">
          <CosmeticAvatar
            cosmetics={cosmetics}
            name={avatarName}
            size={featured ? 'lg' : 'md'}
          />
        </View>
        <Text
          className={cn('mt-2 text-center font-semibold text-white', nameSize)}
          numberOfLines={1}>
          {row.member.team_name}
        </Text>
        <View className="mt-1.5 flex-row items-center gap-1">
          {trendMeta ? (
            <Ionicons color={trendMeta.color} name={trendMeta.icon} size={featured ? 12 : 10} />
          ) : null}
          <Text
            className={cn('font-bold', valueSize, getProfitTone(value))}
            style={{ letterSpacing: -0.2 }}>
            {formatProfit(value)}
          </Text>
        </View>
        {isUser ? (
          <View className="mt-1.5 rounded-full border border-electric-green/40 bg-electric-green/15 px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-electric-green">You</Text>
          </View>
        ) : null}
      </View>
    </TapTarget>
  );
}

function LeaderboardListRow({
  cosmetics,
  isUser,
  onPress,
  row,
  showRank,
  trend,
  value,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  isUser: boolean;
  onPress: () => void;
  row: LeaderboardRow;
  showRank: number;
  trend: LeaderboardTrend | null;
  value: number;
}) {
  const accent = rankAccent(showRank);
  const trendMeta = trend ? trendDescriptor(trend) : null;

  return (
    <TapTarget onPress={onPress}>
      <View
        className={cn(
          'flex-row items-center gap-3 px-4 py-3.5',
          isUser ? 'bg-electric-green/[0.10]' : null,
        )}
        style={
          isUser
            ? {
                borderLeftColor: THEME_COLORS.electricGreen,
                borderLeftWidth: 3,
              }
            : undefined
        }>
        <View
          className={cn(
            'h-9 w-9 items-center justify-center rounded-xl border',
            accent.bg,
            accent.border,
          )}
          style={
            accent.glow
              ? {
                  shadowColor: accent.glow,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.4,
                  shadowRadius: 6,
                }
              : undefined
          }>
          {showRank <= 3 ? (
            <Ionicons color={accent.iconColor} name={accent.icon} size={14} />
          ) : (
            <Text className={cn('text-sm font-bold', accent.text)}>{showRank}</Text>
          )}
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <CosmeticAvatar
              cosmetics={cosmetics}
              name={row.member.team_name || row.profile?.display_name || 'Player'}
              size="sm"
            />
            <Text
              className="text-base font-bold text-white"
              numberOfLines={1}
              style={{ letterSpacing: -0.2 }}>
              {row.member.team_name}
            </Text>
            {isUser ? <Badge label="You" tone="green" /> : null}
          </View>
          <Text className="mt-0.5 text-xs font-medium text-white/50" numberOfLines={1}>
            {row.standing
              ? formatRecord(row.standing.wins, row.standing.losses, row.standing.ties)
              : '0-0'}
            {row.profile?.display_name ? ` · ${row.profile.display_name}` : ''}
          </Text>
        </View>

        <View className="items-end gap-1">
          <Text
            className={cn('text-sm font-bold', getProfitTone(value))}
            style={{ letterSpacing: -0.2 }}>
            {formatProfit(value)}
          </Text>
          {trendMeta ? (
            <View
              className={cn(
                'flex-row items-center gap-1 rounded-full border px-1.5 py-px',
                trendMeta.bg,
                trendMeta.border,
              )}>
              <Ionicons color={trendMeta.color} name={trendMeta.icon} size={9} />
              <Text className={cn('text-[10px] font-semibold', trendMeta.text)}>
                {trendMeta.label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TapTarget>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | undefined>();
  const [boardView, setBoardView] = useState<BoardView>('season');
  const leaderboardQuery = useLeaderboardData(user?.id, selectedLeagueId);
  const seasonPassQuery = useSeasonPass(user?.id);
  const adHookTriggered = useRef(false);
  const selectedLeague = useMemo(
    () =>
      leaderboardQuery.data?.leagues.find((league) => league.id === selectedLeagueId) ??
      leaderboardQuery.data?.leagues[0] ??
      null,
    [leaderboardQuery.data?.leagues, selectedLeagueId],
  );
  const sortedRows = useMemo(() => {
    const source = leaderboardQuery.data?.rows ?? [];
    return [...source].sort((left, right) => rankForRow(left, boardView) - rankForRow(right, boardView));
  }, [boardView, leaderboardQuery.data?.rows]);

  const podiumRows = sortedRows.slice(0, Math.min(3, sortedRows.length));
  const cosmeticsQuery = useEquippedCosmeticsForUsers(
    sortedRows.map((row) => row.member.user_id),
  );
  const cosmeticsByUserId = cosmeticsQuery.data ?? {};

  useEffect(() => {
    if (adHookTriggered.current || leaderboardQuery.isLoading || seasonPassQuery.isLoading) {
      return;
    }

    adHookTriggered.current = true;
    triggerAdHook({
      isSeasonPassHolder: Boolean(seasonPassQuery.data),
      placement: 'leaderboard_banner',
      userId: user?.id,
    });
  }, [leaderboardQuery.isLoading, seasonPassQuery.data, seasonPassQuery.isLoading, user?.id]);

  const valueFor = (row: LeaderboardRow | undefined) => (row ? valueForRow(row, boardView) : 0);

  return (
    <ScreenWrapper className="pb-0" topSafe>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 18, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={leaderboardQuery.isRefetching}
            onRefresh={leaderboardQuery.refetch}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View>
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            <Text
              className="text-xs font-semibold uppercase text-electric-green"
              style={{ letterSpacing: 1.2 }}>
              League Ladder
            </Text>
          </View>
          <Text
            className="mt-1 text-3xl font-extrabold text-white"
            style={{ letterSpacing: -0.5 }}>
            Leaderboard
          </Text>
          <Text className="mt-1.5 text-base font-medium text-white/60">
            Profit, records, and weekly movement across your league.
          </Text>
        </View>

        {leaderboardQuery.isLoading ? <LoadingState /> : null}

        {!leaderboardQuery.isLoading && leaderboardQuery.data && sortedRows.length > 0 ? (
          <View className="gap-5">
            {leaderboardQuery.data.leagueOptions.length > 1 ? (
              <View className="flex-row flex-wrap gap-2">
                {leaderboardQuery.data.leagueOptions.map((league) => {
                  const active =
                    (selectedLeague?.id ?? leaderboardQuery.data?.leagueOptions[0]?.id) === league.id;
                  return (
                    <TapTarget key={league.id} onPress={() => setSelectedLeagueId(league.id)}>
                      <View
                        className={cn(
                          'rounded-full border px-4 py-2',
                          active
                            ? 'border-electric-green/55 bg-electric-green/15'
                            : 'border-white/10 bg-white/[0.04]',
                        )}>
                        <Text
                          className={cn(
                            'text-sm font-bold',
                            active ? 'text-electric-green' : 'text-white/70',
                          )}>
                          {league.label}
                        </Text>
                      </View>
                    </TapTarget>
                  );
                })}
              </View>
            ) : null}

            <SegmentedToggle
              accent="green"
              onChange={setBoardView}
              options={BOARD_VIEW_OPTIONS}
              value={boardView}
            />

            {podiumRows.length >= 3 ? (
              <View className="flex-row items-end gap-3 pt-2">
                {/* Silver (rank 2) on the left */}
                <View style={{ flex: 1, paddingBottom: 16 }}>
                  <PodiumCard
                    cosmetics={cosmeticsByUserId[podiumRows[1].member.user_id]}
                    isUser={podiumRows[1].member.user_id === user?.id}
                    onPress={() =>
                      router.push({
                        pathname: '/members/[memberId]',
                        params: {
                          leagueId: podiumRows[1].member.league_id,
                          memberId: podiumRows[1].member.user_id,
                        },
                      })
                    }
                    rank={rankForRow(podiumRows[1], boardView)}
                    row={podiumRows[1]}
                    trend={trendForRow(podiumRows[1], boardView)}
                    value={valueFor(podiumRows[1])}
                  />
                </View>
                {/* Gold (rank 1) in the center, larger and raised */}
                <View style={{ flex: 1.15 }}>
                  <PodiumCard
                    cosmetics={cosmeticsByUserId[podiumRows[0].member.user_id]}
                    featured
                    isUser={podiumRows[0].member.user_id === user?.id}
                    onPress={() =>
                      router.push({
                        pathname: '/members/[memberId]',
                        params: {
                          leagueId: podiumRows[0].member.league_id,
                          memberId: podiumRows[0].member.user_id,
                        },
                      })
                    }
                    rank={rankForRow(podiumRows[0], boardView)}
                    row={podiumRows[0]}
                    trend={trendForRow(podiumRows[0], boardView)}
                    value={valueFor(podiumRows[0])}
                  />
                </View>
                {/* Bronze (rank 3) on the right */}
                <View style={{ flex: 1, paddingBottom: 16 }}>
                  <PodiumCard
                    cosmetics={cosmeticsByUserId[podiumRows[2].member.user_id]}
                    isUser={podiumRows[2].member.user_id === user?.id}
                    onPress={() =>
                      router.push({
                        pathname: '/members/[memberId]',
                        params: {
                          leagueId: podiumRows[2].member.league_id,
                          memberId: podiumRows[2].member.user_id,
                        },
                      })
                    }
                    rank={rankForRow(podiumRows[2], boardView)}
                    row={podiumRows[2]}
                    trend={trendForRow(podiumRows[2], boardView)}
                    value={valueFor(podiumRows[2])}
                  />
                </View>
              </View>
            ) : null}

            <Card padded={false} style={{ marginTop: 4 }}>
              <View>
                <View className="flex-row items-center gap-3 px-4 pb-2 pt-3">
                  <Text
                    className="w-12 text-xs font-bold uppercase text-white/55"
                    style={{ letterSpacing: 1.2 }}>
                    Rank
                  </Text>
                  <Text
                    className="flex-1 text-xs font-bold uppercase text-white/55"
                    style={{ letterSpacing: 1.2 }}>
                    Player
                  </Text>
                  <Text
                    className="text-xs font-bold uppercase text-white/55"
                    style={{ letterSpacing: 1.2 }}>
                    {boardView === 'week' ? 'Week' : 'Total'}
                  </Text>
                </View>
                <View className="h-px bg-white/[0.08]" />
                {sortedRows.map((row, index) => {
                  const isUser = row.member.user_id === user?.id;
                  const isLast = index === sortedRows.length - 1;
                  const value = valueFor(row);
                  const rowRank = rankForRow(row, boardView);
                  return (
                    <StaggeredItem index={index} key={row.member.id} perItemDelay={45}>
                      <LeaderboardListRow
                        cosmetics={cosmeticsByUserId[row.member.user_id]}
                        isUser={isUser}
                        onPress={() =>
                          router.push({
                            pathname: '/members/[memberId]',
                            params: {
                              leagueId: row.member.league_id,
                              memberId: row.member.user_id,
                            },
                          })
                        }
                        row={row}
                        showRank={rowRank}
                        trend={trendForRow(row, boardView)}
                        value={value}
                      />
                      {!isLast ? <View className="h-px bg-white/[0.05]" /> : null}
                    </StaggeredItem>
                  );
                })}
              </View>
            </Card>
          </View>
        ) : null}

        {!leaderboardQuery.isLoading && sortedRows.length === 0 ? (
          <Card>
            <View className="items-center gap-5 py-4">
              <View className="h-20 w-20 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
                <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={36} />
              </View>
              <View className="items-center gap-2.5">
                <Text
                  className="text-2xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.4 }}>
                  No Standings Yet
                </Text>
                <Text className="px-2 text-center text-base font-semibold leading-snug text-white/65">
                  Join a league to start climbing the ladder and stacking profit on the board.
                </Text>
              </View>
              <View className="w-full gap-3">
                <Button title="Join a League" onPress={() => router.push('/leagues/join')} />
                <Button
                  title="Create a League"
                  variant="secondary"
                  onPress={() => router.push('/leagues/create')}
                />
              </View>
            </View>
          </Card>
        ) : null}
      </ScrollView>

    </ScreenWrapper>
  );
}
