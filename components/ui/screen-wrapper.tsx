import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

type ScreenWrapperProps = PropsWithChildren<{
  centered?: boolean;
  className?: string;
  scroll?: boolean;
  // Opt in to applying the top safe-area inset. Default is `false` because
  // most app screens sit inside a Stack with a native header that already
  // consumes the top inset — adding it again here creates a large empty band
  // between the header and the screen content. Tab screens and other
  // screens that render without a native header should pass `topSafe`.
  topSafe?: boolean;
}>;

const SAFE_AREA_WITHOUT_TOP: Edge[] = ['bottom', 'left', 'right'];
const SAFE_AREA_WITH_TOP: Edge[] = ['top', 'bottom', 'left', 'right'];

export function ScreenWrapper({
  centered = false,
  children,
  className,
  scroll = false,
  topSafe = false,
}: ScreenWrapperProps) {
  const contentClassName = cn(
    'flex-1 px-5 pt-3 pb-6',
    centered && 'items-center justify-center',
    className,
  );
  const edges = topSafe ? SAFE_AREA_WITH_TOP : SAFE_AREA_WITHOUT_TOP;

  if (scroll) {
    return (
      <SafeAreaView className="flex-1 bg-arena-bg" edges={edges}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled">
          <View className={contentClassName}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-arena-bg" edges={edges}>
      <View className={contentClassName}>{children}</View>
    </SafeAreaView>
  );
}
