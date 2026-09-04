import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { createPortal } from 'react-dom';
import { motion, type Transition } from 'framer-motion';

import { ALL_COSMETIC_ITEMS, getCosmeticItem } from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';
import type { CosmeticCategory, EquippedCosmeticsByCategory } from '@/types/database';

import { CosmeticIcon } from './icons';

export { CosmeticIcon, getCosmeticIconComponent, type CosmeticIconProps } from './icons';

/**
 * Web port of components/cosmetics/index.tsx.
 *
 * Exported names and props are identical to mobile on purpose: every other
 * surface (shop, profile, chat, league hub) can adopt this file without
 * changing a single call site. Only the rendering primitives differ — RN
 * `Animated` becomes framer-motion, Ionicons becomes the lucide map in
 * ./icons.tsx.
 *
 * Animation rule for this file: every element's *resting* state is visible.
 * Loops animate a decorative layer that already has a non-zero opacity, and the
 * one-shot celebration overlays are mounted only while they play. Nothing here
 * depends on an animation frame ever arriving to become legible.
 */

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
  lg: { icon: 28, outer: 'h-16 w-16 rounded-3xl', radius: 26, text: 'text-xl' },
  md: { icon: 20, outer: 'h-11 w-11 rounded-2xl', radius: 18, text: 'text-sm' },
  sm: { icon: 15, outer: 'h-8 w-8 rounded-xl', radius: 14, text: 'text-[10px]' },
};

/** The RN `Easing.inOut(Easing.ease)` loops all read as this on the web. */
const LOOP_EASE = 'easeInOut';

function loopTransition(durationMs: number): Transition {
  return {
    duration: (durationMs * 2) / 1000,
    ease: LOOP_EASE,
    repeat: Infinity,
    repeatType: 'loop',
  };
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
}

function itemFor(
  cosmetics: EquippedCosmeticsByCategory | null | undefined,
  category: CosmeticCategory,
) {
  return getCosmeticItem(cosmetics?.[category]?.item_id);
}

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
  }));

  useEffect(() => {
    const onResize = () => setSize({ height: window.innerHeight, width: window.innerWidth });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

export function CosmeticAvatar({ cosmetics, name, size = 'md' }: CosmeticAvatarProps) {
  const logo = itemFor(cosmetics, 'team_logo');
  const frame = itemFor(cosmetics, 'profile_frame');
  const sizeClasses = avatarSizes[size];
  const accent = frame?.accent ?? logo?.accent ?? THEME_COLORS.electricGreen;

  return (
    <div className={cn('relative flex shrink-0 items-center justify-center', sizeClasses.outer)}>
      {frame ? (
        <motion.span
          animate={{ opacity: [0.25, 0.6, 0.25], scale: [0.96, 1.04, 0.96] }}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0.25, scale: 1 }}
          style={{
            borderColor: accent,
            borderRadius: sizeClasses.radius,
            borderStyle: 'solid',
            borderWidth: 2,
          }}
          transition={loopTransition(1500)}
        />
      ) : null}
      <div
        className={cn(
          'flex items-center justify-center bg-white/[0.04]',
          sizeClasses.outer,
        )}
        style={{
          borderColor: frame ? accent : 'rgba(255,255,255,0.12)',
          borderStyle: 'solid',
          borderWidth: frame ? 2 : 1,
          boxShadow: frame ? `0 0 12px ${accent}66` : undefined,
        }}>
        {logo ? (
          <CosmeticIcon color={logo.accent} name={logo.icon} size={sizeClasses.icon} />
        ) : (
          <span
            className={cn('font-black uppercase text-white/80', sizeClasses.text)}
            style={{ letterSpacing: '0.4px' }}>
            {initialsFor(name) || '?'}
          </span>
        )}
      </div>
    </div>
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
  const accent = trophy?.accent ?? THEME_COLORS.gold;

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl border"
      style={{
        backgroundColor: trophy ? `${trophy.accent}24` : 'rgba(255,215,0,0.14)',
        borderColor: trophy ? `${trophy.accent}88` : 'rgba(255,215,0,0.45)',
        boxShadow: `0 0 ${trophy ? 12 : 8}px ${accent}${trophy ? '73' : '33'}`,
        height: size + 22,
        width: size + 22,
      }}>
      {trophy ? (
        <motion.span
          animate={{ rotate: 360 }}
          className="flex items-center justify-center"
          initial={{ rotate: 0 }}
          transition={{ duration: 6, ease: 'linear', repeat: Infinity }}>
          <CosmeticIcon color={trophy.accent} name={trophy.icon} size={size} />
        </motion.span>
      ) : (
        <CosmeticIcon color={THEME_COLORS.gold} name="trophy" size={size} />
      )}
    </div>
  );
}

