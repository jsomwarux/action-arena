import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { LOCAL_FLAG_KEYS, useLocalFlag } from '@/hooks/use-local-flags';

export default function AuthLayout() {
  const { isLoading, session } = useAuth();
  const pathname = usePathname();
  const onboardingFlag = useLocalFlag(LOCAL_FLAG_KEYS.onboardingComplete);
  const isPasswordResetRoute = pathname === '/reset-password';

  if (isLoading || onboardingFlag.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-arena-bg">
        <ActivityIndicator color={THEME_COLORS.electricGreen} />
      </View>
    );
  }

  if (session && !isPasswordResetRoute) {
    return <Redirect href="/" />;
  }

  if (!onboardingFlag.value && !isPasswordResetRoute) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        animationDuration: 220,
        contentStyle: { backgroundColor: THEME_COLORS.background },
        headerShown: false,
      }}
    />
  );
}
