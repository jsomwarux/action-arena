import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';
import {
  evaluateLiveLegStatus,
  formatLiveScore,
  getLiveLegFocusTeam,
  isLiveScoreActive,
  livePickStatusCopy,
  type LivePickStatus,
} from '@/lib/live-pick-status';
import type { BetLegRow, LiveGameStateRow } from '@/types/database';

const STATUS_INDEX: Record<LivePickStatus, number> = {
  winning: 0,
  neutral: 1,
  losing: 2,
};

const STATUS_DOT_COLORS = [
  THEME_COLORS.electricGreen,
  THEME_COLORS.amberAccent,
  THEME_COLORS.coralRed,
];

const STATUS_BG_COLORS = [
  'rgba(0,255,135,0.14)',
  'rgba(255,165,2,0.14)',
  'rgba(255,71,87,0.14)',
];

const STATUS_BORDER_COLORS = [
  'rgba(0,255,135,0.40)',
  'rgba(255,165,2,0.40)',
  'rgba(255,71,87,0.40)',
];

const STATUS_TEXT_CLASS: Record<LivePickStatus, string> = {
  losing: 'text-coral-red',
  neutral: 'text-amber-accent',
  winning: 'text-electric-green',
};

type PillSize = 'sm' | 'md';

const PILL_SIZING: Record<
  PillSize,
  { container: string; dot: number; gap: string; text: string }
> = {
  sm: { container: 'px-1.5 py-[2px]', dot: 6, gap: 'gap-1', text: 'text-[9px]' },
  md: { container: 'px-2.5 py-1', dot: 7, gap: 'gap-1.5', text: 'text-[10px]' },
};

const STATUS_DOMAIN = [0, 1, 2];
const STATUS_FLIP_DURATION_MS = 220;
const SCORE_TICK_FADE_DOWN_MS = 120;
const SCORE_TICK_FADE_UP_MS = 200;
const LIVE_PULSE_HALF_DURATION_MS = 700;

export function LiveStatusPill({
  size = 'md',
  status,
}: {
  size?: PillSize;
  status: LivePickStatus;
}) {
  const sizing = PILL_SIZING[size];
  const targetIndex = STATUS_INDEX[status];
  const progress = useSharedValue(targetIndex);

  useEffect(() => {
    progress.value = withTiming(targetIndex, { duration: STATUS_FLIP_DURATION_MS });
  }, [progress, targetIndex]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, STATUS_DOMAIN, STATUS_BG_COLORS),
    borderColor: interpolateColor(progress.value, STATUS_DOMAIN, STATUS_BORDER_COLORS),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, STATUS_DOMAIN, STATUS_DOT_COLORS),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, STATUS_DOMAIN, STATUS_DOT_COLORS),
  }));

  return (
    <Animated.View
      className={cn('flex-row items-center rounded-full border', sizing.container, sizing.gap)}
      style={containerStyle}>
      <Animated.View
        style={[
          {
            borderRadius: 999,
            height: sizing.dot,
            shadowColor: STATUS_DOT_COLORS[targetIndex],
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 4,
            width: sizing.dot,
          },
          dotStyle,
        ]}
      />
      <Animated.Text
        className={cn('font-black uppercase', sizing.text, STATUS_TEXT_CLASS[status])}
        style={[{ letterSpacing: 1 }, labelStyle]}>
        {livePickStatusCopy[status]}
      </Animated.Text>
    </Animated.View>
  );
}

function LivePulseDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: LIVE_PULSE_HALF_DURATION_MS }),
        withTiming(1, { duration: LIVE_PULSE_HALF_DURATION_MS }),
      ),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: THEME_COLORS.coralRed,
          borderRadius: 999,
          height: 6,
          shadowColor: THEME_COLORS.coralRed,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 4,
          width: 6,
        },
        animatedStyle,
      ]}
    />
  );
}

type ActiveLegScoreLineProps = {
  leg: Pick<BetLegRow, 'adjusted_line' | 'game_id' | 'market' | 'original_line' | 'selection'>;
  score: LiveGameStateRow;
};

// Split out so we can use hooks unconditionally — when the parent's score is
// inactive, the active component never mounts and no animation state lingers.
function ActiveLegScoreLine({ leg, score }: ActiveLegScoreLineProps) {
  const status = evaluateLiveLegStatus(leg, score);
  const scoreText = formatLiveScore(score, getLiveLegFocusTeam(leg));

  const opacity = useSharedValue(1);
  const previousScoreText = useRef(scoreText);

  useEffect(() => {
    if (previousScoreText.current !== scoreText) {
      opacity.value = withSequence(
        withTiming(0.35, { duration: SCORE_TICK_FADE_DOWN_MS }),
        withTiming(1, { duration: SCORE_TICK_FADE_UP_MS }),
      );
      previousScoreText.current = scoreText;
    }
  }, [opacity, scoreText]);

  const animatedScoreStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View className="mt-2 gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-1.5">
      <View className="flex-row items-center gap-2">
        <LivePulseDot />
        <Animated.Text
          className="flex-1 text-[11px] font-semibold text-white/65"
          style={animatedScoreStyle}>
          {scoreText}
        </Animated.Text>
      </View>
      {status ? (
        <View className="self-start">
          <LiveStatusPill size="sm" status={status} />
        </View>
      ) : null}
    </View>
  );
}

export function LiveLegScoreLine({
  leg,
  score,
}: {
  leg: Pick<BetLegRow, 'adjusted_line' | 'game_id' | 'market' | 'original_line' | 'selection'>;
  score: LiveGameStateRow | undefined;
}) {
  if (!isLiveScoreActive(score)) {
    return null;
  }

  return <ActiveLegScoreLine leg={leg} score={score} />;
}

export function LiveBetStatusSummary({ status }: { status: LivePickStatus | null }) {
  if (!status) {
    return null;
  }

  return (
    <View className="self-start">
      <LiveStatusPill size="md" status={status} />
    </View>
  );
}
