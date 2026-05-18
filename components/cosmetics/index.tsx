import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { Confetti } from '@/components/ui';
import { ALL_COSMETIC_ITEMS, getCosmeticItem } from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import type { CosmeticCategory, EquippedCosmeticsByCategory } from '@/types/database';

type CosmeticAvatarProps = {
  cosmetics?: EquippedCosmeticsByCategory | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
};

type CosmeticPreviewProps = {
  category: CosmeticCategory;
  itemId: string;
  size?: 'md' | 'lg';
};

type WinCelebrationStyleKey = 'score' | 'crowd' | 'fireworks';

const avatarSizes = {
  lg: { icon: 28, outer: 'h-16 w-16 rounded-3xl', text: 'text-xl' },
  md: { icon: 20, outer: 'h-11 w-11 rounded-2xl', text: 'text-sm' },
  sm: { icon: 15, outer: 'h-8 w-8 rounded-xl', text: 'text-[10px]' },
};

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
}

function itemFor(cosmetics: EquippedCosmeticsByCategory | null | undefined, category: CosmeticCategory) {
  return getCosmeticItem(cosmetics?.[category]?.item_id);
}

function useLoop(enabled: boolean, duration = 1100, easing: (t: number) => number = Easing.inOut(Easing.ease)) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return undefined;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { duration, easing, toValue: 1, useNativeDriver: true }),
        Animated.timing(progress, { duration, easing, toValue: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [duration, easing, enabled, progress]);

  return progress;
}

function useSpin(enabled: boolean, duration = 6000) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return undefined;
    const animation = Animated.loop(
      Animated.timing(progress, {
        duration,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [duration, enabled, progress]);

  return progress;
}

export function CosmeticAvatar({ cosmetics, name, size = 'md' }: CosmeticAvatarProps) {
  const logo = itemFor(cosmetics, 'team_logo');
  const frame = itemFor(cosmetics, 'profile_frame');
  const sizeClasses = avatarSizes[size];
  const accent = frame?.accent ?? logo?.accent ?? THEME_COLORS.electricGreen;
  const framePulse = useLoop(Boolean(frame), 1500);
  const ringOpacity = framePulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });
  const ringScale = framePulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });

  return (
    <View className={cn('items-center justify-center', sizeClasses.outer)}>
      {frame ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderColor: accent,
              borderRadius: size === 'sm' ? 14 : size === 'md' ? 18 : 26,
              borderWidth: 2,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
      ) : null}
      <View
        className={cn('items-center justify-center border bg-white/[0.04]', sizeClasses.outer)}
        style={{
          borderColor: frame ? accent : 'rgba(255,255,255,0.12)',
          borderWidth: frame ? 2 : 1,
          shadowColor: frame ? accent : 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: frame ? 0.4 : 0,
          shadowRadius: frame ? 12 : 0,
        }}>
        {logo ? (
          <Ionicons color={logo.accent} name={logo.icon} size={sizeClasses.icon} />
        ) : (
          <Text
            className={cn('font-black uppercase text-white/80', sizeClasses.text)}
            style={{ letterSpacing: 0.4 }}>
            {initialsFor(name) || '?'}
          </Text>
        )}
      </View>
    </View>
  );
}

export function TrophySkinIcon({
  cosmetics,
  size = 24,
}: {
  cosmetics?: EquippedCosmeticsByCategory | null;
  size?: number;
}) {
  const trophy = itemFor(cosmetics, 'trophy_skin');
  const spin = useSpin(Boolean(trophy));
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View
      className="items-center justify-center rounded-2xl border"
      style={{
        backgroundColor: trophy ? `${trophy.accent}24` : 'rgba(255,215,0,0.14)',
        borderColor: trophy ? `${trophy.accent}88` : 'rgba(255,215,0,0.45)',
        height: size + 22,
        shadowColor: trophy?.accent ?? THEME_COLORS.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: trophy ? 0.45 : 0.2,
        shadowRadius: trophy ? 12 : 8,
        width: size + 22,
      }}>
      {trophy ? (
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons color={trophy.accent} name={trophy.icon} size={size} />
        </Animated.View>
      ) : (
        <Ionicons color={THEME_COLORS.gold} name="trophy" size={size} />
      )}
    </View>
  );
}

export function LockEffect({
  children,
  cosmetics,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
  cosmetics?: EquippedCosmeticsByCategory | null;
}) {
  const effect = itemFor(cosmetics, 'lock_effect');
  const progress = useLoop(Boolean(effect), 1100);
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, compact ? 1.04 : 1.08],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.38, 0.9],
  });

  if (!effect) {
    return <>{children}</>;
  }

  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={{
          backgroundColor: `${effect.accent}22`,
          borderColor: `${effect.accent}88`,
          borderRadius: compact ? 999 : 18,
          borderWidth: 1,
          bottom: -4,
          left: -4,
          opacity,
          position: 'absolute',
          right: -4,
          top: -4,
          transform: [{ scale }],
        }}
      />
      {children}
    </View>
  );
}