export function LockEffect({
  children,
  compact = false,
  cosmetics,
}: {
  children: ReactNode;
  compact?: boolean;
  cosmetics?: EquippedCosmeticsByCategory | null;
}) {
  const effect = itemFor(cosmetics, 'lock_effect');

  if (!effect) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <motion.span
        animate={{ opacity: [0.38, 0.9, 0.38], scale: [1, compact ? 1.04 : 1.08, 1] }}
        aria-hidden
        className="pointer-events-none absolute -inset-1"
        initial={{ opacity: 0.38, scale: 1 }}
        style={{
          backgroundColor: `${effect.accent}22`,
          borderColor: `${effect.accent}88`,
          borderRadius: compact ? 999 : 18,
          borderStyle: 'solid',
          borderWidth: 1,
        }}
        transition={loopTransition(1100)}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

// ============================================================
// Win celebrations. Overlays are portalled to <body> and mounted only while
// they play, so nothing here can leave a half-faded artefact behind.
// ============================================================

const SCORE_BURST_DURATION = 1450;
const STADIUM_CROWD_DURATION = 2300;
const FIREWORKS_DURATION = 3900;
const CONFETTI_DURATION = 3200;

const SCOREBOARD_DIGITS = ['+', '1', '0', '0'] as const;
const SCORE_SHARDS = [
  { rotate: -16, text: '7', x: -118, y: -70 },
  { rotate: 12, text: '3', x: 116, y: -60 },
  { rotate: 20, text: '+', x: -94, y: 76 },
  { rotate: -10, text: '1', x: 92, y: 84 },
  { rotate: 8, text: '0', x: -36, y: -104 },
  { rotate: -22, text: '0', x: 42, y: 112 },
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

function OverlayPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">{children}</div>,
    document.body,
  );
}

