import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { CosmeticAvatar } from '@/components/cosmetics';
import { ProfileContent } from '@/components/profile/profile-content';
import { AnimatedNumber, Badge, Card, ScreenWrapper } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { useProfileData } from '@/hooks/use-profile-stats';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { logAnalyticsEvent } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';

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
  const seasonPassQuery = useSeasonPass(user?.id);
  const hasSeasonPass = Boolean(seasonPassQuery.data);
  const quickActions = [
    { icon: 'storefront' as const, label: 'Shop', route: '/shop' as const },
    { icon: 'ellipse' as const, label: 'Coins', route: '/coin-store' as const },
    { icon: 'ribbon' as const, label: 'Pass', route: '/season-pass' as const },
    { icon: 'analytics' as const, label: 'Analytics', route: '/analytics' as const },
  ];

  useEffect(() => {
    logAnalyticsEvent('profile_viewed', {
      screen: 'profile_tab',
      user_id: user?.id,
    });
  }, [user?.id]);

  return (
    <ScreenWrapper className="pb-0" topSafe>
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
                    className="text-[11px] font-semibold uppercase text-electric-green"
                    style={{ letterSpacing: 1.2 }}>
                    Locker
                  </Text>
                  <View className="mt-0.5 flex-row items-baseline gap-1">
                    <AnimatedNumber
                      className="text-lg font-extrabold text-white"
                      style={{ letterSpacing: -0.3 }}
                      value={cosmeticsQuery.data?.coinBalance ?? 0}
                    />
                    <Text className="text-xs font-medium text-white/55">Arena Coins</Text>
                  </View>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.light();
                  router.push('/shop');
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
                <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gold/45 bg-gold/15">
                  <Ionicons color={THEME_COLORS.gold} name="storefront" size={22} />
                </View>
              </Pressable>
            </View>
            <View className="flex-row gap-3">
              {quickActions.map((action) => (
                <Pressable
                  accessibilityRole="button"
                  key={action.route}
                  onPress={() => {
                    haptics.light();
                    router.push(action.route);
                  }}
                  style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.78 : 1 })}>
                  <View className="items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3">
                    <Ionicons color={THEME_COLORS.electricGreen} name={action.icon} size={17} />
                    <Text
                      adjustsFontSizeToFit
                      className="text-[11px] font-semibold text-white/75"
                      minimumFontScale={0.75}
                      numberOfLines={1}>
                      {action.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <View
              className={
                hasSeasonPass
                  ? 'flex-row items-center justify-between gap-3 rounded-2xl border border-electric-green/35 bg-electric-green/10 p-3'
                  : 'flex-row items-center justify-between gap-3 rounded-2xl border border-gold/35 bg-gold/10 p-3'
              }>
              <View className="flex-1 flex-row items-center gap-2">
                <Ionicons
                  color={hasSeasonPass ? THEME_COLORS.electricGreen : THEME_COLORS.gold}
                  name="ribbon"
                  size={16}
                />
                <Text className="flex-1 text-sm font-bold text-white">
                  {hasSeasonPass
                    ? 'Season Pass holder'
                    : 'Season Pass preview available'}
                </Text>
              </View>
              <Badge
                label={hasSeasonPass ? 'Active' : 'Free'}
                tone={hasSeasonPass ? 'green' : 'gold'}
              />
            </View>
          </View>
        </Card>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.light();
            router.push('/settings');
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
          <Card>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text
                  className="text-[11px] font-semibold uppercase text-electric-green"
                  style={{ letterSpacing: 1.2 }}>
                  Preferences
                </Text>
                <Text className="mt-0.5 text-base font-extrabold text-white" style={{ letterSpacing: -0.2 }}>
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