const SCORE_BURST_DURATION = 1450;
const STADIUM_CROWD_DURATION = 2300;
const FIREWORKS_DURATION = 3900;

const SCOREBOARD_DIGITS = ['+', '1', '0', '0'] as const;
const SCORE_SHARDS = [
  { rotate: '-16deg', text: '7', x: -118, y: -70 },
  { rotate: '12deg', text: '3', x: 116, y: -60 },
  { rotate: '20deg', text: '+', x: -94, y: 76 },
  { rotate: '-10deg', text: '1', x: 92, y: 84 },
  { rotate: '8deg', text: '0', x: -36, y: -104 },
  { rotate: '-22deg', text: '0', x: 42, y: 112 },
] as const;

function resolveWinCelebrationStyleKey(styleKey: string | undefined): WinCelebrationStyleKey {
  if (styleKey === 'crowd' || styleKey === 'fireworks' || styleKey === 'score') {
    return styleKey;
  }

  return 'score';
}

function winCelebrationDurationFor(styleKey: WinCelebrationStyleKey) {
  if (styleKey === 'fireworks') return FIREWORKS_DURATION;
  if (styleKey === 'crowd') return STADIUM_CROWD_DURATION;
  return SCORE_BURST_DURATION;
}

function seedFromFireKey(fireKey: number | string | null | undefined) {
  if (typeof fireKey === 'number' && Number.isFinite(fireKey)) {
    return Math.abs(Math.trunc(fireKey));
  }

  if (typeof fireKey === 'string' && fireKey.length > 0) {
    let hash = 0;
    for (let index = 0; index < fireKey.length; index += 1) {
      hash = (hash * 31 + fireKey.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  return Date.now();
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function ScoreBurstOverlay({ accent, fireKey }: { accent: string; fireKey: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(progress, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        toValue: 0.38,
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        duration: 240,
        easing: Easing.out(Easing.back(2.8)),
        toValue: 0.7,
        useNativeDriver: true,
      }),
      Animated.delay(420),
      Animated.timing(progress, {
        duration: 360,
        easing: Easing.in(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fireKey, progress]);

  const boardOpacity = progress.interpolate({
    inputRange: [0, 0.1, 0.78, 1],
    outputRange: [0, 1, 1, 0],
  });
  const boardScale = progress.interpolate({
    inputRange: [0, 0.38, 0.7, 1],
    outputRange: [0.62, 1.08, 1, 1.16],
  });
  const boardTranslateY = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [18, 0, -18],
  });
  const flashOpacity = progress.interpolate({
    inputRange: [0, 0.16, 0.34, 1],
    outputRange: [0, 0.42, 0, 0],
  });
  const sweepTranslateY = progress.interpolate({
    extrapolate: 'clamp',
    inputRange: [0.18, 0.52],
    outputRange: [-46, 46],
  });
  const sweepOpacity = progress.interpolate({
    inputRange: [0, 0.18, 0.52, 1],
    outputRange: [0, 0.95, 0, 0],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: accent, opacity: flashOpacity }]}
      />
      <View pointerEvents="none" style={styles.scoreBurstStage}>
        {SCORE_SHARDS.map((shard, index) => {
          const shardOpacity = progress.interpolate({
            inputRange: [0, 0.2, 0.78, 1],
            outputRange: [0, 1, 0.75, 0],
          });
          const translateX = progress.interpolate({
            inputRange: [0, 0.38, 1],
            outputRange: [0, shard.x * 0.34, shard.x],
          });
          const translateY = progress.interpolate({
            inputRange: [0, 0.38, 1],
            outputRange: [0, shard.y * 0.28, shard.y],
          });
          const scale = progress.interpolate({
            inputRange: [0, 0.38, 1],
            outputRange: [0.4, 1, 0.82],
          });

          return (
            <Animated.View
              key={`${shard.text}-${index}`}
              pointerEvents="none"
              style={[
                styles.scoreShard,
                {
                  borderColor: `${accent}99`,
                  opacity: shardOpacity,
                  transform: [{ translateX }, { translateY }, { rotate: shard.rotate }, { scale }],
                },
              ]}>
              <Text style={[styles.scoreShardText, { color: accent }]}>{shard.text}</Text>
            </Animated.View>
          );
        })}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.scoreboardPlate,
            {
              borderColor: accent,
              opacity: boardOpacity,
              shadowColor: accent,
              transform: [{ translateY: boardTranslateY }, { scale: boardScale }],
            },
          ]}>
          <View style={styles.scoreboardHeader}>
            <Text style={[styles.scoreboardKicker, { color: accent }]}>FINAL</Text>
            <Text style={[styles.scoreboardKicker, { color: accent }]}>WIN</Text>
          </View>
          <View style={styles.scoreboardDigitRow}>
            {SCOREBOARD_DIGITS.map((digit, index) => (
              <View key={`${digit}-${index}`} style={[styles.scoreboardDigitTile, { borderColor: `${accent}66` }]}>
                <Text style={[styles.scoreboardDigit, { color: accent }]}>{digit}</Text>
              </View>
            ))}
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.scoreboardSweep,
              {
                backgroundColor: accent,
                opacity: sweepOpacity,
                transform: [{ translateY: sweepTranslateY }],
              },
            ]}
          />
        </Animated.View>
      </View>
    </View>
  );
}

