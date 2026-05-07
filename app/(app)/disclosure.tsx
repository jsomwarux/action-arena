import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';

import { Button, Card, ScreenWrapper } from '@/components/ui';
import { ACTION_ARENA_DISCLOSURE } from '@/constants/disclosure';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  hasSeenActionArenaDisclosure,
  useAcknowledgeActionArenaDisclosure,
} from '@/hooks/use-disclosure';
import { haptics } from '@/lib/haptics';

function getParamValue(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

export default function DisclosureScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams();
  const { user } = useAuth();
  const acknowledgeDisclosure = useAcknowledgeActionArenaDisclosure();
  const alreadySeen = hasSeenActionArenaDisclosure(user);
  const openedFromSettings = getParamValue(source) === 'settings';

  const dismiss = async () => {
    try {
      if (!alreadySeen) {
        await acknowledgeDisclosure.mutateAsync();
      }
      haptics.medium();
      router.replace(openedFromSettings ? '/settings' : '/');
    } catch (error) {
      haptics.warning();
      Alert.alert(
        'Could not save acknowledgement',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  return (
    <ScreenWrapper centered>
      <Card tone="highlight">
        <View className="items-center gap-5 py-2">
          <View
            className="h-16 w-16 items-center justify-center rounded-3xl border border-electric-green/45 bg-electric-green/15"
            style={{
              shadowColor: THEME_COLORS.electricGreen,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
            }}>
            <Ionicons color={THEME_COLORS.electricGreen} name="shield-checkmark" size={30} />
          </View>
          <View className="items-center gap-3">
            <Text
              className="text-center text-3xl font-black uppercase text-white"
              style={{ letterSpacing: -0.6, lineHeight: 34 }}>
              {ACTION_ARENA_DISCLOSURE.title}
            </Text>
            <Text className="text-center text-base font-semibold leading-6 text-white/65">
              {ACTION_ARENA_DISCLOSURE.body}
            </Text>
          </View>
          <View className="w-full">
            <Button
              loading={acknowledgeDisclosure.isPending}
              onPress={() => {
                void dismiss();
              }}
              title="Got It"
            />
          </View>
        </View>
      </Card>
    </ScreenWrapper>
  );
}
