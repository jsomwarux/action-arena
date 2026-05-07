import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  PressableScale,
  ScreenWrapper,
  SkeletonLoader,
  StaggeredItem,
} from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { type LeagueSummary, useMyLeagues } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import { formatLeagueType, formatProfit, formatRecord, formatSport, getProfitTone } from '@/lib/format';

function LeagueCard({ index, item }: { index: number; item: LeagueSummary }) {
  const router = useRouter();
  const { currentUserStanding, league, memberCount } = item;
  const isH2H = league.type === 'h2h';
  const totalProfit = currentUserStanding?.total_profit ?? 0;

  return (
    <StaggeredItem index={index} perItemDelay={70} style={{ marginBottom: 14 }}>
      <PressableScale
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/(app)/(tabs)/leagues/[leagueId]',
            params: { leagueId: league.id },
          })
        }>
        <Card>
          <View className="gap-4">
            <View className="flex-row items-start gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-electric-green/30 bg-electric-green/10">
                <Ionicons color={THEME_COLORS.electricGreen} name="american-football" size={22} />
              </View>
              <View className="flex-1 gap-2">
                <Text
                  className="text-xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.3 }}
                  numberOfLines={1}>
                  {league.name}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Badge label={formatLeagueType(league.type)} tone={isH2H ? 'cyan' : 'gold'} />
                  <Badge label={formatSport(league.sport)} tone="green" />
                </View>
              </View>
              <View className="items-end">
                <Text
                  className="text-[10px] font-black uppercase text-white/45"
                  style={{ letterSpacing: 1.5 }}>
                  Roster
                </Text>
                <Text className="mt-1 text-base font-black text-white">
                  {memberCount}
                  <Text className="text-white/40">/{league.max_members}</Text>
                </Text>
              </View>
            </View>

            <View className="h-px bg-white/[0.08]" />

            <View className="flex-row items-end justify-between">
              <View>
                <Text
                  className="text-[10px] font-black uppercase text-white/45"
                  style={{ letterSpacing: 1.5 }}>
                  Rank
                </Text>
                <Text className="mt-1 text-3xl font-black text-gold" style={{ letterSpacing: -1 }}>
                  #{currentUserStanding?.rank ?? '–'}
                </Text>
              </View>
              <View className="items-end">
                <Text
                  className="text-[10px] font-black uppercase text-white/45"
                  style={{ letterSpacing: 1.5 }}>
                  {isH2H ? 'Record' : 'Total Profit'}
                </Text>
                <Text
                  className={cn(
                    'mt-1 text-3xl font-black',
                    isH2H ? 'text-white' : getProfitTone(totalProfit),
                  )}
                  style={{ letterSpacing: -1 }}>
                  {isH2H
                    ? formatRecord(
                        currentUserStanding?.wins ?? 0,
                        currentUserStanding?.losses ?? 0,
                        currentUserStanding?.ties ?? 0,
                      )
                    : formatProfit(totalProfit)}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </PressableScale>
    </StaggeredItem>
  );
}

function LeagueSkeletons() {
  return (
    <View className="gap-4">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <View className="gap-4">
            <View className="flex-row items-center gap-3">
              <SkeletonLoader height={48} width={48} radius={16} />
              <View className="flex-1 gap-2">
                <SkeletonLoader height={20} width="65%" />
                <SkeletonLoader height={14} width="38%" />
              </View>
            </View>
            <SkeletonLoader height={70} radius={12} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <Card>
      <View className="items-center gap-5 py-4">
        <View className="relative h-20 w-20 items-center justify-center">
          <View className="absolute h-20 w-20 rounded-full border border-electric-green/20 bg-electric-green/5" />
          <View className="absolute h-14 w-14 rounded-full border border-electric-green/40" />
          <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={32} />
        </View>
        <View className="items-center gap-2">
          <Text
            className="text-2xl font-black uppercase text-white"
            style={{ letterSpacing: -0.4 }}>
            Your Arena Awaits
          </Text>
          <Text className="px-2 text-center text-base font-semibold leading-snug text-white/65">
            Spin up a league for your crew or jump into a public room and start stacking profit.
          </Text>
        </View>
        <View className="w-full gap-3">
          <Button title="Create a League" onPress={() => router.push('/leagues/create')} />
          <Button
            title="Join with Code"
            variant="secondary"
            onPress={() => router.push('/leagues/join')}
          />
        </View>
      </View>
    </Card>
  );
}

export default function LeaguesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const leaguesQuery = useMyLeagues(user?.id);
  const data = leaguesQuery.data ?? [];

  return (
    <ScreenWrapper className="pb-0">
      <View className="mb-4 gap-3">
        <View>
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            <Text
              className="text-xs font-semibold uppercase text-electric-green"
              style={{ letterSpacing: 1.2 }}>
              The Arena
            </Text>
          </View>
          <Text
            className="mt-1 text-3xl font-extrabold text-white"
            style={{ letterSpacing: -0.5 }}>
            My Leagues
          </Text>
          <Text className="mt-1.5 text-base font-medium text-white/60">
            Track your standings, matchups, and league rooms.
          </Text>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button title="Create" onPress={() => router.push('/leagues/create')} />
          </View>
          <View className="flex-1">
            <Button
              title="Join"
              variant="secondary"
              onPress={() => router.push('/leagues/join')}
            />
          </View>
        </View>
      </View>

      {leaguesQuery.isLoading ? (
        <LeagueSkeletons />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: 24 }}
          data={data}
          keyExtractor={(item) => item.league.id}
          refreshControl={
            <RefreshControl
              tintColor={THEME_COLORS.electricGreen}
              refreshing={leaguesQuery.isRefetching}
              onRefresh={leaguesQuery.refetch}
            />
          }
          ListEmptyComponent={<EmptyState />}
          renderItem={({ index, item }) => <LeagueCard index={index} item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenWrapper>
  );
}
