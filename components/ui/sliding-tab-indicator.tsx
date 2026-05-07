import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';

export type SlidingTabOption<V extends string | number> = {
  icon?: React.ComponentProps<typeof import('@expo/vector-icons/Ionicons').default>['name'];
  label: string;
  value: V;
};

type SlidingTabIndicatorProps<V extends string | number> = {
  accent?: string;
  onChange: (value: V) => void;
  options: SlidingTabOption<V>[];
  style?: StyleProp<ViewStyle>;
  value: V;
};

const INDICATOR_WIDTH_RATIO = 0.7;
const INDICATOR_HEIGHT = 3;
const TAB_HEIGHT = 48;

// ESPN/Sleeper-style section tabs: each tab takes an equal share of the row
// (flex: 1) so labels distribute evenly across the full width. A sliding
// underline accent sits beneath the active tab and animates between positions.
export function SlidingTabIndicator<V extends string | number>({
  accent = THEME_COLORS.electricGreen,
  onChange,
  options,
  style,
  value,
}: SlidingTabIndicatorProps<V>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const tabCount = options.length || 1;
  const tabWidth = containerWidth > 0 ? containerWidth / tabCount : 0;
  const indicatorWidth = tabWidth * INDICATOR_WIDTH_RATIO;
  const indicatorOffset = (tabWidth - indicatorWidth) / 2;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const indicatorPosition = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(indicatorPosition, {
      damping: 20,
      mass: 1,
      stiffness: 240,
      toValue: activeIndex,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, indicatorPosition]);

  const translateX = indicatorPosition.interpolate({
    inputRange: options.map((_, index) => index),
    outputRange: options.map((_, index) => index * tabWidth + indicatorOffset),
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        {
          alignSelf: 'stretch',
          borderBottomColor: 'rgba(255,255,255,0.08)',
          borderBottomWidth: 1,
          width: '100%',
        },
        style,
      ]}>
      <View style={{ flexDirection: 'row', height: TAB_HEIGHT, position: 'relative' }}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              hitSlop={8}
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                alignItems: 'center',
                flex: 1,
                flexBasis: 0,
                flexGrow: 1,
                flexShrink: 1,
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
                paddingHorizontal: 4,
              })}>
              <Text
                allowFontScaling={false}
                className={cn('font-black uppercase')}
                numberOfLines={1}
                style={{
                  color: isActive ? accent : 'rgba(255,255,255,0.55)',
                  fontSize: 12,
                  letterSpacing: 0.4,
                  textAlign: 'center',
                }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={{
              backgroundColor: accent,
              borderRadius: INDICATOR_HEIGHT,
              bottom: 0,
              height: INDICATOR_HEIGHT,
              left: 0,
              position: 'absolute',
              shadowColor: accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.55,
              shadowRadius: 8,
              transform: [{ translateX }],
              width: indicatorWidth,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
