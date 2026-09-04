import type { LucideIcon } from 'lucide-react';

import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

export type ToggleRowProps = {
  description?: string;
  disabled?: boolean;
  enabled: boolean;
  icon?: LucideIcon;
  onToggle: () => void;
  title: string;
};

/**
 * Port of components/ui/toggle-row.tsx.
 *
 * Mobile builds the switch by hand out of two Views so it can carry the
 * electric-green glow; the same two boxes are reproduced here rather than
 * reaching for a native <input type="checkbox">, which would lose the accent.
 * The row itself is the control — `role="switch"` on the button, with
 * `aria-checked` doing the job of mobile's accessibilityState.
 */
export function ToggleRow({
  description,
  disabled = false,
  enabled,
  icon: Icon,
  onToggle,
  title,
}: ToggleRowProps) {
  return (
    <button
      aria-checked={enabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4 text-left',
        'transition duration-150 ease-arena',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/[0.06]',
      )}
      disabled={disabled}
      onClick={() => {
        haptics.light();
        onToggle();
      }}
      role="switch"
      type="button">
      {Icon ? (
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-white/[0.04]',
            enabled
              ? 'border-electric-green/45 text-electric-green shadow-[0_0_8px_rgba(0,255,135,0.40)]'
              : 'border-white/10 text-white/55',
          )}>
          <Icon aria-hidden className="h-[18px] w-[18px]" />
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block text-base font-black tracking-[-0.01em] text-white">{title}</span>
        {description ? (
          <span className="mt-1 block text-xs font-semibold leading-5 text-white/50">
            {description}
          </span>
        ) : null}
      </span>

      <span
        className={cn(
          'flex h-8 w-14 shrink-0 items-center rounded-full border px-1',
          'transition duration-150 ease-arena',
          enabled
            ? 'justify-end border-electric-green/45 bg-electric-green/20 shadow-[0_0_8px_rgba(0,255,135,0.45)]'
            : 'justify-start border-white/15 bg-white/[0.05]',
        )}>
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full',
            enabled ? 'bg-electric-green' : 'bg-white/45',
          )}>
          {enabled ? <Check aria-hidden className="h-3.5 w-3.5 text-arena-bg" /> : null}
        </span>
      </span>
    </button>
  );
}
