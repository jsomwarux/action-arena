import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

type ScreenWrapperProps = PropsWithChildren<{
  centered?: boolean;
  className?: string;
  scroll?: boolean;
}>;

export function ScreenWrapper({
  centered = false,
  children,
  className,
  scroll = false,
}: ScreenWrapperProps) {
  const contentClassName = cn('flex-1 px-5 py-6', centered && 'items-center justify-center', className);

  if (scroll) {
    return (
      <SafeAreaView className="flex-1 bg-arena-bg">
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
    <SafeAreaView className="flex-1 bg-arena-bg">
      <View className={contentClassName}>{children}</View>
    </SafeAreaView>
  );
}
