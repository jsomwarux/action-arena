import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';
import { getNflTeamPrimaryColor, resolveNflTeamData } from '@/lib/nfl-teams';
import type { BetType } from '@/types/database';

/**
 * Web ports of the mobile `components/ui` primitives this screen pair needs.
 *
 * They live here rather than in components/ui because that directory is shared
 * scaffolding other surfaces are being built against in parallel. Names and
 * props match mobile so they can be promoted later without touching call sites.
 */

export type BadgeTone = 'green' | 'red' | 'amber' | 'cyan' | 'gold';

const containerByTone: Record<BadgeTone, string> = {
  amber: 'border-amber-accent/40 bg-amber-accent/15',
  cyan: 'border-cyan-accent/40 bg-cyan-accent/15',
  gold: 'border-gold/40 bg-gold/15',
  green: 'border-electric-green/40 bg-electric-green/15',
  red: 'border-coral-red/40 bg-coral-red/15',
};

const textByTone: Record<BadgeTone, string> = {
  amber: 'text-amber-accent',
  cyan: 'text-cyan-accent',
  gold: 'text-gold',
  green: 'text-electric-green',
  red: 'text-coral-red',
};

const toneByBetType: Record<BetType, BadgeTone> = {
  parlay: 'amber',
  straight: 'green',
  teaser: 'cyan',
};

const defaultBetTypeLabels: Record<BetType, string> = {
  parlay: 'Parlay',
  straight: 'Straight',
  teaser: 'Teaser',
};

export function Badge({
  betType,
  label,
  tone,
}: {
  betType?: BetType;
  label?: string;
  tone?: BadgeTone;
}) {
  const resolvedTone: BadgeTone = tone ?? (betType ? toneByBetType[betType] : 'green');
  const resolvedLabel = label ?? (betType ? defaultBetTypeLabels[betType] : '');

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-3 py-1',
        'text-[10px] font-black uppercase tracking-[1.5px]',
        containerByTone[resolvedTone],
        textByTone[resolvedTone],
      )}>
      {resolvedLabel}
    </span>
  );
}

export function NflTeamLogo({ size = 28, teamName }: { size?: number; teamName: string }) {
  const team = useMemo(() => resolveNflTeamData(teamName), [teamName]);
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackColor = team?.primaryColor ?? getNflTeamPrimaryColor(teamName);
  const fallbackInitial = (team?.shortName ?? teamName ?? '?').charAt(0).toUpperCase();

  useEffect(() => {
    setImageFailed(false);
  }, [team?.logoUrl]);

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.18]"
      style={{ backgroundColor: fallbackColor, height: size, width: size }}>
      {team?.logoUrl && !imageFailed ? (
        <img
          alt=""
          className="object-contain"
          height={Math.round(size * 0.84)}
          onError={() => setImageFailed(true)}
          src={team.logoUrl}
          width={Math.round(size * 0.84)}
        />
      ) : (
        <span
          className="font-black text-white"
          style={{ fontSize: Math.max(9, Math.round(size * 0.43)) }}>
          {fallbackInitial}
        </span>
      )}
    </span>
  );
}

