import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { CosmeticAvatar } from '@/components/cosmetics';
import { ProfileContent } from '@/components/profile/profile-content';
import { Card, ScreenWrapper } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { useProfileData } from '@/hooks/use-profile-stats';
import { logAnalyticsEvent } from '@/lib/analytics';

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
  const cosmeticsQuery = useUserCosmetics(user?.id);

  useEffect(() => {
    logAnalyticsEvent('profile_viewed', {
      screen: 'profile_tab',
      user_id: user?.id,
    });
  }, [user?.id]);

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
        <Card tone="highlight">
          <View className="gap-4">
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-row items-center gap-3">
                <CosmeticAvatar
                  cosmetics={cosmeticsQuery.data?.equippedByCategory}
                  name={profileQuery.data?.profile.display_name ?? user?.email ?? 'Player'}
                  size="lg"
                />
                <View>
                  <Text
                    className="text-[10px] font-black uppercase text-electric-green"
                    style={{ letterSpacing: 2 }}>
                    Locker
                  </Text>
                  <Text className="mt-1 text-lg font-black text-white">
                    {cosmeticsQuery.data?.coinBalance ?? 0} Arena Coins
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/shop')}
                style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
                <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gold/45 bg-gold/15">
                  <Ionicons color={THEME_COLORS.gold} name="storefront" size={22} />
                </View>
              </Pressable>
            </View>
            <View className="flex-row gap-3">
              {[
                { icon: 'storefront' as const, label: 'Shop', route: '/shop' as const },
                { icon: 'cash' as const, label: 'Coins', route: '/coin-store' as const },
                { icon: 'ribbon' as const, label: 'Pass', route: '/season-pass' as const },
                { icon: 'analytics' as const, label: 'Stats', route: '/analytics' as const },
              ].map((action) => (
                <Pressable
                  accessibilityRole="button"
                  key={action.route}
                  onPress={() => router.push(action.route)}
                  style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.78 : 1 })}>
                  <View className="items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3">
                    <Ionicons color={THEME_COLORS.electricGreen} name={action.icon} size={17} />
                    <Text className="text-[10px] font-black uppercase text-white/70">
                      {action.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </Card>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
          <Card>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text
                  className="text-xs font-black uppercase text-electric-green"
                  style={{ letterSpacing: 2 }}>
                  Preferences
                </Text>
                <Text className="mt-1 text-lg font-black text-white">
                  App Settings
                </Text>
              </View>
              <Ionicons color={THEME_COLORS.electricGreen} name="settings" size={24} />
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
