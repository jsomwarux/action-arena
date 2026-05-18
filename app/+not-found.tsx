import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, ScreenWrapper } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Oops!' }} />
      <ScreenWrapper centered topSafe>
        <Card>
          <View className="items-center gap-4 py-2">
            <View className="h-14 w-14 items-center justify-center rounded-full border border-coral-red/40 bg-coral-red/10">
              <Ionicons color={THEME_COLORS.coralRed} name="alert" size={26} />
            </View>
            <View className="items-center gap-1">
              <Text
                className="text-xl font-extrabold text-white"
                style={{ letterSpacing: -0.3 }}>
                Page not found
              </Text>
              <Text className="text-center text-sm font-medium text-white/55">
                The route you tried to open doesn’t exist.
              </Text>
            </View>
            <Link asChild href="/">
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <View className="flex-row items-center gap-1.5 rounded-full border border-electric-green/55 bg-electric-green/15 px-4 py-2">
                  <Ionicons color={THEME_COLORS.electricGreen} name="home" size={14} />
                  <Text
                    className="text-xs font-bold text-electric-green"
                    style={{ letterSpacing: 0.4 }}>
                    Back to Home
                  </Text>
                </View>
              </Pressable>
            </Link>
          </View>
        </Card>
      </ScreenWrapper>
    </>
  );
}