function ScoreBurstOverlay({ accent }: { accent: string }) {
  const seconds = SCORE_BURST_DURATION / 1000;

  return (
    <>
      <motion.div
        animate={{ opacity: [0, 0.42, 0, 0] }}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        style={{ backgroundColor: accent }}
        transition={{ duration: seconds, ease: 'easeOut', times: [0, 0.16, 0.34, 1] }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        {SCORE_SHARDS.map((shard, index) => (
          <motion.div
            animate={{
              opacity: [0, 1, 0.75, 0],
              rotate: shard.rotate,
              scale: [0.4, 1, 0.82],
              x: [0, shard.x * 0.34, shard.x],
              y: [0, shard.y * 0.28, shard.y],
            }}
            className="absolute flex h-[46px] min-w-[38px] items-center justify-center rounded-md border px-[7px]"
            initial={{ opacity: 0, rotate: shard.rotate, scale: 0.4, x: 0, y: 0 }}
            key={`${shard.text}-${index}`}
            style={{
              backgroundColor: 'rgba(10,14,26,0.86)',
              borderColor: `${accent}99`,
            }}
            transition={{ duration: seconds, ease: 'easeOut' }}>
            <span
              className="text-[30px] font-black tabular-nums"
              style={{ color: accent }}>
              {shard.text}
            </span>
          </motion.div>
        ))}

        <motion.div
          animate={{ opacity: [0, 1, 1, 0], scale: [0.62, 1.08, 1, 1.16], y: [18, 0, 0, -18] }}
          className="relative overflow-hidden rounded-lg px-6 py-3.5"
          initial={{ opacity: 0, scale: 0.62, y: 18 }}
          style={{
            backgroundColor: 'rgba(10,14,26,0.94)',
            borderColor: accent,
            borderStyle: 'solid',
            borderWidth: 3,
            boxShadow: `0 0 24px ${accent}d9`,
          }}
          transition={{ duration: seconds, ease: 'easeOut', times: [0, 0.38, 0.78, 1] }}>
          <div className="mb-2 flex justify-between">
            <span
              className="text-[11px] font-black tracking-[1.2px]"
              style={{ color: accent }}>
              FINAL
            </span>
            <span
              className="text-[11px] font-black tracking-[1.2px]"
              style={{ color: accent }}>
              WIN
            </span>
          </div>
          <div className="flex gap-2">
            {SCOREBOARD_DIGITS.map((digit, index) => (
              <div
                className="flex h-16 w-[46px] items-center justify-center rounded border bg-white/[0.06]"
                key={`${digit}-${index}`}
                style={{ borderColor: `${accent}66` }}>
                <span
                  className="text-[44px] font-black leading-none tabular-nums"
                  style={{ color: accent }}>
                  {digit}
                </span>
              </div>
            ))}
          </div>
          <motion.div
            animate={{ opacity: [0, 0.95, 0, 0], y: [-46, 46, 46, 46] }}
            className="absolute left-0 right-0 top-1/2 h-[2px]"
            initial={{ opacity: 0, y: -46 }}
            style={{ backgroundColor: accent }}
            transition={{ duration: seconds, ease: 'linear', times: [0, 0.18, 0.52, 1] }}
          />
        </motion.div>
      </div>
    </>
  );
}

function StadiumCrowdOverlay({ accent, fireKey }: { accent: string; fireKey: number }) {
  const { height, width } = useViewportSize();
  const seconds = STADIUM_CROWD_DURATION / 1000;
  const members = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const row = index % 3;
        return {
          bottom: 46 + row * 30,
          color: index % 5 === 0 ? THEME_COLORS.gold : accent,
          delay: (index % 6) * 0.08,
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
        delay: (index % 8) * 0.1,
        id: index,
        rise: 130 + seededUnit(fireKey + index * 17) * 190,
        size: 3 + seededUnit(fireKey + index * 23) * 4,
        x: seededUnit(fireKey + index * 31) * width,
      })),
    [accent, fireKey, width],
  );

  return (
    <>
      <motion.div
        animate={{ opacity: [0, 0.26, 0.2, 0] }}
        className="absolute -bottom-[72px] -left-12 -right-12 h-60 rounded-t-full"
        initial={{ opacity: 0 }}
        style={{ backgroundColor: accent }}
        transition={{ duration: seconds, ease: 'easeOut', times: [0, 0.22, 0.74, 1] }}
      />
      {noise.map((dot) => (
        <motion.span
          animate={{ opacity: [0, 0.9, 0.55, 0], y: [0, -dot.rise, -dot.rise - 38] }}
          className="absolute rounded-full"
          initial={{ opacity: 0, y: 0 }}
          key={dot.id}
          style={{
            backgroundColor: dot.color,
            bottom: height * 0.16,
            boxShadow: `0 0 8px ${dot.color}99`,
            height: dot.size,
            left: dot.x,
            width: dot.size,
          }}
          transition={{ delay: dot.delay, duration: seconds - dot.delay, ease: 'easeOut' }}
        />
      ))}
      {members.map((member) => (
        <motion.span
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0.7, 1.12, 1, 0.92],
            y: [height * 0.16, -16, 0, -30],
          }}
          className="absolute -ml-[18px]"
          initial={{ opacity: 0, scale: 0.7, y: height * 0.16 }}
          key={member.id}
          style={{ bottom: member.bottom, left: member.x }}
          transition={{
            delay: member.delay,
            duration: seconds - member.delay,
            ease: 'easeOut',
            times: [0, 0.28, 0.42, 1],
          }}>
          <CosmeticIcon color={member.color} name="people" size={member.size} />
        </motion.span>
      ))}
    </>
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
  const delaySeconds = delay / 1000;

  return (
    <div className="absolute" style={{ left: anchorX, top: anchorY }}>
      <motion.div
        animate={{ opacity: [0, 1, 1, 0, 0], y: [launchDistance, 0, 0, 0, 0] }}
        className="absolute -left-1 -top-1 flex flex-col items-center"
        initial={{ opacity: 0, y: launchDistance }}
        transition={{
          delay: delaySeconds,
          duration: 1.42,
          ease: 'easeOut',
          times: [0, 0.32, 0.34, 0.36, 1],
        }}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
        <span
          className="mt-0.5 w-[2px] rounded-full opacity-70"
          style={{ backgroundColor: accent, height: 48 }}
        />
      </motion.div>
      {particles.map((particle) => (
        <motion.span
          animate={{
            opacity: [0, 0, 1, 0.74, 0],
            scale: [0.35, 0.35, 1, 0.8, 0.55],
            x: [0, 0, particle.dx, particle.dx, particle.dx],
            y: [0, 0, particle.dy, particle.dy + 26, particle.dy + 52],
          }}
          className="absolute rounded-full"
          initial={{ opacity: 0, scale: 0.35, x: 0, y: 0 }}
          key={particle.id}
          style={{
            backgroundColor: particle.color,
            boxShadow: `0 0 8px ${particle.color}b3`,
            height: particle.size,
            left: -3,
            top: -3,
            width: particle.size,
          }}
          transition={{
            delay: delaySeconds,
            duration: 1.42,
            ease: 'easeOut',
            times: [0, 0.27, 0.4, 0.78, 1],
          }}
        />
      ))}
    </div>
  );
}

