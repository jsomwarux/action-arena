import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { THEME_COLORS } from '@/constants/theme';

type LivePulseProps = PropsWithChildren<{
  color?: string;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}>;

// Soft breathing glow rendered as a tinted layer behind the children. The layer
// pulses opacity using RN core Animated.loop with the native driver. The
// children themselves stay fully opaque so text/labels never dim.
export function LivePulse({
  children,
  color = THEME_COLORS.gold,
  intensity = 0.7,
  style,
}: LivePulseProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const clampedIntensity = Math.max(Math.min(intensity, 1), 0);
  const baseOpacity = 0.05;
  const peakOpacity = 0.05 + clampedIntensity * 0.18;
  const glowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [baseOpacity, peakOpacity],
  });

  return (
    <View style={style}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: color,
            borderRadius: 18,
            opacity: glowOpacity,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 14,
          },
        ]}
      />
      <View>{children}</View>
    </View>
  );
}
