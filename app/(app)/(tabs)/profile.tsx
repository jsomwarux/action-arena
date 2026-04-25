import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { ProfileContent } from '@/components/profile/profile-content';
import { Card, ScreenWrapper } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfileData } from '@/hooks/use-profile-stats';

function StaticSkeleton({
  height,
  radius = 10,
  width = '100%',
}: {
  height: number;
  radius?: number;
  width?: number | `${number}%`;
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

function LoadingState() {
  return (
    <View className="gap-4">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <View className="gap-4">
            <StaticSkeleton height={24} width="60%" />
            <StaticSkeleton height={90} />
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const profileQuery = useProfileData({
    targetUserId: user?.id,
    viewerUserId: user?.id,
  });

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 18, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={profileQuery.isRefetching}
            onRefresh={profileQuery.refetch}
          />
        }
        showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
          <Card>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text
                  className="text-[10px] font-black uppercase text-electric-green"
                  style={{ letterSpacing: 2 }}>
                  Preferences
                </Text>
                <Text className="mt-1 text-base font-black text-white">
                  App Settings
                </Text>
              </View>
              <Ionicons color={THEME_COLORS.electricGreen} name="settings" size={22} />
            </View>
          </Card>
        </Pressable>
        {profileQuery.isLoading ? <LoadingState /> : null}
        {!profileQuery.isLoading && profileQuery.data ? (
          <ProfileContent data={profileQuery.data} title="My Profile" />
        ) : null}
        {!profileQuery.isLoading && !profileQuery.data ? (
          <Card>
            <Text className="text-base font-semibold text-white/55">Profile data is unavailable.</Text>
          </Card>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}
