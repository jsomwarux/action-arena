import type { HTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '@/lib/cn';

export type CardTone = 'default' | 'highlight';

export type CardProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    padded?: boolean;
    tone?: CardTone;
  }
>;

/**
 * Port of components/ui/card.tsx.
 *
 * Glassmorphism per AGENTS.md: slight blur backdrop, 1px semi-transparent
 * border, rounded corners. `backdrop-blur-xl` stands in for the native
 * BlurView intensity.
 */
export function Card({ children, className, padded = true, tone = 'default', ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border shadow-[0_8px_28px_rgba(0,0,0,0.30)] backdrop-blur-xl',
        tone === 'highlight'
          ? 'border-electric-green/25 bg-electric-green/[0.06]'
          : 'border-white/10 bg-white/[0.04]',
        padded && 'p-4',
        className,
      )}
      {...rest}>
      {children}
    </div>
  );
}
