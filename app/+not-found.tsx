import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';

import { ScreenWrapper } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <ScreenWrapper centered>
        <Text className="text-center text-2xl font-black text-white">This screen does not exist.</Text>

        <Link className="mt-4 py-4" href="/">
          <Text className="text-sm font-black uppercase tracking-normal text-electric-green">
            Go to Home
          </Text>
        </Link>
      </ScreenWrapper>
    </>
  );
}