function StadiumCrowdOverlay({ accent, fireKey }: { accent: string; fireKey: number }) {
  const { height, width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const members = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const row = index % 3;
        return {
          bottom: 46 + row * 30,
          color: index % 5 === 0 ? THEME_COLORS.gold : accent,
          delay: (index % 6) * 0.035,
          id: index,
          size: 24 + ((index * 7) % 12),
          x: ((index + 0.5) / 18) * width,
        };
      }),
    [accent, width],
  );
  const noise = useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => ({
        color: index % 3 === 0 ? THEME_COLORS.gold : accent,
        delay: (index % 8) * 0.045,
        id: index,
        rise: 130 + seededUnit(fireKey + index * 17) * 190,
        size: 3 + seededUnit(fireKey + index * 23) * 4,
        x: seededUnit(fireKey + index * 31) * width,
      })),
    [accent, fireKey, width],
  );

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      duration: STADIUM_CROWD_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [fireKey, progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.crowdGlow,
          {
            backgroundColor: accent,
            opacity: progress.interpolate({
              inputRange: [0, 0.22, 0.74, 1],
              outputRange: [0, 0.26, 0.2, 0],
            }),
          },
        ]}
      />
      {noise.map((dot) => {
        const delayEnd = Math.min(0.88, dot.delay + 0.12);
        const translateY = progress.interpolate({
          inputRange: [0, dot.delay, delayEnd, 1],
          outputRange: [0, 0, -dot.rise, -dot.rise - 38],
        });
        const opacity = progress.interpolate({
          inputRange: [0, dot.delay, delayEnd, 0.86, 1],
          outputRange: [0, 0, 0.9, 0.55, 0],
        });
        return (
          <Animated.View
            key={dot.id}
            pointerEvents="none"
            style={[
              styles.crowdNoise,
              {
                backgroundColor: dot.color,
                bottom: height * 0.16,
                height: dot.size,
                left: dot.x,
                opacity,
                transform: [{ translateY }],
                width: dot.size,
              },
            ]}
          />
        );
      })}
      {members.map((member) => {
        const enterEnd = Math.min(0.55, member.delay + 0.13);
        const settleEnd = Math.min(0.68, member.delay + 0.22);
        const translateY = progress.interpolate({
          inputRange: [0, member.delay, enterEnd, settleEnd, 1],
          outputRange: [height * 0.16, height * 0.16, -16, 0, -30],
        });
        const opacity = progress.interpolate({
          inputRange: [0, member.delay, enterEnd, 0.82, 1],
          outputRange: [0, 0, 1, 1, 0],
        });
        const scale = progress.interpolate({
          inputRange: [0, member.delay, enterEnd, settleEnd, 1],
          outputRange: [0.7, 0.7, 1.12, 1, 0.92],
        });
        const sway = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [-4 + (member.id % 3) * 2, 5 - (member.id % 4), -3 + (member.id % 2) * 3],
        });

        return (
          <Animated.View
            key={member.id}
            pointerEvents="none"
            style={[
              styles.crowdMember,
              {
                bottom: member.bottom,
                left: member.x,
                opacity,
                transform: [{ translateX: sway }, { translateY }, { scale }],
              },
            ]}>
            <Ionicons color={member.color} name="people" size={member.size} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function FireworkBurst({
  accent,
  anchorX,
  anchorY,
  delay,
  fireKey,
  launchDistance,
  particleCount,
  radius,
}: {
  accent: string;
  anchorX: number;
  anchorY: number;
  delay: number;
  fireKey: number;
  launchDistance: number;
  particleCount: number;
  radius: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const particles = useMemo(() => {
    const palette = [accent, THEME_COLORS.gold, THEME_COLORS.electricGreen, THEME_COLORS.textPrimary];
    return Array.from({ length: particleCount }, (_, index) => {
      const jitter = (seededUnit(fireKey + index * 13) - 0.5) * 0.3;
      const angle = (index / particleCount) * Math.PI * 2 + jitter;
      const distance = radius * (0.72 + seededUnit(fireKey + index * 19) * 0.38);
      return {
        color: palette[index % palette.length],
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        id: index,
        size: 5 + seededUnit(fireKey + index * 29) * 5,
      };
    });
  }, [accent, fireKey, particleCount, radius]);

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(progress, {
        duration: 1420,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, fireKey, progress]);

  const rocketOpacity = progress.interpolate({
    inputRange: [0, 0.04, 0.28, 0.36, 1],
    outputRange: [0, 1, 1, 0, 0],
  });
  const rocketTranslateY = progress.interpolate({
    extrapolate: 'clamp',
    inputRange: [0, 0.32],
    outputRange: [launchDistance, 0],
  });
  const trailScale = progress.interpolate({
    inputRange: [0, 0.32, 1],
    outputRange: [1.4, 0.3, 0.3],
  });

  return (
    <View pointerEvents="none" style={[styles.fireworkAnchor, { left: anchorX, top: anchorY }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fireworkRocket,
          {
            opacity: rocketOpacity,
            transform: [{ translateY: rocketTranslateY }],
          },
        ]}>
        <View style={[styles.fireworkRocketDot, { backgroundColor: accent }]} />
        <Animated.View
          style={[
            styles.fireworkRocketTrail,
            {
              backgroundColor: accent,
              transform: [{ scaleY: trailScale }],
            },
          ]}
        />
      </Animated.View>
      {particles.map((particle) => {
        const translateX = progress.interpolate({
          extrapolate: 'clamp',
          inputRange: [0.28, 1],
          outputRange: [0, particle.dx],
        });
        const translateY = progress.interpolate({
          extrapolate: 'clamp',
          inputRange: [0.28, 0.72, 1],
          outputRange: [0, particle.dy, particle.dy + 52],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.27, 0.36, 0.78, 1],
          outputRange: [0, 0, 1, 0.74, 0],
        });
        const scale = progress.interpolate({
          inputRange: [0.28, 0.48, 1],
          outputRange: [0.35, 1, 0.55],
        });

        return (
          <Animated.View
            key={particle.id}
            pointerEvents="none"
            style={[
              styles.fireworkParticle,
              {
                backgroundColor: particle.color,
                height: particle.size,
                opacity,
                shadowColor: particle.color,
                transform: [{ translateX }, { translateY }, { scale }],
                width: particle.size,
              },
            ]}>
            <View style={[styles.fireworkParticleTrail, { backgroundColor: particle.color }]} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function FireworksOverlay({ accent, fireKey }: { accent: string; fireKey: number }) {
  const { height, width } = useWindowDimensions();
  const bursts = useMemo(() => {
    const shortSide = Math.min(width, height);
    return [
      { delay: 0, id: 0, x: width * 0.24, y: height * 0.31, count: 12, radius: shortSide * 0.12 },
      { delay: 380, id: 1, x: width * 0.72, y: height * 0.24, count: 14, radius: shortSide * 0.14 },
      { delay: 820, id: 2, x: width * 0.48, y: height * 0.43, count: 16, radius: shortSide * 0.16 },
      { delay: 1260, id: 3, x: width * 0.18, y: height * 0.54, count: 12, radius: shortSide * 0.13 },
      { delay: 1680, id: 4, x: width * 0.8, y: height * 0.49, count: 13, radius: shortSide * 0.13 },
    ];
  }, [height, width]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {bursts.map((burst) => (
        <FireworkBurst
          accent={accent}
          anchorX={burst.x}
          anchorY={burst.y}
          delay={burst.delay}
          fireKey={fireKey + burst.id * 101}
          key={burst.id}
          launchDistance={height - burst.y + 80}
          particleCount={burst.count}
          radius={burst.radius}
        />
      ))}
    </View>
  );
}

export function WinCelebration({
  cosmetics,
  fireKey,
  onComplete,
  visible,
}: {
  cosmetics?: EquippedCosmeticsByCategory | null;
  fireKey?: number | string | null;
  onComplete?: () => void;
  visible: boolean;
}) {
  const celebration = itemFor(cosmetics, 'win_celebration');
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const styleKey = celebration ? resolveWinCelebrationStyleKey(celebration.styleKey) : null;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!visible || !styleKey) {
      setActiveKey(null);
      return undefined;
    }

    const nextKey = seedFromFireKey(fireKey);
    setActiveKey(nextKey);
    haptics.success();

    const timer = setTimeout(() => {
      setActiveKey(null);
      onCompleteRef.current?.();
    }, winCelebrationDurationFor(styleKey));

    return () => clearTimeout(timer);
  }, [fireKey, styleKey, visible]);

  if (!celebration) {
    return (
      <Confetti
        fireKey={fireKey}
        onComplete={onComplete}
        variant="standard"
        visible={visible}
      />
    );
  }

  if (!visible || activeKey === null || !styleKey) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 50 }]}>
      {styleKey === 'score' ? (
        <ScoreBurstOverlay accent={celebration.accent} fireKey={activeKey} />
      ) : styleKey === 'crowd' ? (
        <StadiumCrowdOverlay accent={celebration.accent} fireKey={activeKey} />
      ) : (
        <FireworksOverlay accent={celebration.accent} fireKey={activeKey} />
      )}
      <View pointerEvents="none" className="absolute left-0 right-0 top-20 items-center">
        <View
          className="flex-row items-center gap-2 rounded-full border px-4 py-2"
          style={{
            backgroundColor: `${celebration.accent}22`,
            borderColor: `${celebration.accent}88`,
          }}>
          <Ionicons color={celebration.accent} name={celebration.icon} size={14} />
          <Text
            className="text-[10px] font-black uppercase text-white"
            style={{ letterSpacing: 1.6 }}>
            {celebration.name}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// Per-category preview presentations.  Each kind has its own visual
// vocabulary so the shop feels like browsing actual product art.
// ============================================================

const PREVIEW_DIMENSIONS = {
  lg: { iconSize: 40, outer: 110, secondaryIcon: 14 },
  md: { iconSize: 28, outer: 76, secondaryIcon: 11 },
};

function TeamLogoPreview({ accent, icon, size }: { accent: string; icon: React.ComponentProps<typeof Ionicons>['name']; size: keyof typeof PREVIEW_DIMENSIONS }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const pulse = useLoop(true, 1700);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  return (
    <View style={{ height: dim.outer, width: dim.outer }}>
      <Animated.View
        pointerEvents="none"
        style={{
          backgroundColor: `${accent}1a`,
          borderRadius: dim.outer / 2,
          height: dim.outer,
          opacity: 0.55,
          position: 'absolute',
          transform: [{ scale }],
          width: dim.outer,
        }}
      />
      <View
        className="items-center justify-center rounded-3xl border"
        style={{
          backgroundColor: `${accent}1f`,
          borderColor: `${accent}77`,
          height: dim.outer,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.35,
          shadowRadius: 14,
          width: dim.outer,
        }}>
        <Ionicons color={accent} name={icon} size={dim.iconSize} />
      </View>
    </View>
  );
}

function TrophyPreview({ accent, icon, size }: { accent: string; icon: React.ComponentProps<typeof Ionicons>['name']; size: keyof typeof PREVIEW_DIMENSIONS }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const shine = useLoop(true, 1600);
  const shineOpacity = shine.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });
  return (
    <View style={{ height: dim.outer, width: dim.outer }}>
      <Animated.View
        pointerEvents="none"
        style={{
          backgroundColor: accent,
          borderRadius: 24,
          bottom: 6,
          left: 6,
          opacity: shineOpacity,
          position: 'absolute',
          right: 6,
          top: 6,
        }}
      />
      <View
        className="items-center justify-center rounded-3xl border"
        style={{
          backgroundColor: `${accent}24`,
          borderColor: `${accent}99`,
          height: dim.outer,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.55,
          shadowRadius: 18,
          width: dim.outer,
        }}>
        <Ionicons color={accent} name={icon} size={dim.iconSize} />
      </View>
    </View>
  );
}

function LockEffectPreview({ accent, icon, size }: { accent: string; icon: React.ComponentProps<typeof Ionicons>['name']; size: keyof typeof PREVIEW_DIMENSIONS }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const pulse = useLoop(true, 950);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] });
  return (
    <View style={{ height: dim.outer, width: dim.outer }}>
      <Animated.View
        pointerEvents="none"
        style={{
          borderColor: `${accent}aa`,
          borderRadius: dim.outer / 2,
          borderWidth: 1.5,
          height: dim.outer,
          opacity,
          position: 'absolute',
          transform: [{ scale }],
          width: dim.outer,
        }}
      />
      <View
        className="items-center justify-center rounded-3xl border"
        style={{
          backgroundColor: `${accent}1f`,
          borderColor: accent,
          height: dim.outer,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 16,
          width: dim.outer,
        }}>
        <Ionicons color={THEME_COLORS.gold} name="star" size={dim.iconSize} />
        <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full border" style={{ backgroundColor: accent, borderColor: '#0A0E1A' }}>
          <Ionicons color="#0A0E1A" name={icon} size={dim.secondaryIcon} />
        </View>
      </View>
    </View>
  );
}

