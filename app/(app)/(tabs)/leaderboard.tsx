import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  Badge,
  Card,
  ScreenWrapper,
  StaggeredItem,
} from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { type LeaderboardRow, useLeaderboardData } from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import { formatProfit, formatRecord, getProfitTone } from '@/lib/format';

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

const BOARD_VIEW_OPTIONS: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: BoardView;
}[] = [
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

function BoardViewToggle({
  onChange,
  value,
}: {
  onChange: (nextValue: BoardView) => void;
  value: BoardView;
}) {
  return (
    <View
      className="flex-row rounded-xl border border-white/10 bg-white/[0.04]"
      style={{ padding: 3 }}>
      {BOARD_VIEW_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <TapTarget
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{ flex: 1 }}>
            <View
              className={cn(
                'h-9 flex-row items-center justify-center gap-1.5 rounded-lg',
                active ? 'bg-electric-green/15' : 'bg-transparent',
              )}>
              <Ionicons
                color={active ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.55)'}
                name={option.icon}
                size={13}
              />
              <Text
                className={cn(
                  'text-xs font-semibold',
                  active ? 'text-electric-green' : 'text-white/60',
                )}>
                {option.label}
              </Text>
            </View>
          </TapTarget>
        );
      })}
    </View>
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
      bg: 'bg-white/[0.10]',
      border: 'border-white/35',
      icon: 'medal',
      iconColor: '#D8E0EE',
      label: 'Silver',
      text: 'text-white',
    };
  }
  if (rank === 3) {
    return {
      bg: 'bg-amber-accent/[0.12]',
      border: 'border-amber-accent/45',
      icon: 'medal',
      iconColor: THEME_COLORS.amberAccent,
      label: 'Bronze',
      text: 'text-amber-accent',
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

function trendDescriptor(trend: LeaderboardRow['trend']) {
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
  return {
    bg: 'bg-white/[0.05]',
    border: 'border-white/15',
    color: 'rgba(255,255,255,0.55)',
    icon: 'remove' as const,
    label: 'Even',
    text: 'text-white/55',
  };
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
  index,
  isUser,
  onPress,
  row,
  value,
}: {
  index: number;
  isUser: boolean;
  onPress: () => void;
  row: LeaderboardRow;
  value: number;
}) {
  const accent = rankAccent(row.standing?.rank ?? index + 1);
  const trend = trendDescriptor(row.trend);
  const initials = getInitials(row.member.team_name || row.profile?.display_name || '?');

  return (
    <TapTarget onPress={onPress} style={{ flex: 1 }}>
      <View
        className={cn('flex-1 items-center rounded-2xl border p-2.5', accent.bg, accent.border)}
        style={
          accent.glow
            ? {
                shadowColor: accent.glow,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
              }
            : undefined
        }>
        <Ionicons color={accent.iconColor} name={accent.icon} size={16} />
        <View
          className={cn(
            'mt-1.5 h-10 w-10 items-center justify-center rounded-xl border',
            accent.border,
            accent.bg,
          )}>
          <Text className={cn('text-sm font-bold uppercase', accent.text)}>
            {initials || '?'}
          </Text>
        </View>
        <Text
          className="mt-1.5 text-center text-xs font-semibold text-white"
          numberOfLines={1}>
          {row.member.team_name}
        </Text>
        <View className="mt-1 flex-row items-center gap-1">
          <Ionicons color={trend.color} name={trend.icon} size={10} />
          <Text className={cn('text-sm font-bold', getProfitTone(value))} style={{ letterSpacing: -0.2 }}>
            {formatProfit(value)}
          </Text>
        </View>
        {isUser ? (
          <View className="mt-1 rounded-full border border-electric-green/40 bg-electric-green/15 px-1.5 py-px">
            <Text className="text-[10px] font-semibold text-electric-green">You</Text>
          </View>
        ) : null}
      </View>
    </TapTarget>
  );
}

function LeaderboardListRow({
  isUser,
  onPress,
  row,
  showRank,
  value,
}: {
  isUser: boolean;
  onPress: () => void;
  row: LeaderboardRow;
  showRank: number;
  value: number;
}) {
  const accent = rankAccent(showRank);
  const trend = trendDescriptor(row.trend);

  return (
    <TapTarget onPress={onPress}>
      <View
        className={cn(
          'flex-row items-center gap-3 px-4 py-3',
          isUser ? 'bg-electric-green/[0.08]' : null,
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
          <View
            className={cn(
              'flex-row items-center gap-1 rounded-full border px-1.5 py-px',
              trend.bg,
              trend.border,
            )}>
            <Ionicons color={trend.color} name={trend.icon} size={9} />
            <Text className={cn('text-[10px] font-semibold', trend.text)}>
              {trend.label}
            </Text>
          </View>
        </View>
      </View>
    </TapTarget>
  );
}

function StickyUserBar({
  boardView,
  isLeading,
  onPress,
  row,
  totalRows,
  value,
}: {
  boardView: BoardView;
  isLeading: boolean;
  onPress: () => void;
  row: LeaderboardRow;
  totalRows: number;
  value: number;
}) {
  const trend = trendDescriptor(row.trend);
  const rank = row.standing?.rank ?? totalRows;

  return (
    <TapTarget onPress={onPress}>
      <View
        className="flex-row items-center gap-3 rounded-2xl border border-electric-green/55 bg-arena-surface p-2.5"
        style={{
          shadowColor: THEME_COLORS.electricGreen,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
        }}>
        <View
          className="h-10 w-10 items-center justify-center rounded-xl border border-electric-green/55 bg-electric-green/15"
          style={{
            shadowColor: THEME_COLORS.electricGreen,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.45,
            shadowRadius: 8,
          }}>
          <Text className="text-sm font-bold text-electric-green">#{rank}</Text>
        </View>
        <View className="flex-1">
          <Text
            className="text-[10px] font-semibold uppercase text-electric-green"
            style={{ letterSpacing: 0.5 }}>
            Your Position{isLeading ? ' · Leading' : ''}
          </Text>
          <Text
            className="text-sm font-bold text-white"
            numberOfLines={1}
            style={{ letterSpacing: -0.2 }}>
            {row.member.team_name}
          </Text>
          <Text className="text-[11px] font-medium text-white/55" numberOfLines={1}>
            {boardView === 'season' ? 'Total' : 'This Week'} ·{' '}
            {row.standing
              ? formatRecord(row.standing.wins, row.standing.losses, row.standing.ties)
              : '0-0'}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text
            className={cn('text-base font-bold', getProfitTone(value))}
            style={{ letterSpacing: -0.3 }}>
            {formatProfit(value)}
          </Text>
          <View
            className={cn(
              'flex-row items-center gap-1 rounded-full border px-1.5 py-px',
              trend.bg,
              trend.border,
            )}>
            <Ionicons color={trend.color} name={trend.icon} size={9} />
            <Text className={cn('text-[10px] font-semibold', trend.text)}>
              {trend.label}
            </Text>
          </View>
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
  const selectedLeague = useMemo(
    () =>
      leaderboardQuery.data?.leagues.find((league) => league.id === selectedLeagueId) ??
      leaderboardQuery.data?.leagues[0] ??
      null,
    [leaderboardQuery.data?.leagues, selectedLeagueId],
  );
  const sortedRows = useMemo(() => {
    const source = leaderboardQuery.data?.rows ?? [];
    if (boardView === 'week') {
      return [...source].sort(
        (left, right) =>
          (right.standing?.weekly_profit ?? 0) - (left.standing?.weekly_profit ?? 0),
      );
    }
    return source;
  }, [boardView, leaderboardQuery.data?.rows]);

  const userRowIndex = sortedRows.findIndex((row) => row.member.user_id === user?.id);
  const userRow = userRowIndex >= 0 ? sortedRows[userRowIndex] : null;
  const podiumRows = sortedRows.slice(0, Math.min(3, sortedRows.length));

  const valueFor = (row: LeaderboardRow | undefined) =>
    row && row.standing
      ? boardView === 'week'
        ? row.standing.weekly_profit
        : row.standing.total_profit
      : 0;

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 18, paddingBottom: userRow ? 130 : 36 }}
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
              className="text-[11px] font-semibold uppercase text-electric-green"
              style={{ letterSpacing: 1.2 }}>
              League Ladder
            </Text>
          </View>
          <Text
            className="mt-1 text-2xl font-extrabold text-white"
            style={{ letterSpacing: -0.4 }}>
            Leaderboard
          </Text>
          <Text className="mt-1 text-sm font-medium text-white/55">
            Profit, records, and weekly movement across your league.
          </Text>
        </View>

        {leaderboardQuery.isLoading ? <LoadingState /> : null}

        {!leaderboardQuery.isLoading && leaderboardQuery.data ? (
          <View className="gap-4">
            {leaderboardQuery.data.leagueOptions.length > 1 ? (
              <View className="flex-row flex-wrap gap-2">
                {leaderboardQuery.data.leagueOptions.map((league) => {
                  const active =
                    (selectedLeague?.id ?? leaderboardQuery.data?.leagueOptions[0]?.id) === league.id;
                  return (
                    <TapTarget key={league.id} onPress={() => setSelectedLeagueId(league.id)}>
                      <View
                        className={cn(
                          'rounded-full border px-3 py-1.5',
                          active
                            ? 'border-electric-green/55 bg-electric-green/15'
                            : 'border-white/10 bg-white/[0.04]',
                        )}>
                        <Text
                          className={cn(
                            'text-xs font-semibold',
                            active ? 'text-electric-green' : 'text-white/65',
                          )}>
                          {league.label}
                        </Text>
                      </View>
                    </TapTarget>
                  );
                })}
              </View>
            ) : null}

            <BoardViewToggle onChange={setBoardView} value={boardView} />

            {podiumRows.length >= 3 ? (
              <View className="flex-row items-end gap-3">
                {/* Reorder so #2 - #1 - #3 visually podium */}
                <PodiumCard
                  index={1}
                  isUser={podiumRows[1]?.member.user_id === user?.id}
                  onPress={() =>
                    podiumRows[1] &&
                    router.push({
                      pathname: '/members/[memberId]',
                      params: {
                        leagueId: podiumRows[1].member.league_id,
                        memberId: podiumRows[1].member.user_id,
                      },
                    })
                  }
                  row={podiumRows[1]}
                  value={valueFor(podiumRows[1])}
                />
                <View className="flex-1" style={{ marginBottom: 12 }}>
                  <PodiumCard
                    index={0}
                    isUser={podiumRows[0]?.member.user_id === user?.id}
                    onPress={() =>
                      podiumRows[0] &&
                      router.push({
                        pathname: '/members/[memberId]',
                        params: {
                          leagueId: podiumRows[0].member.league_id,
                          memberId: podiumRows[0].member.user_id,
                        },
                      })
                    }
                    row={podiumRows[0]}
                    value={valueFor(podiumRows[0])}
                  />
                </View>
                <PodiumCard
                  index={2}
                  isUser={podiumRows[2]?.member.user_id === user?.id}
                  onPress={() =>
                    podiumRows[2] &&
                    router.push({
                      pathname: '/members/[memberId]',
                      params: {
                        leagueId: podiumRows[2].member.league_id,
                        memberId: podiumRows[2].member.user_id,
                      },
                    })
                  }
                  row={podiumRows[2]}
                  value={valueFor(podiumRows[2])}
                />
              </View>
            ) : null}

            <Card padded={false}>
              <View>
                <View className="flex-row items-center gap-3 px-4 pb-2 pt-3">
                  <Text
                    className="w-12 text-[11px] font-semibold uppercase text-white/45"
                    style={{ letterSpacing: 0.4 }}>
                    Rank
                  </Text>
                  <Text
                    className="flex-1 text-[11px] font-semibold uppercase text-white/45"
                    style={{ letterSpacing: 0.4 }}>
                    Player
                  </Text>
                  <Text
                    className="text-[11px] font-semibold uppercase text-white/45"
                    style={{ letterSpacing: 0.4 }}>
                    {boardView === 'week' ? 'Week' : 'Total'}
                  </Text>
                </View>
                <View className="h-px bg-white/[0.08]" />
                {sortedRows.map((row, index) => {
                  const isUser = row.member.user_id === user?.id;
                  const isLast = index === sortedRows.length - 1;
                  const value = valueFor(row);
                  return (
                    <StaggeredItem index={index} key={row.member.id} perItemDelay={45}>
                      <LeaderboardListRow
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
                        showRank={index + 1}
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
            <View className="items-center gap-2.5 py-1">
              <View className="h-11 w-11 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
                <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={20} />
              </View>
              <Text
                className="text-base font-semibold text-white"
                style={{ letterSpacing: -0.2 }}>
                No standings yet
              </Text>
              <Text className="text-center text-xs font-medium text-white/55">
                Join a league to start climbing the ladder.
              </Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {userRow ? (
        <View
          pointerEvents="box-none"
          style={{
            bottom: 12,
            left: 16,
            position: 'absolute',
            right: 16,
          }}>
          <StickyUserBar
            boardView={boardView}
            isLeading={userRowIndex === 0}
            onPress={() =>
              router.push({
                pathname: '/members/[memberId]',
                params: {
                  leagueId: userRow.member.league_id,
                  memberId: userRow.member.user_id,
                },
              })
            }
            row={userRow}
            totalRows={sortedRows.length}
            value={valueFor(userRow)}
          />
        </View>
      ) : null}
    </ScreenWrapper>
  );
}