function FireworksOverlay({ accent, fireKey }: { accent: string; fireKey: number }) {
  const { height, width } = useViewportSize();
  const bursts = useMemo(() => {
    const shortSide = Math.min(width, height);
    return [
      { count: 12, delay: 0, id: 0, radius: shortSide * 0.12, x: width * 0.24, y: height * 0.31 },
      { count: 14, delay: 380, id: 1, radius: shortSide * 0.14, x: width * 0.72, y: height * 0.24 },
      { count: 16, delay: 820, id: 2, radius: shortSide * 0.16, x: width * 0.48, y: height * 0.43 },
      { count: 12, delay: 1260, id: 3, radius: shortSide * 0.13, x: width * 0.18, y: height * 0.54 },
      { count: 13, delay: 1680, id: 4, radius: shortSide * 0.13, x: width * 0.8, y: height * 0.49 },
    ];
  }, [height, width]);

  return (
    <>
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
    </>
  );
}

const CONFETTI_COLORS = [
  THEME_COLORS.electricGreen,
  '#48FFAB',
  THEME_COLORS.gold,
  '#A6FFD2',
  THEME_COLORS.textPrimary,
];

/**
 * Stand-in for mobile's shared <Confetti variant="standard" />, which lives in
 * components/ui and has no web counterpart yet. Same palette and same job: the
 * default celebration for a player who has not equipped one.
 */
