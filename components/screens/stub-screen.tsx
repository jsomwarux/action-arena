import { Text, View } from 'react-native';

import { Card, ScreenWrapper } from '@/components/ui';

type StubScreenProps = {
  description?: string;
  title: string;
};

export function StubScreen({
  description = 'This screen is wired into the navigation shell. Real content lands here next.',
  title,
}: StubScreenProps) {
  return (
    <ScreenWrapper scroll>
      <View className="flex-1 justify-center">
        <View className="mb-6">
          <View className="flex-row items-center gap-3">
            <View className="h-2 w-2 rounded-full bg-electric-green" />
            <Text
              className="text-[10px] font-black uppercase text-electric-green"
              style={{ letterSpacing: 3 }}>
              Action Arena
            </Text>
          </View>
          <Text
            className="mt-3 text-5xl font-black uppercase text-white"
            style={{ letterSpacing: -1, lineHeight: 50 }}>
            {title}
          </Text>
        </View>

        <Card>
          <Text className="text-base font-semibold text-white/70" style={{ lineHeight: 22 }}>
            {description}
          </Text>
        </Card>
      </View>
    </ScreenWrapper>
  );
}
