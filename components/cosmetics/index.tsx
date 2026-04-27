import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Text, View, type ViewStyle } from 'react-native';

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

function usePulse(enabled = true) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return undefined;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          duration: 1100,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          duration: 1100,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [enabled, progress]);

  return progress;
}

export function CosmeticAvatar({ cosmetics, name, size = 'md' }: CosmeticAvatarProps) {
  const logo = itemFor(cosmetics, 'team_logo');
  const frame = itemFor(cosmetics, 'profile_frame');
  const sizeClasses = avatarSizes[size];
  const accent = frame?.accent ?? logo?.accent ?? THEME_COLORS.electricGreen;

  return (
    <View
      className={cn('items-center justify-center border bg-white/[0.04]', sizeClasses.outer)}
      style={{
        borderColor: frame ? accent : 'rgba(255,255,255,0.12)',
        borderWidth: frame ? 2 : 1,
        shadowColor: frame ? accent : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: frame ? 0.35 : 0,
        shadowRadius: frame ? 10 : 0,
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
      <Ionicons color={trophy?.accent ?? THEME_COLORS.gold} name={trophy?.icon ?? 'trophy'} size={size} />
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
  const progress = usePulse(Boolean(effect));
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
        variant={celebration?.styleKey === 'money' ? 'parlay' : 'standard'}
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

export function CosmeticPreview({ category, itemId }: CosmeticPreviewProps) {
  const item = getCosmeticItem(itemId);
  const progress = usePulse(true);
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-3deg', '3deg'],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  if (!item) {
    return null;
  }

  const previewStyle: ViewStyle = {
    backgroundColor: `${item.accent}1f`,
    borderColor: `${item.accent}66`,
    shadowColor: item.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
  };

  return (
    <Animated.View
      className="h-16 w-16 items-center justify-center rounded-3xl border"
      style={[
        previewStyle,
        {
          transform: category === 'trophy_skin' ? [{ rotate }] : [{ scale }],
        },
      ]}>
      <Ionicons color={item.accent} name={item.icon} size={28} />
    </Animated.View>
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