function StandardConfetti({ fireKey }: { fireKey: number }) {
  const { height, width } = useViewportSize();
  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, (_, index) => {
        const seed = (index + 1) * ((Math.abs(fireKey) % 1000) + 1);
        return {
          color: CONFETTI_COLORS[Math.floor(seededUnit(seed) * CONFETTI_COLORS.length) % CONFETTI_COLORS.length],
          delay: seededUnit(seed + 1) * 0.4,
          drift: (seededUnit(seed + 2) - 0.5) * 160,
          duration: 1.6 + seededUnit(seed + 3) * 1.4,
          id: index,
          rotation: seededUnit(seed + 4) * 720 - 360,
          round: seededUnit(seed + 5) > 0.72,
          size: 6 + seededUnit(seed) * 6,
          startX: seededUnit(seed + 5) * width,
        };
      }),
    [fireKey, width],
  );

  return (
    <>
      {pieces.map((piece) => (
        <motion.span
          animate={{
            opacity: [1, 1, 0],
            rotate: piece.rotation,
            x: piece.drift,
            y: height + 60,
          }}
          className={piece.round ? 'absolute rounded-full' : 'absolute rounded-[2px]'}
          initial={{ opacity: 1, rotate: 0, x: 0, y: -40 }}
          key={piece.id}
          style={{
            backgroundColor: piece.color,
            height: piece.round ? piece.size : piece.size * 1.6,
            left: piece.startX,
            top: 0,
            width: piece.size,
          }}
          transition={{
            delay: piece.delay,
            duration: piece.duration,
            ease: 'easeIn',
            times: [0, 0.82, 1],
          }}
        />
      ))}
    </>
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
  const styleKey = celebration ? resolveWinCelebrationStyleKey(celebration.styleKey) : null;
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!visible) {
      setActiveKey(null);
      return undefined;
    }

    setActiveKey(seedFromFireKey(fireKey));
    const timer = window.setTimeout(
      () => {
        setActiveKey(null);
        onCompleteRef.current?.();
      },
      styleKey ? winCelebrationDurationFor(styleKey) : CONFETTI_DURATION,
    );

    return () => window.clearTimeout(timer);
  }, [fireKey, styleKey, visible]);

  if (!visible || activeKey === null) {
    return null;
  }

  if (!celebration || !styleKey) {
    return (
      <OverlayPortal>
        <StandardConfetti fireKey={activeKey} key={activeKey} />
      </OverlayPortal>
    );
  }

  return (
    <OverlayPortal>
      <div key={activeKey}>
        {styleKey === 'score' ? (
          <ScoreBurstOverlay accent={celebration.accent} />
        ) : styleKey === 'crowd' ? (
          <StadiumCrowdOverlay accent={celebration.accent} fireKey={activeKey} />
        ) : (
          <FireworksOverlay accent={celebration.accent} fireKey={activeKey} />
        )}
        <div className="absolute left-0 right-0 top-20 flex justify-center">
          <div
            className="flex items-center gap-2 rounded-full border px-4 py-2"
            style={{
              backgroundColor: `${celebration.accent}22`,
              borderColor: `${celebration.accent}88`,
            }}>
            <CosmeticIcon color={celebration.accent} name={celebration.icon} size={14} />
            <span className="text-[10px] font-black uppercase tracking-[1.6px] text-white">
              {celebration.name}
            </span>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}

// ============================================================
// Per-category preview presentations. Each kind has its own visual vocabulary
// so the shop feels like browsing actual product art.
// ============================================================

const PREVIEW_DIMENSIONS = {
  lg: { iconSize: 40, outer: 110, secondaryIcon: 14 },
  md: { iconSize: 28, outer: 76, secondaryIcon: 11 },
};

type PreviewSize = keyof typeof PREVIEW_DIMENSIONS;

function squareStyle(outer: number, extra?: CSSProperties): CSSProperties {
  return { height: outer, width: outer, ...extra };
}

function TeamLogoPreview({
  accent,
  icon,
  size,
}: {
  accent: string;
  icon: string;
  size: PreviewSize;
}) {
  const dim = PREVIEW_DIMENSIONS[size];

  return (
    <div className="relative" style={squareStyle(dim.outer)}>
      <motion.span
        animate={{ scale: [1, 1.06, 1] }}
        aria-hidden
        className="absolute inset-0 rounded-full opacity-55"
        initial={{ scale: 1 }}
        style={{ backgroundColor: `${accent}1a` }}
        transition={loopTransition(1700)}
      />
      <div
        className="relative flex items-center justify-center rounded-3xl border"
        style={squareStyle(dim.outer, {
          backgroundColor: `${accent}1f`,
          borderColor: `${accent}77`,
          boxShadow: `0 0 14px ${accent}59`,
        })}>
        <CosmeticIcon color={accent} name={icon} size={dim.iconSize} />
      </div>
    </div>
  );
}

