import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { THEME_COLORS } from '@/constants/theme';

type BackButtonProps = {
  accessibilityLabel?: string;
  fallbackHref?: Href;
};

export function BackButton({
  accessibilityLabel = 'Go back',
  fallbackHref,
}: BackButtonProps) {
  const router = useRouter();
  const canGoBack = router.canGoBack();

  const goBack = () => {
    if (canGoBack) {
      router.back();
      return;
    }

    if (fallbackHref) {
      router.replace(fallbackHref);
    }
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={!canGoBack && !fallbackHref}
      hitSlop={16}
      onPress={goBack}
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -4,
        opacity: !canGoBack && !fallbackHref ? 0 : pressed ? 0.55 : 1,
        padding: 6,
      })}>
      <Ionicons color={THEME_COLORS.electricGreen} name="chevron-back" size={28} />
    </Pressable>
  );
}
