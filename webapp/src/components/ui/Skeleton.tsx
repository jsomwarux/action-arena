import { cn } from '@/lib/cn';

export type SkeletonProps = {
  className?: string;
  /** CSS height. Numbers are treated as pixels, matching the mobile prop. */
  height?: number | string;
  /** Border radius in pixels. */
  radius?: number;
  width?: number | string;
};

function toLength(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * Port of components/ui/skeleton-loader.tsx.
 *
 * The mobile version drives a translating shimmer with Animated.loop; here the
 * same effect is a CSS-animated gradient sweep, so it costs nothing on the main
 * thread and it honours prefers-reduced-motion via the guard in index.css.
 */
export function Skeleton({ className, height = 18, radius = 8, width = '100%' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('relative overflow-hidden bg-white/[0.07]', className)}
      style={{ borderRadius: radius, height: toLength(height), width: toLength(width) }}>
      <div className="absolute inset-0 animate-arena-shimmer bg-gradient-to-r from-transparent via-electric-green/[0.12] to-transparent" />
    </div>
  );
}
