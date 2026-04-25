import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { THEME_COLORS } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

type ConfettiVariant = 'standard' | 'parlay';

type ConfettiProps = {
  fireKey?: number | string | null;
  onComplete?: () => void;
  variant?: ConfettiVariant;
  visible: boolean;
};

const STANDARD_COLORS = [
  THEME_COLORS.electricGreen,
  '#48FFAB',
  THEME_COLORS.gold,
  '#A6FFD2',
  THEME_COLORS.textPrimary,
];

const PARLAY_COLORS = [
  THEME_COLORS.amberAccent,
  THEME_COLORS.gold,
  '#FFD58A',
  THEME_COLORS.electricGreen,
  THEME_COLORS.cyanAccent,
  '#FF9F43',
];

const SHAPES = ['rect', 'circle', 'rect', 'rect'] as const;

function pseudoRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

type Piece = {
  color: string;
  delay: number;
  drift: number;
  duration: number;
  rotation: number;
  shape: (typeof SHAPES)[number];
  size: number;
  startX: number;
};

function buildPieces(count: number, variant: ConfettiVariant, width: number, fireKey: number) {
  const palette = variant === 'parlay' ? PARLAY_COLORS : STANDARD_COLORS;
  const pieces: Piece[] = [];

  for (let i = 0; i < count; i += 1) {
    const seed = (i + 1) * (Math.abs(fireKey % 1000) + 1);
    const r1 = pseudoRandom(seed);
    const r2 = pseudoRandom(seed + 1);
    const r3 = pseudoRandom(seed + 2);
    const r4 = pseudoRandom(seed + 3);
    const r5 = pseudoRandom(seed + 4);
    const r6 = pseudoRandom(seed + 5);

    pieces.push({
      color: palette[Math.floor(r1 * palette.length) % palette.length],
      delay: r2 * (variant === 'parlay' ? 600 : 400),
      drift: (r3 - 0.5) * (variant === 'parlay' ? 220 : 160),
      duration: 1600 + r4 * 1400,
      rotation: r5 * 720 - 360,
      shape: SHAPES[Math.floor(r6 * SHAPES.length) % SHAPES.length],
      size: variant === 'parlay' ? 8 + r1 * 8 : 6 + r1 * 6,
      startX: r6 * width,
    });
  }

  return pieces;
}

function ConfettiPiece({
  height,
  piece,
  progress,
}: {
  height: number;
  piece: Piece;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.value;
    const translateY = -60 + value * (height + 80);
    const translateX = piece.drift * value;
    const rotate = piece.rotation * value;
    const opacity = value < 0.85 ? 1 : Math.max(0, 1 - (value - 0.85) / 0.15);
    return {
      opacity,
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          backgroundColor: piece.color,
          borderRadius: piece.shape === 'circle' ? piece.size : 1.5,
          height: piece.size,
          left: piece.startX,
          width: piece.shape === 'circle' ? piece.size : piece.size * 0.55,
        },
        animatedStyle,
      ]}
    />
  );
}

function ConfettiBurst({
  height,
  pieces,
  width,
}: {
  height: number;
  pieces: Piece[];
  width: number;
}) {
  return (
    <View pointerEvents="none" style={[styles.container, { height, width }]}>
      {pieces.map((piece, index) => (
        <ConfettiPieceWithProgress
          height={height}
          key={`${piece.startX}-${piece.color}-${index}`}
          piece={piece}
        />
      ))}
    </View>
  );
}

function ConfettiPieceWithProgress({
  height,
  piece,
}: {
  height: number;
  piece: Piece;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: piece.duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [piece.delay, piece.duration, progress]);

  return <ConfettiPiece height={height} piece={piece} progress={progress} />;
}

export function Confetti({ fireKey, onComplete, variant = 'standard', visible }: ConfettiProps) {
  const { height, width } = useWindowDimensions();
  const [activeKey, setActiveKey] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const seed = typeof fireKey === 'number' ? fireKey : Date.now();
    setActiveKey(seed);
    haptics.success();

    const longest = variant === 'parlay' ? 3400 : 2600;
    const timer = setTimeout(() => {
      setActiveKey(null);
      onComplete?.();
    }, longest);

    return () => clearTimeout(timer);
  }, [fireKey, onComplete, variant, visible]);

  const pieces = useMemo(() => {
    if (activeKey === null) return [] as Piece[];
    const count = variant === 'parlay' ? 90 : 50;
    return buildPieces(count, variant, width, activeKey);
  }, [activeKey, variant, width]);

  if (activeKey === null || pieces.length === 0) {
    return null;
  }

  return <ConfettiBurst key={activeKey} height={height} pieces={pieces} width={width} />;
}

const styles = StyleSheet.create({
  container: {
    left: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    zIndex: 50,
  },
  piece: {
    position: 'absolute',
    top: 0,
  },
});
