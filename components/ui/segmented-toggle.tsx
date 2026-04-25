import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';

export type SegmentedAccent = 'green' | 'amber' | 'cyan' | 'gold' | 'red' | 'white';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type SegmentedOption<V extends string | number> = {
  accent?: SegmentedAccent;
  disabled?: boolean;
  icon?: IoniconName;
  label: string;
  value: V;
};

const ACCENT_HEX: Record<SegmentedAccent, string> = {
  amber: THEME_COLORS.amberAccent,
  cyan: THEME_COLORS.cyanAccent,
  gold: THEME_COLORS.gold,
  green: THEME_COLORS.electricGreen,
  red: THEME_COLORS.coralRed,
  white: THEME_COLORS.textPrimary,
};

function withAlpha(hex: string, alpha: number) {
  const value = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${value}`;
}

type SegmentedToggleProps<V extends string | number> = {
  accent?: SegmentedAccent;
  compact?: boolean;
  onChange: (value: V) => void;
  options: SegmentedOption<V>[];
  value: V;
};

export function SegmentedToggle<V extends string | number>({
  accent = 'green',
  compact = false,
  onChange,
  options,
  value,
}: SegmentedToggleProps<V>) {
  return (
    <View
      className="rounded-2xl border border-white/[0.08] bg-white/[0.04]"
      style={{ padding: 4 }}>
      <View className={cn('flex-row', compact ? 'h-9' : 'h-12')}>
        {options.map((option) => {
          const isActive = option.value === value;
          const optionAccent = option.accent ?? accent;
          const colorHex = ACCENT_HEX[optionAccent];
          const activeBg = withAlpha(colorHex, 0.18);
          const activeBorder = withAlpha(colorHex, 0.5);

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ disabled: option.disabled, selected: isActive }}
              disabled={option.disabled}
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                alignItems: 'center',
                flex: 1,
                flexDirection: 'row',
                gap: 6,
                justifyContent: 'center',
                opacity: option.disabled ? 0.35 : pressed ? 0.78 : 1,
              })}>
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: isActive ? activeBg : 'transparent',
                  borderColor: isActive ? activeBorder : 'transparent',
                  borderRadius: 12,
                  borderWidth: 1,
                  flex: 1,
                  flexDirection: 'row',
                  gap: 6,
                  height: '100%',
                  justifyContent: 'center',
                  shadowColor: isActive ? colorHex : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isActive ? 0.4 : 0,
                  shadowRadius: isActive ? 10 : 0,
                }}>
                {option.icon ? (
                  <Ionicons
                    color={isActive ? colorHex : 'rgba(255,255,255,0.55)'}
                    name={option.icon}
                    size={compact ? 12 : 14}
                  />
                ) : null}
                <Text
                  className={cn('font-black uppercase', compact ? 'text-[10px]' : 'text-[11px]')}
                  style={{
                    color: isActive ? colorHex : 'rgba(255,255,255,0.6)',
                    letterSpacing: 1.2,
                  }}>
                  {option.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
