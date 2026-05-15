import { Stack } from 'expo-router';

import { THEME_COLORS } from '@/constants/theme';

export default function LeaguesStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: THEME_COLORS.background },
        headerBackButtonDisplayMode: 'minimal',
        headerBackVisible: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: THEME_COLORS.background },
        headerTintColor: THEME_COLORS.electricGreen,
        headerTitleStyle: {
          fontWeight: '900',
        },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Leagues' }} />
      {/* League Detail renders its own in-content back button, so the native
          header is hidden to reclaim the vertical space it used to consume. */}
      <Stack.Screen name="[leagueId]" options={{ headerShown: false }} />
    </Stack>
  );
}