export function WeekNavigator({
  maxWeek = 14,
  onChange,
  week,
}: {
  maxWeek?: number;
  onChange: (week: number) => void;
  week: number;
}) {
  const canGoPrevious = week > 1;
  const canGoNext = week < maxWeek;
  const stepClasses =
    'flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05] text-textPrimary transition duration-150 ease-arena hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-35';

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        aria-label="Previous week"
        className={stepClasses}
        disabled={!canGoPrevious}
        onClick={() => onChange(Math.max(1, week - 1))}
        type="button">
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </button>

      <span className="flex items-center gap-1.5 rounded-full border border-electric-green/30 bg-electric-green/10 px-4 py-2">
        <Calendar aria-hidden className="h-3 w-3 text-electric-green" />
        <span className="text-[10px] font-black uppercase tracking-[1.5px] text-electric-green">
          Week {week} of {maxWeek}
        </span>
      </span>

      <button
        aria-label="Next week"
        className={stepClasses}
        disabled={!canGoNext}
        onClick={() => onChange(Math.min(maxWeek, week + 1))}
        type="button">
        <ChevronRight aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Tweens to a new value on the JS side, exactly like the mobile
 * `AnimatedNumber`. The resting render is the real value, so a starved
 * animation frame costs the motion, never the number.
 */
export function AnimatedNumber({
  className,
  decimals = 0,
  duration = 360,
  formatter,
  prefix = '',
  style,
  suffix = '',
  value,
}: {
  className?: string;
  decimals?: number;
  duration?: number;
  formatter?: (value: number) => string;
  prefix?: string;
  style?: React.CSSProperties;
  suffix?: string;
  value: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;

    if (from === value) {
      return undefined;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const linear = Math.min(1, (now - start) / duration);
      // Easing.out(Easing.cubic), the mobile curve.
      const eased = 1 - (1 - linear) ** 3;
      const next = from + (value - from) * eased;
      setDisplay(next);
      fromRef.current = next;

      if (linear < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        setDisplay(value);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  const formatted = formatter ? formatter(display) : display.toFixed(decimals);

  return (
    <span className={className} style={style}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Soft breathing glow behind the children. The children stay fully opaque, so
 * a card wrapped in this reads identically with motion disabled.
 */
export function LivePulse({
  children,
  className,
  color = THEME_COLORS.gold,
  intensity = 0.7,
}: PropsWithChildren<{ className?: string; color?: string; intensity?: number }>) {
  const clamped = Math.max(Math.min(intensity, 1), 0);
  const peak = 0.05 + clamped * 0.18;

  return (
    <div className={cn('relative', className)}>
      <motion.span
        animate={{ opacity: [0.05, peak, 0.05] }}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[18px]"
        initial={{ opacity: 0.05 }}
        style={{ backgroundColor: color, boxShadow: `0 0 14px ${color}80` }}
        transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * Staggered entrance. Deliberately a CSS animation on an element whose resting
 * state is already visible: if it never runs, the row is simply there.
 */
export function StaggeredItem({
  children,
  className,
  index,
  perItemDelay = 60,
}: PropsWithChildren<{ className?: string; index: number; perItemDelay?: number }>) {
  return (
    <div
      className={cn('arena-enter', className)}
      style={{
        // `backwards` holds the keyframe's starting opacity during the delay so
        // the row doesn't flash in and then restart. The delay is capped hard
        // because that hold is the one moment the row isn't painted.
        animationDelay: `${Math.min(index, 6) * perItemDelay}ms`,
        animationFillMode: 'backwards',
      }}>
      {children}
    </div>
  );
}

function formatRelativeSeconds(seconds: number) {
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/**
 * The quiet game-day status line: whether anything is live, when the data last
 * came back, and a manual refresh. Deliberately understated — this screen is
 * meant to be left open on a second monitor.
 */
export function LiveRefreshBadge({
  isLive,
  isRefreshing,
  lastRefreshedAt,
  onRefresh,
}: {
  isLive: boolean;
  isRefreshing: boolean;
  lastRefreshedAt: number;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const seconds = Math.max(0, Math.floor((now - lastRefreshedAt) / 1000));

  return (
    <div className="flex items-center gap-2">
      {isLive ? (
        <span className="flex items-center gap-1.5 rounded-full border border-coral-red/40 bg-coral-red/10 px-2.5 py-1">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            initial={{ opacity: 1 }}
            style={{ backgroundColor: THEME_COLORS.coralRed }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          />
          <span className="text-[10px] font-black uppercase tracking-[1.4px] text-coral-red">
            Live
          </span>
        </span>
      ) : null}
      <button
        aria-label="Refresh"
        className="flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[1.2px] text-white/50 transition hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-50"
        disabled={isRefreshing}
        onClick={onRefresh}
        type="button">
        <RefreshCw aria-hidden className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
        {isRefreshing ? 'Updating' : `Updated ${formatRelativeSeconds(seconds)}`}
      </button>
    </div>
  );
}
