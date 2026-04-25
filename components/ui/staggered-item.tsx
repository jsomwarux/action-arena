import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

type StaggeredItemProps = PropsWithChildren<{
  delay?: number;
  duration?: number;
  index?: number;
  perItemDelay?: number;
  style?: StyleProp<ViewStyle>;
  translate?: number;
}>;

// Mounts hidden, then fades + slides into place using RN core Animated.parallel
// with the native driver. Safe to use inside lists; one Animated.Value per item
// stays local and is freed on unmount.
export function StaggeredItem({
  children,
  delay = 0,
  duration = 320,
  index = 0,
  perItemDelay = 70,
  style,
  translate = 12,
}: StaggeredItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(translate)).current;

  useEffect(() => {
    const startDelay = delay + index * perItemDelay;
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        delay: startDelay,
        duration,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        delay: startDelay,
        duration,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
    // We intentionally only run on mount; subsequent prop changes don't restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateY: offset }] }]}>
      {children}
    </Animated.View>
  );
}
