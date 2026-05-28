import { Stack, useRouter } from 'expo-router';

import { BackButton } from '@/components/ui/back-button';
import { LegalDocumentCard } from '@/components/legal/legal-document-card';
import { ScreenWrapper } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { TERMS_OF_SERVICE_DOCUMENT } from '@/constants/disclosure';
import { haptics } from '@/lib/haptics';

export default function TermsOfServiceScreen() {
  const router = useRouter();

  const dismiss = () => {
    haptics.medium();
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => <BackButton />,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: THEME_COLORS.background },
          headerTintColor: THEME_COLORS.electricGreen,
          headerTitleStyle: { fontWeight: '900' },
          title: 'Terms of Service',
        }}
      />
      <ScreenWrapper centered>
        <LegalDocumentCard
          body={TERMS_OF_SERVICE_DOCUMENT.body}
          buttonLabel="Got It"
          chips={TERMS_OF_SERVICE_DOCUMENT.chips}
          onButtonPress={dismiss}
          title={TERMS_OF_SERVICE_DOCUMENT.title}
        />
      </ScreenWrapper>
    </>
  );
}
