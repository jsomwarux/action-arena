import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { BackButton } from '@/components/ui/back-button';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { hasSeenActionArenaDisclosure } from '@/hooks/use-disclosure';

export default function AppLayout() {
  const { isLoading, session } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-arena-bg">
        <ActivityIndicator color={THEME_COLORS.electricGreen} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!hasSeenActionArenaDisclosure(session.user) && pathname !== '/disclosure') {
    return <Redirect href="/disclosure" />;
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: THEME_COLORS.background },
        headerBackButtonDisplayMode: 'minimal',
        headerBackVisible: false,
        headerLeft: () => <BackButton />,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: THEME_COLORS.background },
        headerTintColor: THEME_COLORS.electricGreen,
        headerTitleStyle: {
          fontWeight: '900',
        },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="disclosure" options={{ title: 'How Action Arena Works' }} />
      <Stack.Screen name="leagues/create" options={{ title: 'Create League' }} />
      <Stack.Screen name="leagues/join" options={{ title: 'Join League' }} />
      <Stack.Screen name="matchups/[matchupId]" options={{ title: 'Matchup Detail' }} />
      <Stack.Screen name="members/[memberId]" options={{ title: 'Member Profile' }} />
      <Stack.Screen name="bets/[betId]" options={{ title: 'Pick Detail' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="shop" options={{ title: 'Arena Shop' }} />
      <Stack.Screen name="coin-store" options={{ title: 'Coin Store' }} />
      <Stack.Screen name="season-pass" options={{ title: 'Season Pass' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="notifications/preferences" options={{ title: 'Notifications' }} />
    </Stack>
  );
}
