import type { PropsWithChildren } from 'react';

import { cn } from '@/lib/cn';

export type NoticeTone = 'error' | 'success';

export type NoticeProps = PropsWithChildren<{
  className?: string;
  tone: NoticeTone;
}>;

const toneClasses: Record<NoticeTone, string> = {
  error: 'border-coral-red/40 bg-coral-red/10 text-coral-red',
  success: 'border-electric-green/40 bg-electric-green/10 text-electric-green',
};

/**
 * The inline message strip the mobile auth screens build by hand out of a
 * bordered View plus a coloured Text. Same two tones, one component.
 */
export function Notice({ children, className, tone }: NoticeProps) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 text-sm font-semibold',
        toneClasses[tone],
        className,
      )}
      role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
