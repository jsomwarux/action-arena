import { Stack } from 'expo-router';

import { THEME_COLORS } from '@/constants/theme';

export default function LeaguesStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: THEME_COLORS.background },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: THEME_COLORS.background },
        headerTintColor: THEME_COLORS.textPrimary,
        headerTitleStyle: {
          fontWeight: '900',
        },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Leagues' }} />
      <Stack.Screen
        name="[leagueId]"
        options={{ headerBackTitle: 'Leagues', title: 'League Detail' }}
      />
    </Stack>
  );
}
