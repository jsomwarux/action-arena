import { useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type SnapIndex = 0 | 1 | 2;

type BottomSheetProps = PropsWithChildren<{
  collapsedHeight?: number;
  fullScreenInset?: number;
  halfRatio?: number;
  header?: React.ReactNode;
  onSnapChange: (index: SnapIndex) => void;
  snap: SnapIndex;
  visible: boolean;
}>;

const SPRING = { damping: 22, stiffness: 220 };

export function BottomSheet({
  children,
  collapsedHeight = 96,
  fullScreenInset = 36,
  halfRatio = 0.55,
  header,
  onSnapChange,
  snap,
  visible,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.max(windowHeight - fullScreenInset - insets.top, 320);
  const halfHeight = Math.round(sheetHeight * halfRatio);

  const snapTranslations = useMemo(
    () => ({
      0: sheetHeight - collapsedHeight - insets.bottom,
      1: sheetHeight - halfHeight - insets.bottom,
      2: 0,
    }),
    [sheetHeight, collapsedHeight, halfHeight, insets.bottom],
  );

  const translateY = useSharedValue(sheetHeight + 80);
  const overlayProgress = useSharedValue(0);
  const baseTranslate = useRef(snapTranslations[0]);

  useEffect(() => {
    if (!visible) {
      translateY.value = withTiming(sheetHeight + 80, { duration: 200 });
      overlayProgress.value = withTiming(0, { duration: 200 });
      return;
    }
    translateY.value = withSpring(snapTranslations[snap], SPRING);
    overlayProgress.value = withTiming(snap === 2 ? 1 : snap === 1 ? 0.55 : 0, { duration: 220 });
  }, [overlayProgress, sheetHeight, snap, snapTranslations, translateY, visible]);

  const dragGesture = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onStart(() => {
      'worklet';
      baseTranslate.current = translateY.value;
    })
    .onUpdate((event) => {
      'worklet';
      const next = Math.max(snapTranslations[2] - 40, baseTranslate.current + event.translationY);
      translateY.value = next;
      const progress = interpolate(
        next,
        [snapTranslations[2], snapTranslations[0]],
        [1, 0],
        Extrapolation.CLAMP,
      );
      overlayProgress.value = progress;
    })
    .onEnd((event) => {
      'worklet';
      const projected = translateY.value + event.velocityY * 0.18;
      const distances = ([0, 1, 2] as SnapIndex[]).map((index) => ({
        distance: Math.abs(projected - snapTranslations[index]),
        index,
      }));
      distances.sort((a, b) => a.distance - b.distance);
      const target = distances[0].index;
      translateY.value = withSpring(snapTranslations[target], SPRING);
      overlayProgress.value = withTiming(target === 2 ? 1 : target === 1 ? 0.55 : 0, {
        duration: 220,
      });
      runOnJS(onSnapChange)(target);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayProgress.value * 0.55,
  }));

  const handleHeaderPress = () => {
    if (snap === 0) {
      onSnapChange(1);
    } else if (snap === 1) {
      onSnapChange(2);
    } else {
      onSnapChange(0);
    }
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {visible ? (
        <Animated.View
          onTouchStart={() => onSnapChange(0)}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#000' },
            overlayStyle,
            { pointerEvents: snap === 0 ? 'none' : 'auto' },
          ]}
        />
      ) : null}
      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            backgroundColor: '#0F172A',
            borderColor: 'rgba(255,255,255,0.08)',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            bottom: -insets.bottom,
            height: sheetHeight + insets.bottom + 40,
            left: 0,
            paddingBottom: insets.bottom,
            paddingTop: 10,
            position: 'absolute',
            right: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.45,
            shadowRadius: 24,
          },
          sheetStyle,
        ]}>
        <GestureDetector gesture={dragGesture}>
          <View>
            <Pressable accessibilityRole="button" onPress={handleHeaderPress}>
              <View style={{ alignItems: 'center', paddingBottom: 8, paddingTop: 6 }}>
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.22)',
                    borderRadius: 999,
                    height: 4,
                    width: 44,
                  }}
                />
              </View>
              {header}
            </Pressable>
          </View>
        </GestureDetector>
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    </View>
  );
}
