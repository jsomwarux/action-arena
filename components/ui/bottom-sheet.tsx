import { useEffect, useMemo, useState, type PropsWithChildren, type ReactNode } from 'react';
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
  header?: ReactNode;
  onSnapChange: (index: SnapIndex) => void;
  snap: SnapIndex;
  visible: boolean;
}>;

const SPRING = { damping: 22, stiffness: 220 };

// The sheet container is rendered taller than its visible region so the
// bottom-rounded corner / spring overshoot doesn't reveal the underlay; the
// extra height below the visible bottom is clipped by the parent's
// overflow:hidden. paddingBottom must account for this overshoot AND add a
// visible buffer so anchored content (e.g. submit buttons) keeps clear
// breathing room above the sheet's visible bottom — which, when the sheet is
// hosted inside a tab navigator screen, sits flush against the tab bar.
const SHEET_HEIGHT_OVERSHOOT = 40;
const SHEET_CONTENT_BOTTOM_BUFFER = 28;

export function BottomSheet({
  children,
  collapsedHeight = 96,
  fullScreenInset = 8,
  halfRatio = 0.55,
  header,
  onSnapChange,
  snap,
  visible,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [containerHeight, setContainerHeight] = useState(windowHeight);
  const fullTopInset = insets.top + fullScreenInset;
  const sheetHeight = Math.max(containerHeight - fullTopInset, 320);
  const halfHeight = Math.round(sheetHeight * halfRatio);

  const snapTranslations = useMemo(
    () => ({
      0: sheetHeight - collapsedHeight,
      1: sheetHeight - halfHeight,
      2: 0,
    }),
    [sheetHeight, collapsedHeight, halfHeight],
  );

  const translateY = useSharedValue(sheetHeight + 80);
  const overlayProgress = useSharedValue(0);
  const dragStartY = useSharedValue(snapTranslations[0]);

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
      dragStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      'worklet';
      const next = Math.min(
        snapTranslations[0] + 28,
        Math.max(snapTranslations[2] - 28, dragStartY.value + event.translationY),
      );
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
    <View
      onLayout={(event) => {
        setContainerHeight(event.nativeEvent.layout.height);
      }}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {visible ? (
        <Animated.View
          pointerEvents={snap === 0 ? 'none' : 'auto'}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#000' },
            overlayStyle,
          ]}>
          <Pressable onPress={() => onSnapChange(0)} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          {
            backgroundColor: '#0F172A',
            borderColor: 'rgba(255,255,255,0.08)',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            height: sheetHeight + insets.bottom + SHEET_HEIGHT_OVERSHOOT,
            left: 0,
            overflow: 'hidden',
            paddingBottom: insets.bottom + SHEET_HEIGHT_OVERSHOOT + SHEET_CONTENT_BOTTOM_BUFFER,
            paddingTop: 10,
            position: 'absolute',
            right: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.45,
            shadowRadius: 24,
            top: fullTopInset,
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
