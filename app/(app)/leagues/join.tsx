import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  PressableScale,
  ScreenWrapper,
  SkeletonLoader,
  StaggeredItem,
  TextInput,
} from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { type PublicLeagueSummary, useJoinLeagueMutation, usePublicLeagues } from '@/hooks/use-leagues';
import { formatLeagueType, formatSport } from '@/lib/format';

function PublicLeagueCard({
  index,
  isJoining,
  item,
  onJoin,
}: {
  index: number;
  isJoining: boolean;
  item: PublicLeagueSummary;
  onJoin: (leagueId: string) => void;
}) {
  const isFull = item.memberCount >= item.league.max_members;
  return (
    <StaggeredItem index={index} perItemDelay={70} style={{ marginBottom: 14 }}>
      <Card>
        <View className="gap-4">
          <View className="flex-row items-start gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10">
              <Ionicons color={THEME_COLORS.cyanAccent} name="globe" size={20} />
            </View>
            <View className="flex-1 gap-1">
              <Text
                className="text-xl font-black uppercase text-white"
                style={{ letterSpacing: -0.3 }}
                numberOfLines={1}>
                {item.league.name}
              </Text>
              <Text className="text-xs font-semibold text-white/50">
                Commissioner · {item.commissioner?.display_name ?? 'Unknown'}
              </Text>
            </View>
            <View className="items-end">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Members
              </Text>
              <Text className="mt-1 text-base font-black text-white">
                {item.memberCount}
                <Text className="text-white/40">/{item.league.max_members}</Text>
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <Badge
              label={formatLeagueType(item.league.type)}
              tone={item.league.type === 'h2h' ? 'cyan' : 'gold'}
            />
            <Badge label={formatSport(item.league.sport)} tone="green" />
            {isFull ? <Badge label="Full Roster" tone="red" /> : null}
          </View>

          <Button
            disabled={isFull}
            loading={isJoining}
            title={isFull ? 'Roster Full' : 'Join League'}
            onPress={() => onJoin(item.league.id)}
          />
        </View>
      </Card>
    </StaggeredItem>
  );
}

function PublicLeagueSkeletons() {
  return (
    <View className="gap-4">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <View className="gap-4">
            <View className="flex-row items-center gap-3">
              <SkeletonLoader height={48} width={48} radius={16} />
              <View className="flex-1 gap-2">
                <SkeletonLoader height={20} width="68%" />
                <SkeletonLoader height={14} width="48%" />
              </View>
            </View>
            <SkeletonLoader height={48} radius={16} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function EmptyPublicLeagues() {
  const router = useRouter();
  return (
    <Card>
      <View className="items-center gap-4 py-2">
        <View className="h-16 w-16 items-center justify-center rounded-full border border-cyan-accent/30 bg-cyan-accent/10">
          <Ionicons color={THEME_COLORS.cyanAccent} name="search" size={26} />
        </View>
        <View className="items-center gap-1">
          <Text
            className="text-2xl font-black uppercase text-white"
            style={{ letterSpacing: -0.4 }}>
            No Public Rooms
          </Text>
          <Text className="px-2 text-center text-base font-semibold text-white/55">
            Try another search or create the room everyone joins next.
          </Text>
        </View>
        <PressableScale onPress={() => router.push('/leagues/create')}>
          <View className="rounded-full border border-electric-green/40 bg-electric-green/15 px-5 py-2">
            <Text
              className="text-xs font-black uppercase text-electric-green"
              style={{ letterSpacing: 1.5 }}>
              Create League
            </Text>
          </View>
        </PressableScale>
      </View>
    </Card>
  );
}

export default function JoinLeagueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [search, setSearch] = useState('');
  const publicLeagues = usePublicLeagues(search);
  const joinLeague = useJoinLeagueMutation(user?.id);

  const handleJoin = async (input: { inviteCode?: string; leagueId?: string }) => {
    try {
      const leagueId = await joinLeague.mutateAsync(input);
      router.replace({ pathname: '/leagues/[leagueId]', params: { leagueId } });
    } catch (error) {
      Alert.alert('Could not join league', error instanceof Error ? error.message : 'Try again.');
    }
  };

  return (
    <ScreenWrapper className="pb-0">
      <View className="mb-4 gap-3">
        <View>
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            <Text
              className="text-[11px] font-semibold uppercase text-electric-green"
              style={{ letterSpacing: 1.2 }}>
              Find a League
            </Text>
          </View>
          <Text
            className="mt-1 text-2xl font-extrabold text-white"
            style={{ letterSpacing: -0.4 }}>
            Join League
          </Text>
          <Text className="mt-1 text-sm font-medium text-white/55">
            Enter a private invite code or browse public rooms.
          </Text>
        </View>

        <Card>
          <View className="gap-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl border border-electric-green/30 bg-electric-green/10">
                <Ionicons color={THEME_COLORS.electricGreen} name="key" size={18} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[10px] font-black uppercase text-electric-green"
                  style={{ letterSpacing: 2 }}>
                  Private League
                </Text>
                <Text className="text-base font-black text-white" style={{ letterSpacing: -0.3 }}>
                  Got an Invite Code?
                </Text>
              </View>
            </View>
            <TextInput
              autoCapitalize="characters"
              label="Invite Code"
              maxLength={6}
              onChangeText={setInviteCode}
              placeholder="A1B2C3"
              value={inviteCode}
            />
            <Button
              loading={joinLeague.isPending && Boolean(inviteCode.trim())}
              title="Join by Code"
              onPress={() => handleJoin({ inviteCode })}
            />
          </View>
        </Card>

        <TextInput
          label="Browse public leagues"
          onChangeText={setSearch}
          placeholder="Search by league name"
          value={search}
        />
      </View>

      {publicLeagues.isLoading ? (
        <PublicLeagueSkeletons />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: 24 }}
          data={publicLeagues.data ?? []}
          keyExtractor={(item) => item.league.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              tintColor={THEME_COLORS.electricGreen}
              refreshing={publicLeagues.isRefetching}
              onRefresh={publicLeagues.refetch}
            />
          }
          ListEmptyComponent={<EmptyPublicLeagues />}
          renderItem={({ index, item }) => (
            <PublicLeagueCard
              index={index}
              isJoining={joinLeague.isPending}
              item={item}
              onJoin={(leagueId) => handleJoin({ leagueId })}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenWrapper>
  );
}
