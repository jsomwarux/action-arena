import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { LegalDocumentCard } from '@/components/legal/legal-document-card';
import { ScreenWrapper } from '@/components/ui';
import { ACTION_ARENA_DISCLOSURE } from '@/constants/disclosure';
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
      <LegalDocumentCard
        body={ACTION_ARENA_DISCLOSURE.body}
        buttonLabel="Got It"
        buttonLoading={acknowledgeDisclosure.isPending}
        chips={ACTION_ARENA_DISCLOSURE.chips}
        onButtonPress={() => {
          void dismiss();
        }}
        title={ACTION_ARENA_DISCLOSURE.title}
      />
    </ScreenWrapper>
  );
}
