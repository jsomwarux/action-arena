import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Confetti } from '@/components/ui';
import { ALL_COSMETIC_ITEMS, getCosmeticItem } from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';
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
  return (
    <>
      <Confetti
        fireKey={fireKey}
        onComplete={onComplete}
        variant={celebration?.styleKey === 'score' ? 'parlay' : 'standard'}
        visible={visible}
      />
      {visible && celebration ? (
        <View pointerEvents="none" className="absolute left-0 right-0 top-20 z-50 items-center">
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
      ) : null}
    </>
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
  const spin = useSpin(true, 5500);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] });
  const shine = useLoop(true, 1400);
  const shineOpacity = shine.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] });
  return (
    <View style={{ height: dim.outer, width: dim.outer }}>
      <Animated.View
        pointerEvents="none"
        style={{
          backgroundColor: accent,
          borderRadius: dim.outer / 2,
          height: dim.outer,
          opacity: shineOpacity,
          position: 'absolute',
          width: dim.outer,
          // Faded radial-feel via opacity.
        }}
      />
      <Animated.View
        className="items-center justify-center rounded-3xl border"
        style={{
          backgroundColor: `${accent}24`,
          borderColor: `${accent}99`,
          height: dim.outer,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.55,
          shadowRadius: 18,
          transform: [{ rotate }],
          width: dim.outer,
        }}>
        <Ionicons color={accent} name={icon} size={dim.iconSize} />
      </Animated.View>
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

function WinCelebrationPreview({ accent, icon, size, styleKey }: { accent: string; icon: React.ComponentProps<typeof Ionicons>['name']; size: keyof typeof PREVIEW_DIMENSIONS; styleKey: string }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const drop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(drop, { duration: 2200, easing: Easing.linear, toValue: 1, useNativeDriver: true }),
    );
    animation.start();
    return () => animation.stop();
  }, [drop]);
  const offsets = useMemo(
    () =>
      [0, 0.18, 0.32, 0.48, 0.6, 0.74].map((shift, idx) => ({
        delay: shift,
        idx,
        x: -dim.outer / 2 + (dim.outer / 6) * (idx + 0.4),
      })),
    [dim.outer],
  );
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
      {offsets.map(({ delay, idx, x }) => {
        const translateY = drop.interpolate({
          inputRange: [0, delay, Math.min(1, delay + 0.6), 1],
          outputRange: [-dim.outer / 2, -dim.outer / 2, dim.outer / 2, dim.outer / 2],
        });
        const opacity = drop.interpolate({
          inputRange: [0, delay, Math.min(1, delay + 0.05), Math.min(1, delay + 0.55), 1],
          outputRange: [0, 0, 1, 0.3, 0],
        });
        return (
          <Animated.View
            key={idx}
            pointerEvents="none"
            style={{
              opacity,
              position: 'absolute',
              transform: [{ translateX: x }, { translateY }],
            }}>
            <Ionicons
              color={accent}
              name={styleKey === 'score' ? 'sparkles' : styleKey === 'crowd' ? 'people' : 'sparkles'}
              size={dim.secondaryIcon + 4}
            />
          </Animated.View>
        );
      })}
      <Ionicons color={accent} name={icon} size={dim.iconSize} />
    </View>
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