function WinCelebrationContainer({
  accent,
  children,
  size,
}: {
  accent: string;
  children: ReactNode;
  size: keyof typeof PREVIEW_DIMENSIONS;
}) {
  const dim = PREVIEW_DIMENSIONS[size];
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-3xl border"
      style={{
        backgroundColor: `${accent}1f`,
        borderColor: `${accent}88`,
        height: dim.outer,
        shadowColor: accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
        width: dim.outer,
      }}>
      {children}
    </View>
  );
}

function ScoreBurstPreview({ accent, size }: { accent: string; size: keyof typeof PREVIEW_DIMENSIONS }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const pulse = useLoop(true, 760, Easing.out(Easing.cubic));
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const flashOpacity = pulse.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.1, 0.46, 0.16] });
  const digitFontSize = size === 'lg' ? 29 : 18;

  return (
    <WinCelebrationContainer accent={accent} size={size}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.scorePreviewFlash,
          {
            backgroundColor: accent,
            opacity: flashOpacity,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.scorePreviewBoard,
          {
            borderColor: accent,
            transform: [{ scale }],
          },
        ]}>
        <View style={styles.scorePreviewTicker}>
          <Text style={[styles.scorePreviewLabel, { color: accent }]}>FINAL</Text>
          <Text style={[styles.scorePreviewLabel, { color: accent }]}>WIN</Text>
        </View>
        <View style={styles.scorePreviewDigits}>
          {SCOREBOARD_DIGITS.map((digit, index) => (
            <View
              key={`${digit}-${index}`}
              style={[
                styles.scorePreviewTile,
                {
                  borderColor: `${accent}66`,
                  height: dim.outer * 0.24,
                  width: dim.outer * 0.18,
                },
              ]}>
              <Text style={[styles.scorePreviewDigit, { color: accent, fontSize: digitFontSize }]}>
                {digit}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </WinCelebrationContainer>
  );
}

function StadiumCrowdPreview({ accent, size }: { accent: string; size: keyof typeof PREVIEW_DIMENSIONS }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const wave = useLoop(true, 900, Easing.inOut(Easing.ease));
  const rows = useMemo(
    () =>
      Array.from({ length: 9 }, (_, index) => ({
        bottom: 9 + (index % 3) * (dim.outer * 0.13),
        color: index % 4 === 0 ? THEME_COLORS.gold : accent,
        delayShift: index % 2 === 0 ? 0 : 1,
        id: index,
        size: dim.secondaryIcon + 5 + (index % 3),
        x: dim.outer * (0.12 + index * 0.095),
      })),
    [accent, dim.outer, dim.secondaryIcon],
  );

  return (
    <WinCelebrationContainer accent={accent} size={size}>
      <View style={[styles.crowdPreviewDeck, { borderColor: `${accent}55` }]} />
      {rows.map((member) => {
        const translateY = wave.interpolate({
          inputRange: [0, 1],
          outputRange: member.delayShift === 0 ? [0, -7] : [-7, 0],
        });
        const scale = wave.interpolate({
          inputRange: [0, 1],
          outputRange: member.delayShift === 0 ? [0.96, 1.08] : [1.08, 0.96],
        });
        return (
          <Animated.View
            key={member.id}
            pointerEvents="none"
            style={{
              bottom: member.bottom,
              left: member.x,
              position: 'absolute',
              transform: [{ translateY }, { scale }],
            }}>
            <Ionicons color={member.color} name="people" size={member.size} />
          </Animated.View>
        );
      })}
      <Ionicons color={THEME_COLORS.gold} name="radio" size={dim.secondaryIcon + 7} />
    </WinCelebrationContainer>
  );
}

function FireworksPreview({ accent, size }: { accent: string; size: keyof typeof PREVIEW_DIMENSIONS }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        duration: 1800,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const bursts = useMemo(
    () => [
      { delay: 0.05, id: 0, x: -dim.outer * 0.18, y: -dim.outer * 0.12 },
      { delay: 0.32, id: 1, x: dim.outer * 0.2, y: -dim.outer * 0.25 },
      { delay: 0.6, id: 2, x: dim.outer * 0.05, y: dim.outer * 0.11 },
    ],
    [dim.outer],
  );
  const particleCount = 8;
  const radius = dim.outer * 0.32;

  return (
    <WinCelebrationContainer accent={accent} size={size}>
      {[0.28, 0.5, 0.72].map((x, index) => (
        <View
          key={`trail-${index}`}
          style={[
            styles.fireworksPreviewTrail,
            {
              backgroundColor: accent,
              height: dim.outer * (0.28 + index * 0.04),
              left: dim.outer * x,
            },
          ]}
        />
      ))}
      {bursts.map((burst) => {
        const peak = Math.min(0.92, burst.delay + 0.32);
        const fade = Math.min(0.98, burst.delay + 0.58);
        const spread = progress.interpolate({
          inputRange: [0, burst.delay, peak, fade, 1],
          outputRange: [0, 0, 1, 1, 0],
        });
        const opacity = progress.interpolate({
          inputRange: [0, burst.delay, peak, fade, 1],
          outputRange: [0, 0, 1, 0.2, 0],
        });

        return (
          <View
            key={burst.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              transform: [{ translateX: burst.x }, { translateY: burst.y }],
            }}>
            {Array.from({ length: particleCount }).map((_, particleIndex) => {
              const angle = (particleIndex / particleCount) * Math.PI * 2;
              const translateX = spread.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.cos(angle) * radius],
              });
              const translateY = spread.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.sin(angle) * radius + dim.outer * 0.08],
              });
              return (
                <Animated.View
                  key={particleIndex}
                  pointerEvents="none"
                  style={[
                    styles.fireworksPreviewDot,
                    {
                      backgroundColor: particleIndex % 3 === 0 ? THEME_COLORS.gold : accent,
                      opacity,
                      transform: [{ translateX }, { translateY }],
                    },
                  ]}
                />
              );
            })}
          </View>
        );
      })}
    </WinCelebrationContainer>
  );
}

