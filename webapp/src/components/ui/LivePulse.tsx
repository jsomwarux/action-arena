import type { PropsWithChildren } from 'react';

import { motion } from 'framer-motion';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';

/**
 * Port of components/ui/live-pulse.tsx.
 *
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
