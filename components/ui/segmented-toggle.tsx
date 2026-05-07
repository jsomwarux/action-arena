import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { THEME_COLORS } from '@/constants/theme';

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

// Bright accents (cyan/green/gold/amber) read best with the near-black arena
// background as the on-pill text color. Coral red needs white for contrast.
const ON_ACCENT_TEXT: Record<SegmentedAccent, string> = {
  amber: '#000000',
  cyan: '#000000',
  gold: '#000000',
  green: '#000000',
  red: '#FFFFFF',
  white: '#000000',
};

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
  const verticalPadding = compact ? 8 : 10;
  const textSize = compact ? 10 : 11;

  return (
    <View
      className="rounded-2xl border border-white/[0.08] bg-white/[0.04]"
      style={{
        alignSelf: 'stretch',
        flexDirection: 'row',
        padding: 4,
        width: '100%',
      }}>
      <View
        style={{
          alignItems: 'stretch',
          flexDirection: 'row',
          minHeight: compact ? 36 : 48,
          width: '100%',
        }}>
        {options.map((option) => {
          const isActive = option.value === value;
          const optionAccent = option.accent ?? accent;
          const colorHex = ACCENT_HEX[optionAccent];
          const onAccentText = ON_ACCENT_TEXT[optionAccent];
          const idleText = 'rgba(255,255,255,0.6)';

          return (
            <View
              key={String(option.value)}
              style={{
                flex: 1,
                flexBasis: 0,
                minWidth: 0,
              }}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ disabled: option.disabled, selected: isActive }}
                disabled={option.disabled}
                onPress={() => onChange(option.value)}
                style={({ pressed }) => ({
                  alignSelf: 'stretch',
                  minWidth: 0,
                  opacity: option.disabled ? 0.35 : pressed ? 0.85 : 1,
                })}>
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: isActive ? colorHex : 'transparent',
                    borderRadius: 12,
                    flexDirection: 'row',
                    gap: compact ? 4 : 6,
                    justifyContent: 'center',
                    minHeight: compact ? 36 : 48,
                    minWidth: 0,
                    paddingHorizontal: compact ? 4 : 8,
                    paddingVertical: verticalPadding,
                    width: '100%',
                  }}>
                  {option.icon ? (
                    <Ionicons
                      color={isActive ? onAccentText : idleText}
                      name={option.icon}
                      size={compact ? 12 : 14}
                    />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={{
                      color: isActive ? onAccentText : idleText,
                      fontSize: textSize,
                      fontWeight: isActive ? '900' : '400',
                      includeFontPadding: false,
                      letterSpacing: compact ? 0.9 : 1.2,
                      lineHeight: compact ? 13 : 15,
                      textTransform: 'uppercase',
                    }}>
                    {option.label}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
