import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type SkeletonLoaderProps = {
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  width?: number | `${number}%`;
};

const SHIMMER_WIDTH = 140;

// Shimmer driven by RN core Animated.loop with native driver (transform only).
export function SkeletonLoader({
  height = 18,
  radius = 8,
  style,
  width = '100%',
}: SkeletonLoaderProps) {
  const [boxWidth, setBoxWidth] = useState(220);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    if (measured && Math.abs(measured - boxWidth) > 1) {
      setBoxWidth(measured);
    }
  };

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_WIDTH, boxWidth + SHIMMER_WIDTH],
  });

  return (
    <View
      onLayout={handleLayout}
      style={[styles.base, { borderRadius: radius, height, width }, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          { width: SHIMMER_WIDTH },
          { transform: [{ translateX }, { skewX: '-14deg' }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  shimmer: {
    backgroundColor: 'rgba(0,255,135,0.12)',
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
});
