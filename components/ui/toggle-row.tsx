import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { THEME_COLORS } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

type ToggleRowProps = {
  description?: string;
  enabled: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onToggle: () => void;
  title: string;
};

export function ToggleRow({ description, enabled, icon, onToggle, title }: ToggleRowProps) {
  const handlePress = () => {
    haptics.light();
    onToggle();
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={handlePress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View className="flex-row items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
        {icon ? (
          <View
            className="h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]"
            style={
              enabled
                ? {
                    borderColor: 'rgba(0,255,135,0.45)',
                    shadowColor: THEME_COLORS.electricGreen,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                  }
                : undefined
            }>
            <Ionicons
              color={enabled ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.55)'}
              name={icon}
              size={18}
            />
          </View>
        ) : null}
        <View className="flex-1">
          <Text className="text-base font-black text-white" style={{ letterSpacing: -0.2 }}>
            {title}
          </Text>
          {description ? (
            <Text className="mt-1 text-xs font-semibold leading-5 text-white/50">
              {description}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            alignItems: enabled ? 'flex-end' : 'flex-start',
            backgroundColor: enabled ? 'rgba(0,255,135,0.20)' : 'rgba(255,255,255,0.05)',
            borderColor: enabled ? 'rgba(0,255,135,0.45)' : 'rgba(255,255,255,0.15)',
            borderRadius: 999,
            borderWidth: 1,
            height: 32,
            justifyContent: 'center',
            paddingHorizontal: 4,
            shadowColor: enabled ? THEME_COLORS.electricGreen : 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: enabled ? 0.45 : 0,
            shadowRadius: 8,
            width: 56,
          }}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: enabled ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.45)',
              borderRadius: 999,
              height: 24,
              justifyContent: 'center',
              width: 24,
            }}>
            {enabled ? (
              <Ionicons color={THEME_COLORS.background} name="checkmark" size={14} />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
