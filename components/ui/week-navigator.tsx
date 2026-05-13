import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { THEME_COLORS } from '@/constants/theme';

import { PressableScale } from './pressable-scale';

export function WeekNavigator({
  maxWeek = 14,
  onChange,
  week,
}: {
  maxWeek?: number;
  onChange: (week: number) => void;
  week: number;
}) {
  const canGoPrevious = week > 1;
  const canGoNext = week < maxWeek;

  return (
    <View className="flex-row items-center justify-center gap-2">
      <PressableScale
        accessibilityLabel="Previous week"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canGoPrevious }}
        disabled={!canGoPrevious}
        onPress={() => onChange(Math.max(1, week - 1))}
        pressedScale={0.94}
        style={{ opacity: canGoPrevious ? 1 : 0.35 }}>
        <View className="h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.05]">
          <Ionicons color={THEME_COLORS.textPrimary} name="chevron-back" size={16} />
        </View>
      </PressableScale>

      <View className="flex-row items-center gap-1.5 rounded-full border border-electric-green/30 bg-electric-green/10 px-4 py-2">
        <Ionicons color={THEME_COLORS.electricGreen} name="calendar" size={12} />
        <Text
          className="text-[10px] font-black uppercase text-electric-green"
          style={{ letterSpacing: 1.5 }}>
          Week {week} of {maxWeek}
        </Text>
      </View>

      <PressableScale
        accessibilityLabel="Next week"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canGoNext }}
        disabled={!canGoNext}
        onPress={() => onChange(Math.min(maxWeek, week + 1))}
        pressedScale={0.94}
        style={{ opacity: canGoNext ? 1 : 0.35 }}>
        <View className="h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.05]">
          <Ionicons color={THEME_COLORS.textPrimary} name="chevron-forward" size={16} />
        </View>
      </PressableScale>
    </View>
  );
}