function WinCelebrationPreview({ accent, icon, size, styleKey }: { accent: string; icon: React.ComponentProps<typeof Ionicons>['name']; size: keyof typeof PREVIEW_DIMENSIONS; styleKey: string }) {
  const resolvedStyleKey = resolveWinCelebrationStyleKey(styleKey);

  if (resolvedStyleKey === 'score') {
    return <ScoreBurstPreview accent={accent} size={size} />;
  }

  if (resolvedStyleKey === 'crowd') {
    return <StadiumCrowdPreview accent={accent} size={size} />;
  }

  if (resolvedStyleKey === 'fireworks') {
    return <FireworksPreview accent={accent} size={size} />;
  }

  const dim = PREVIEW_DIMENSIONS[size];
  return (
    <WinCelebrationContainer accent={accent} size={size}>
      <Ionicons color={accent} name={icon} size={dim.iconSize} />
    </WinCelebrationContainer>
  );
}

function ChatStickerPreviewArt({ accent, icon, size }: { accent: string; icon: React.ComponentProps<typeof Ionicons>['name']; size: keyof typeof PREVIEW_DIMENSIONS }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const wobble = useLoop(true, 900);
  const rotate = wobble.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });
  return (
    <Animated.View
      className="items-center justify-center rounded-3xl border"
      style={{
        backgroundColor: `${accent}22`,
        borderColor: `${accent}77`,
        height: dim.outer,
        transform: [{ rotate }],
        width: dim.outer,
      }}>
      <Ionicons color={accent} name={icon} size={dim.iconSize} />
    </Animated.View>
  );
}

