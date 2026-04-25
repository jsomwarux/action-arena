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

const PADDING = 4;

// Sliding indicator driven by RN core Animated.spring with the native driver
// (translateX is supported natively). Layout-measured tab width keeps the
// indicator perfectly aligned even when tabs are resized.
export function SlidingTabIndicator<V extends string | number>({
  accent = THEME_COLORS.electricGreen,
  onChange,
  options,
  style,
  value,
}: SlidingTabIndicatorProps<V>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const tabCount = options.length || 1;
  const tabWidth = containerWidth > 0 ? (containerWidth - PADDING * 2) / tabCount : 0;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const indicatorPosition = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(indicatorPosition, {
      damping: 18,
      mass: 1,
      stiffness: 220,
      toValue: activeIndex,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, indicatorPosition]);

  const translateX = indicatorPosition.interpolate({
    inputRange: options.map((_, index) => index),
    outputRange: options.map((_, index) => index * tabWidth),
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderRadius: 16,
          borderWidth: 1,
          padding: PADDING,
        },
        style,
      ]}>
      <View style={{ height: 44, position: 'relative' }}>
        {tabWidth > 0 ? (
          <Animated.View
            style={{
              backgroundColor: `${accent}26`,
              borderColor: `${accent}73`,
              borderRadius: 12,
              borderWidth: 1,
              height: '100%',
              position: 'absolute',
              shadowColor: accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              transform: [{ translateX }],
              width: tabWidth,
            }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', height: '100%' }}>
          {options.map((option) => {
            const isActive = option.value === value;
            const Ionicons = require('@expo/vector-icons/Ionicons').default;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={String(option.value)}
                onPress={() => onChange(option.value)}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  flex: 1,
                  flexDirection: 'row',
                  gap: 6,
                  justifyContent: 'center',
                  opacity: pressed ? 0.78 : 1,
                })}>
                {option.icon ? (
                  <Ionicons
                    color={isActive ? accent : 'rgba(255,255,255,0.55)'}
                    name={option.icon}
                    size={13}
                  />
                ) : null}
                <Text
                  className={cn('text-[11px] font-black uppercase')}
                  style={{
                    color: isActive ? accent : 'rgba(255,255,255,0.65)',
                    letterSpacing: 1.2,
                  }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
