import type { PropsWithChildren } from 'react';

import { cn } from '@/lib/cn';

/**
 * Port of components/ui/staggered-item.tsx.
 *
 * Deliberately a CSS animation on an element whose resting state is already
 * visible: if it never runs, the row is simply there.
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