function ProfileFramePreview({ accent, icon, size }: { accent: string; icon: React.ComponentProps<typeof Ionicons>['name']; size: keyof typeof PREVIEW_DIMENSIONS }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const pulse = useLoop(true, 1500);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  return (
    <View style={{ height: dim.outer, width: dim.outer }}>
      <Animated.View
        pointerEvents="none"
        style={{
          borderColor: accent,
          borderRadius: dim.outer / 2,
          borderWidth: 2,
          height: dim.outer,
          opacity,
          position: 'absolute',
          transform: [{ scale }],
          width: dim.outer,
        }}
      />
      <View
        className="items-center justify-center rounded-3xl border"
        style={{
          backgroundColor: `${accent}1a`,
          borderColor: `${accent}77`,
          borderWidth: 2,
          height: dim.outer,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 14,
          width: dim.outer,
        }}>
        <View className="h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
          <Ionicons color="rgba(255,255,255,0.85)" name="person" size={20} />
        </View>
        <View
          className="absolute -bottom-1 -right-1 h-5 w-5 items-center justify-center rounded-full border"
          style={{ backgroundColor: accent, borderColor: '#0A0E1A' }}>
          <Ionicons color="#0A0E1A" name={icon} size={dim.secondaryIcon} />
        </View>
      </View>
    </View>
  );
}

