import { Stack } from 'expo-router';

import { BackButton } from '@/components/ui/back-button';
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
      <Stack.Screen
        name="[leagueId]"
        options={{
          headerLeft: () => <BackButton fallbackHref="/leagues" />,
          title: 'League Detail',
        }}
      />
    </Stack>
  );
}