function TrophyPreview({
  accent,
  icon,
  size,
}: {
  accent: string;
  icon: string;
  size: PreviewSize;
}) {
  const dim = PREVIEW_DIMENSIONS[size];

  return (
    <div className="relative" style={squareStyle(dim.outer)}>
      <motion.span
        animate={{ opacity: [0.18, 0.42, 0.18] }}
        aria-hidden
        className="absolute inset-1.5 rounded-3xl"
        initial={{ opacity: 0.18 }}
        style={{ backgroundColor: accent }}
        transition={loopTransition(1600)}
      />
      <div
        className="relative flex items-center justify-center rounded-3xl border"
        style={squareStyle(dim.outer, {
          backgroundColor: `${accent}24`,
          borderColor: `${accent}99`,
          boxShadow: `0 0 18px ${accent}8c`,
        })}>
        <CosmeticIcon color={accent} name={icon} size={dim.iconSize} />
      </div>
    </div>
  );
}

function LockEffectPreview({
  accent,
  icon,
  size,
}: {
  accent: string;
  icon: string;
  size: PreviewSize;
}) {
  const dim = PREVIEW_DIMENSIONS[size];

  return (
    <div className="relative" style={squareStyle(dim.outer)}>
      <motion.span
        animate={{ opacity: [0.25, 0.85, 0.25], scale: [0.92, 1.12, 0.92] }}
        aria-hidden
        className="absolute inset-0 rounded-full"
        initial={{ opacity: 0.25, scale: 1 }}
        style={{ borderColor: `${accent}aa`, borderStyle: 'solid', borderWidth: 1.5 }}
        transition={loopTransition(950)}
      />
      <div
        className="relative flex items-center justify-center rounded-3xl border"
        style={squareStyle(dim.outer, {
          backgroundColor: `${accent}1f`,
          borderColor: accent,
          boxShadow: `0 0 16px ${accent}99`,
        })}>
        <CosmeticIcon color={THEME_COLORS.gold} name="star" size={dim.iconSize} />
        <span
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border"
          style={{ backgroundColor: accent, borderColor: '#0A0E1A' }}>
          <CosmeticIcon color="#0A0E1A" name={icon} size={dim.secondaryIcon} />
        </span>
      </div>
    </div>
  );
}

function WinCelebrationContainer({
  accent,
  children,
  size,
}: {
  accent: string;
  children: ReactNode;
  size: PreviewSize;
}) {
  const dim = PREVIEW_DIMENSIONS[size];

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-3xl border"
      style={squareStyle(dim.outer, {
        backgroundColor: `${accent}1f`,
        borderColor: `${accent}88`,
        boxShadow: `0 0 14px ${accent}80`,
      })}>
      {children}
    </div>
  );
}