export function CosmeticPreview({ category, itemId, size = 'md' }: CosmeticPreviewProps) {
  const item = getCosmeticItem(itemId);
  if (!item) return null;

  if (category === 'team_logo') {
    return <TeamLogoPreview accent={item.accent} icon={item.icon} size={size} />;
  }
  if (category === 'trophy_skin') {
    return <TrophyPreview accent={item.accent} icon={item.icon} size={size} />;
  }
  if (category === 'lock_effect') {
    return <LockEffectPreview accent={item.accent} icon={item.icon} size={size} />;
  }
  if (category === 'win_celebration') {
    return (
      <WinCelebrationPreview
        accent={item.accent}
        icon={item.icon}
        size={size}
        styleKey={item.styleKey}
      />
    );
  }
  if (category === 'chat_sticker_pack') {
    return <ChatStickerPreviewArt accent={item.accent} icon={item.icon} size={size} />;
  }
  if (category === 'profile_frame') {
    return <ProfileFramePreview accent={item.accent} icon={item.icon} size={size} />;
  }

  const dim = PREVIEW_DIMENSIONS[size];
  const previewStyle: ViewStyle = {
    backgroundColor: `${item.accent}1f`,
    borderColor: `${item.accent}66`,
    height: dim.outer,
    shadowColor: item.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    width: dim.outer,
  };
  return (
    <View className="items-center justify-center rounded-3xl border" style={previewStyle}>
      <Ionicons color={item.accent} name={item.icon} size={dim.iconSize} />
    </View>
  );
}

