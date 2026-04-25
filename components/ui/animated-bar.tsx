import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, View, type ViewStyle } from 'react-native';

type AnimatedBarProps = {
  // Progress in [0, 1]; bar width animates to (progress * 100)% of its parent.
  color: string;
  glow?: boolean;
  height?: number;
  progress: number;
  radius?: number;
  trackStyle?: StyleProp<ViewStyle>;
};

// Spring-driven progress bar using RN core Animated. Width interpolation runs
// on the JS thread (layout props can't use the native driver) — intentionally
// not Reanimated, so no worklets.
export function AnimatedBar({
  color,
  glow = true,
  height = 12,
  progress,
  radius,
  trackStyle,
}: AnimatedBarProps) {
  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const resolvedRadius = radius ?? height / 2;

  useEffect(() => {
    Animated.spring(animatedProgress, {
      damping: 18,
      mass: 1,
      stiffness: 180,
      toValue: Math.max(0, Math.min(progress, 1)),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, progress]);

  const width = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderColor: 'rgba(255,255,255,0.06)',
          borderRadius: resolvedRadius,
          borderWidth: 1,
          height,
          overflow: 'hidden',
        },
        trackStyle,
      ]}>
      <Animated.View
        style={{
          backgroundColor: color,
          borderRadius: resolvedRadius,
          height: '100%',
          shadowColor: glow ? color : 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: glow ? 0.45 : 0,
          shadowRadius: glow ? 10 : 0,
          width,
        }}
      />
    </View>
  );
}
