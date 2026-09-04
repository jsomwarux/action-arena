import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

export type SegmentedAccent = 'green' | 'amber' | 'cyan' | 'gold' | 'red' | 'white';

export type SegmentedOption<V extends string | number> = {
  accent?: SegmentedAccent;
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  value: V;
};

// Bet-type color language from AGENTS.md: straights green, parlays amber,
// teasers cyan. Kept identical to components/ui/segmented-toggle.tsx.
const ACCENT_BG: Record<SegmentedAccent, string> = {
  amber: 'bg-amber-accent',
  cyan: 'bg-cyan-accent',
  gold: 'bg-gold',
  green: 'bg-electric-green',
  red: 'bg-coral-red',
  white: 'bg-textPrimary',
};

// Bright accents read best on near-black text; coral red needs white.
const ON_ACCENT_TEXT: Record<SegmentedAccent, string> = {
  amber: 'text-black',
  cyan: 'text-black',
  gold: 'text-black',
  green: 'text-black',
  red: 'text-white',
  white: 'text-black',
};

export type SegmentedToggleProps<V extends string | number> = {
  accent?: SegmentedAccent;
  compact?: boolean;
  onChange: (value: V) => void;
  options: SegmentedOption<V>[];
  value: V;
};

/** Port of components/ui/segmented-toggle.tsx. Same prop names. */
export function SegmentedToggle<V extends string | number>({
  accent = 'green',
  compact = false,
  onChange,
  options,
  value,
}: SegmentedToggleProps<V>) {
  return (
    <div
      className="flex w-full self-stretch rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1"
      role="tablist">
      {options.map((option) => {
        const isActive = option.value === value;
        const optionAccent = option.accent ?? accent;
        const Icon = option.icon;

        return (
          <button
            aria-selected={isActive}
            className={cn(
              'flex min-w-0 flex-1 basis-0 items-center justify-center rounded-xl',
              'transition duration-150 ease-arena',
              compact ? 'min-h-9 gap-1 px-1 py-2' : 'min-h-12 gap-1.5 px-2 py-2.5',
              isActive
                ? cn(ACCENT_BG[optionAccent], ON_ACCENT_TEXT[optionAccent], 'font-black')
                : 'font-normal text-white/60 hover:text-white/85',
              option.disabled && 'pointer-events-none opacity-35',
            )}
            disabled={option.disabled}
            key={String(option.value)}
            onClick={() => onChange(option.value)}
            role="tab"
            type="button">
            {Icon ? (
              <Icon aria-hidden className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            ) : null}
            <span
              className={cn(
                'min-w-0 truncate uppercase',
                compact ? 'text-[10px] tracking-[0.09em]' : 'text-[11px] tracking-[0.11em]',
              )}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