export function ChatStickerPreview({
  itemId,
  size = 'md',
}: {
  itemId: string;
  size?: 'md' | 'sm';
}) {
  const item = getCosmeticItem(itemId);
  const dimensions = size === 'sm' ? 'h-10 w-10 rounded-2xl' : 'h-16 w-16 rounded-3xl';
  const iconSize = size === 'sm' ? 18 : 28;

  if (!item) return null;

  return (
    <View
      className={cn('items-center justify-center border', dimensions)}
      style={{
        backgroundColor: `${item.accent}22`,
        borderColor: `${item.accent}77`,
      }}>
      <Ionicons color={item.accent} name={item.icon} size={iconSize} />
    </View>
  );
}

export function defaultCosmeticsByCategory() {
  return ALL_COSMETIC_ITEMS.reduce<Partial<Record<CosmeticCategory, string>>>((accumulator, item) => {
    if (!accumulator[item.category]) {
      accumulator[item.category] = item.id;
    }
    return accumulator;
  }, {});
}

const styles = StyleSheet.create({
  crowdGlow: {
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    bottom: -72,
    height: 240,
    left: -48,
    position: 'absolute',
    right: -48,
  },
  crowdMember: {
    marginLeft: -18,
    position: 'absolute',
  },
  crowdNoise: {
    borderRadius: 999,
    position: 'absolute',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  crowdPreviewDeck: {
    backgroundColor: 'rgba(10,14,26,0.82)',
    borderTopWidth: 1,
    bottom: 0,
    height: '36%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  fireworkAnchor: {
    position: 'absolute',
  },
  fireworkParticle: {
    borderRadius: 999,
    left: -3,
    position: 'absolute',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    top: -3,
  },
  fireworkParticleTrail: {
    borderRadius: 999,
    height: 18,
    left: '45%',
    opacity: 0.48,
    position: 'absolute',
    top: 7,
    width: 1.5,
  },
  fireworkRocket: {
    alignItems: 'center',
    left: -4,
    position: 'absolute',
    top: -4,
  },
  fireworkRocketDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  fireworkRocketTrail: {
    borderRadius: 999,
    height: 48,
    marginTop: 2,
    opacity: 0.72,
    width: 2,
  },
  fireworksPreviewDot: {
    borderRadius: 999,
    height: 5,
    position: 'absolute',
    width: 5,
  },
  fireworksPreviewTrail: {
    borderRadius: 999,
    bottom: 0,
    opacity: 0.58,
    position: 'absolute',
    width: 2,
  },
  scoreboardDigit: {
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 0,
  },
  scoreboardDigitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreboardDigitTile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 46,
  },
  scoreboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoreboardKicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  scoreboardPlate: {
    backgroundColor: 'rgba(10,14,26,0.94)',
    borderRadius: 8,
    borderWidth: 3,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
  },
  scoreboardSweep: {
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
  },
  scoreBurstStage: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scorePreviewBoard: {
    backgroundColor: 'rgba(10,14,26,0.9)',
    borderRadius: 6,
    borderWidth: 2,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  scorePreviewDigit: {
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 0,
  },
  scorePreviewDigits: {
    flexDirection: 'row',
    gap: 3,
  },
  scorePreviewFlash: {
    borderRadius: 22,
    bottom: 10,
    left: 10,
    position: 'absolute',
    right: 10,
    top: 10,
  },
  scorePreviewLabel: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scorePreviewTicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scorePreviewTile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    borderWidth: 1,
    justifyContent: 'center',
  },
  scoreShard: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,14,26,0.86)',
    borderRadius: 6,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    minWidth: 38,
    paddingHorizontal: 7,
    position: 'absolute',
  },
  scoreShardText: {
    fontSize: 30,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 0,
  },
});