function ScoreBurstPreview({ accent, size }: { accent: string; size: PreviewSize }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const digitFontSize = size === 'lg' ? 29 : 18;

  return (
    <WinCelebrationContainer accent={accent} size={size}>
      <motion.span
        animate={{ opacity: [0.1, 0.46, 0.1], scale: [0.92, 1.08, 0.92] }}
        aria-hidden
        className="absolute inset-2.5 rounded-[22px]"
        initial={{ opacity: 0.16, scale: 1 }}
        style={{ backgroundColor: accent }}
        transition={loopTransition(760)}
      />
      <motion.div
        animate={{ scale: [0.92, 1.08, 0.92] }}
        className="relative overflow-hidden rounded-md px-2 py-[7px]"
        initial={{ scale: 1 }}
        style={{
          backgroundColor: 'rgba(10,14,26,0.9)',
          borderColor: accent,
          borderStyle: 'solid',
          borderWidth: 2,
        }}
        transition={loopTransition(760)}>
        <div className="mb-1 flex justify-between">
          <span className="text-[7px] font-black tracking-[0.8px]" style={{ color: accent }}>
            FINAL
          </span>
          <span className="text-[7px] font-black tracking-[0.8px]" style={{ color: accent }}>
            WIN
          </span>
        </div>
        <div className="flex gap-[3px]">
          {SCOREBOARD_DIGITS.map((digit, index) => (
            <div
              className="flex items-center justify-center rounded-[3px] border bg-white/[0.06]"
              key={`${digit}-${index}`}
              style={{
                borderColor: `${accent}66`,
                height: dim.outer * 0.24,
                width: dim.outer * 0.18,
              }}>
              <span
                className="font-black leading-none tabular-nums"
                style={{ color: accent, fontSize: digitFontSize }}>
                {digit}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </WinCelebrationContainer>
  );
}

function StadiumCrowdPreview({ accent, size }: { accent: string; size: PreviewSize }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const rows = useMemo(
    () =>
      Array.from({ length: 9 }, (_, index) => ({
        bottom: 9 + (index % 3) * (dim.outer * 0.13),
        color: index % 4 === 0 ? THEME_COLORS.gold : accent,
        id: index,
        offbeat: index % 2 !== 0,
        size: dim.secondaryIcon + 5 + (index % 3),
        x: dim.outer * (0.12 + index * 0.095),
      })),
    [accent, dim.outer, dim.secondaryIcon],
  );

  return (
    <WinCelebrationContainer accent={accent} size={size}>
      <span
        className="absolute bottom-0 left-0 right-0 h-[36%] border-t"
        style={{ backgroundColor: 'rgba(10,14,26,0.82)', borderColor: `${accent}55` }}
      />
      {rows.map((member) => (
        <motion.span
          animate={
            member.offbeat
              ? { scale: [1.08, 0.96, 1.08], y: [-7, 0, -7] }
              : { scale: [0.96, 1.08, 0.96], y: [0, -7, 0] }
          }
          className="absolute"
          initial={{ scale: 1, y: 0 }}
          key={member.id}
          style={{ bottom: member.bottom, left: member.x }}
          transition={loopTransition(900)}>
          <CosmeticIcon color={member.color} name="people" size={member.size} />
        </motion.span>
      ))}
      <CosmeticIcon color={THEME_COLORS.gold} name="radio" size={dim.secondaryIcon + 7} />
    </WinCelebrationContainer>
  );
}

function FireworksPreview({ accent, size }: { accent: string; size: PreviewSize }) {
  const dim = PREVIEW_DIMENSIONS[size];
  const particleCount = 8;
  const radius = dim.outer * 0.32;
  const bursts = useMemo(
    () => [
      { delay: 0.09, id: 0, x: -dim.outer * 0.18, y: -dim.outer * 0.12 },
      { delay: 0.58, id: 1, x: dim.outer * 0.2, y: -dim.outer * 0.25 },
      { delay: 1.08, id: 2, x: dim.outer * 0.05, y: dim.outer * 0.11 },
    ],
    [dim.outer],
  );

  return (
    <WinCelebrationContainer accent={accent} size={size}>
      {[0.28, 0.5, 0.72].map((x, index) => (
        <span
          className="absolute bottom-0 w-[2px] rounded-full opacity-60"
          key={`trail-${index}`}
          style={{
            backgroundColor: accent,
            height: dim.outer * (0.28 + index * 0.04),
            left: dim.outer * x,
          }}
        />
      ))}
      {bursts.map((burst) => (
        <div
          className="absolute"
          key={burst.id}
          style={{ transform: `translate(${burst.x}px, ${burst.y}px)` }}>
          {Array.from({ length: particleCount }).map((_, particleIndex) => {
            const angle = (particleIndex / particleCount) * Math.PI * 2;
            return (
              <motion.span
                animate={{
                  opacity: [0, 1, 0.2, 0],
                  x: [0, Math.cos(angle) * radius, Math.cos(angle) * radius, 0],
                  y: [
                    0,
                    Math.sin(angle) * radius + dim.outer * 0.08,
                    Math.sin(angle) * radius + dim.outer * 0.08,
                    0,
                  ],
                }}
                className="absolute h-[5px] w-[5px] rounded-full"
                initial={{ opacity: 0, x: 0, y: 0 }}
                key={particleIndex}
                style={{
                  backgroundColor: particleIndex % 3 === 0 ? THEME_COLORS.gold : accent,
                }}
                transition={{
                  delay: burst.delay,
                  duration: 1.8,
                  ease: 'easeOut',
                  repeat: Infinity,
                  repeatDelay: 0.1,
                  times: [0, 0.45, 0.8, 1],
                }}
              />
            );
          })}
        </div>
      ))}
    </WinCelebrationContainer>
  );
}

function WinCelebrationPreview({
  accent,
  icon,
  size,
  styleKey,
}: {
  accent: string;
  icon: string;
  size: PreviewSize;
  styleKey: string;
}) {
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
      <CosmeticIcon color={accent} name={icon} size={dim.iconSize} />
    </WinCelebrationContainer>
  );
}

function ChatStickerPreviewArt({
  accent,
  icon,
  size,
}: {
  accent: string;
  icon: string;
  size: PreviewSize;
}) {
  const dim = PREVIEW_DIMENSIONS[size];

  return (
    <motion.div
      animate={{ rotate: [-6, 6, -6] }}
      className="flex items-center justify-center rounded-3xl border"
      initial={{ rotate: 0 }}
      style={squareStyle(dim.outer, {
        backgroundColor: `${accent}22`,
        borderColor: `${accent}77`,
      })}
      transition={loopTransition(900)}>
      <CosmeticIcon color={accent} name={icon} size={dim.iconSize} />
    </motion.div>
  );
}

function ProfileFramePreview({
  accent,
  icon,
  size,
}: {
  accent: string;
  icon: string;
  size: PreviewSize;
}) {
  const dim = PREVIEW_DIMENSIONS[size];

  return (
    <div className="relative" style={squareStyle(dim.outer)}>
      <motion.span
        animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.96, 1.04, 0.96] }}
        aria-hidden
        className="absolute inset-0 rounded-full"
        initial={{ opacity: 0.4, scale: 1 }}
        style={{ borderColor: accent, borderStyle: 'solid', borderWidth: 2 }}
        transition={loopTransition(1500)}
      />
      <div
        className="relative flex items-center justify-center rounded-3xl"
        style={squareStyle(dim.outer, {
          backgroundColor: `${accent}1a`,
          borderColor: `${accent}77`,
          borderStyle: 'solid',
          borderWidth: 2,
          boxShadow: `0 0 14px ${accent}80`,
        })}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
          <CosmeticIcon color="rgba(255,255,255,0.85)" name="person" size={20} />
        </span>
        <span
          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border"
          style={{ backgroundColor: accent, borderColor: '#0A0E1A' }}>
          <CosmeticIcon color="#0A0E1A" name={icon} size={dim.secondaryIcon} />
        </span>
      </div>
    </div>
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
  return (
    <div
      className="flex items-center justify-center rounded-3xl border"
      style={squareStyle(dim.outer, {
        backgroundColor: `${item.accent}1f`,
        borderColor: `${item.accent}66`,
        boxShadow: `0 0 12px ${item.accent}52`,
      })}>
      <CosmeticIcon color={item.accent} name={item.icon} size={dim.iconSize} />
    </div>
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
    <div
      className={cn('flex shrink-0 items-center justify-center border', dimensions)}
      style={{
        backgroundColor: `${item.accent}22`,
        borderColor: `${item.accent}77`,
      }}>
      <CosmeticIcon color={item.accent} name={item.icon} size={iconSize} />
    </div>
  );
}

export function defaultCosmeticsByCategory() {
  return ALL_COSMETIC_ITEMS.reduce<Partial<Record<CosmeticCategory, string>>>(
    (accumulator, item) => {
      if (!accumulator[item.category]) {
        accumulator[item.category] = item.id;
      }
      return accumulator;
    },
    {},
  );
}
