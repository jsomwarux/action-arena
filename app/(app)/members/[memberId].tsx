import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileContent } from '@/components/profile/profile-content';
import { Card, PressableScale, SkeletonLoader } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { buildMemberComparison, useProfileData } from '@/hooks/use-profile-stats';
import { logAnalyticsEvent } from '@/lib/analytics';

function getParamValue(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function LoadingState() {
  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <View className="gap-4 px-5 py-6">
        <SkeletonLoader height={34} width="65%" />
        <SkeletonLoader height={160} />
        <SkeletonLoader height={180} />
      </View>
    </SafeAreaView>
  );
}

export default function MemberProfileScreen() {
  const router = useRouter();
  const { memberId, leagueId } = useLocalSearchParams();
  const resolvedMemberId = getParamValue(memberId);
  const resolvedLeagueId = getParamValue(leagueId);
  const { user } = useAuth();
  const profileQuery = useProfileData({
    leagueId: resolvedLeagueId,
    targetUserId: resolvedMemberId,
    viewerUserId: user?.id,
  });

  useEffect(() => {
    if (!resolvedMemberId) return;
    logAnalyticsEvent('profile_viewed', {
      league_id: resolvedLeagueId,
      target_user_id: resolvedMemberId,
      user_id: user?.id,
    });
  }, [resolvedLeagueId, resolvedMemberId, user?.id]);

  if (profileQuery.isLoading) {
    return <LoadingState />;
  }

  const comparison =
    profileQuery.data && resolvedLeagueId && user?.id && resolvedMemberId && user.id !== resolvedMemberId
      ? buildMemberComparison(profileQuery.data, resolvedLeagueId, resolvedMemberId, user.id)
      : undefined;

  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 18, padding: 20, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={profileQuery.isRefetching}
            onRefresh={profileQuery.refetch}
          />
        }
        showsVerticalScrollIndicator={false}>
        <PressableScale onPress={() => router.back()}>
          <View className="flex-row items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.05] px-3 py-2">
            <Ionicons color={THEME_COLORS.textPrimary} name="chevron-back" size={16} />
            <Text className="text-xs font-black uppercase text-white" style={{ letterSpacing: 1.2 }}>
              Back
            </Text>
          </View>
        </PressableScale>

        {profileQuery.data ? (
          <ProfileContent
            comparison={comparison}
            data={profileQuery.data}
            initialLeagueId={resolvedLeagueId ?? 'all'}
            readOnlyLeague={Boolean(resolvedLeagueId)}
            title="Member Profile"
          />
        ) : (
          <Card>
            <Text className="text-base font-semibold text-white/55">Member profile is unavailable.</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
