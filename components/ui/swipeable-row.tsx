import Ionicons from '@expo/vector-icons/Ionicons';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { THEME_COLORS } from '@/constants/theme';

const SWIPE_THRESHOLD = 96;
const MAX_OFFSET = 140;

type SwipeableRowProps = PropsWithChildren<{
  label?: string;
  onRemove: () => void;
}>;

export function SwipeableRow({ children, label = 'Remove', onRemove }: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const removed = useSharedValue(false);

  const performRemove = () => {
    onRemove();
  };

  const gesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      'worklet';
      const next = Math.min(0, Math.max(-MAX_OFFSET, event.translationX));
      translateX.value = next;
    })
    .onEnd((event) => {
      'worklet';
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD || event.velocityX < -800) {
        removed.value = true;
        translateX.value = withTiming(-MAX_OFFSET * 1.2, { duration: 180 }, () => {
          runOnJS(performRemove)();
          translateX.value = 0;
        });
        return;
      }
      translateX.value = withSpring(0, { damping: 16, stiffness: 220 });
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-MAX_OFFSET, -32, 0], [1, 0.6, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.reveal, revealStyle]}>
        <Ionicons color={THEME_COLORS.coralRed} name="trash" size={18} />
        <Text style={styles.revealLabel}>{label}</Text>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  reveal: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,71,87,0.18)',
    borderRadius: 16,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  revealLabel: {
    color: THEME_COLORS.coralRed,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
