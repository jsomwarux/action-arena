/**
 * The small pieces the Pick Board repeats everywhere: over/under direction
 * chips, pills, the budget meter and the summary tiles.
 *
 * These are board-local on purpose. src/components/ui holds the primitives
 * every route shares — crest, badge, counter; nothing outside the board needs a
 * budget meter, so it lives here rather than widening the shared surface.
 *
 * Motion rule for this whole folder: an element's resting state is its visible
 * state. Entrances move transforms, never opacity, and every framer-motion
 * value starts at its final value (`initial={false}`), so a starved rAF — a
 * backgrounded tab, reduced motion, JS animations off — leaves content present
 * rather than stuck at zero opacity.
 */

import type { PropsWithChildren, ReactNode } from 'react';

import { ArrowDown, ArrowUp, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

import { type BetTone } from './pick-board-model';

/** Spring used for every interactive nudge on the board. */
export const ARENA_SPRING = { damping: 26, mass: 0.7, stiffness: 320, type: 'spring' } as const;

// ============================================================
// Direction chip
// ============================================================

/** Over/Under gets an arrow chip where a team gets a crest. */
export function TotalDirectionChip({ isOver, size = 28 }: { isOver: boolean; size?: number }) {
  const Icon = isOver ? ArrowUp : ArrowDown;

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/90"
      style={{ height: size, width: size }}>
      <Icon style={{ height: size * 0.5, width: size * 0.5 }} />
    </span>
  );
}

// ============================================================
// Pills
// ============================================================

export type PillTone = BetTone | 'gold' | 'red' | 'muted';

const PILL_CLASS: Record<PillTone, string> = {
  amber: 'border-amber-accent/45 bg-amber-accent/15 text-amber-accent',
  cyan: 'border-cyan-accent/45 bg-cyan-accent/15 text-cyan-accent',
  gold: 'border-gold/50 bg-gold/15 text-gold',
  green: 'border-electric-green/50 bg-electric-green/15 text-electric-green',
  muted: 'border-white/15 bg-white/[0.06] text-white/60',
  red: 'border-coral-red/50 bg-coral-red/15 text-coral-red',
};

export function Pill({
  children,
  className,
  icon: Icon,
  tone = 'muted',
}: PropsWithChildren<{ className?: string; icon?: LucideIcon; tone?: PillTone }>) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1',
        'arena-label',
        PILL_CLASS[tone],
        className,
      )}>
      {Icon ? <Icon aria-hidden className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

// ============================================================
// Meters
// ============================================================

/**
 * The budget bar.
 *
 * A CSS width transition rather than a JS-driven one, for the same reason the
 * counter above renders its real value: the element's resting style is already
 * the correct width, so a transition that never runs leaves a correct bar rather
 * than a bar stuck at the previous fill.
 */
export function MeterBar({
  color,
  height = 12,
  progress,
}: {
  color: string;
  height?: number;
  progress: number;
}) {
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <div className="w-full overflow-hidden rounded-full bg-white/[0.08]" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width,background-color] duration-500 ease-arena"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}80`,
          width: `${clamped * 100}%`,
        }}
      />
    </div>
  );
}

// ============================================================
// Metric tiles
// ============================================================

export type MetricTone = 'muted' | 'green' | 'red' | 'gold';

export type Metric = {
  label: string;
  tone?: MetricTone;
  value: ReactNode;
};

const METRIC_VALUE_CLASS: Record<MetricTone, string> = {
  gold: 'text-gold',
  green: 'text-electric-green',
  muted: 'text-white/75',
  red: 'text-coral-red',
};

/** Port of components/picks/pick-summary-metrics.tsx. */
export function MetricGrid({
  metrics,
  showTopBorder = true,
}: {
  metrics: Metric[];
  showTopBorder?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2',
        showTopBorder && 'border-t border-white/[0.08] pt-3',
      )}>
      {metrics.map((metric) => (
        <div
          className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2"
          key={metric.label}>
          <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
            {metric.label}
          </p>
          <p
            className={cn(
              'mt-0.5 truncate text-sm font-black',
              METRIC_VALUE_CLASS[metric.tone ?? 'muted'],
            )}>
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Section shell
// ============================================================

export function EmptyState({
  children,
  icon: Icon,
  title,
  tone = 'green',
}: PropsWithChildren<{ icon: LucideIcon; title: string; tone?: BetTone | 'muted' }>) {
  const iconClass =
    tone === 'amber'
      ? 'border-amber-accent/30 bg-amber-accent/10 text-amber-accent'
      : tone === 'cyan'
        ? 'border-cyan-accent/30 bg-cyan-accent/10 text-cyan-accent'
        : tone === 'muted'
          ? 'border-white/12 bg-white/[0.05] text-white/50'
          : 'border-electric-green/30 bg-electric-green/10 text-electric-green';

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <span
        className={cn('flex h-14 w-14 items-center justify-center rounded-2xl border', iconClass)}>
        <Icon aria-hidden className="h-6 w-6" />
      </span>
      <h3 className="arena-heading text-2xl leading-none">{title}</h3>
      <div className="max-w-md text-sm font-semibold leading-5 text-white/55">{children}</div>
    </div>
  );
}
