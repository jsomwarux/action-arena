import { useId, useState, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type FieldTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  className?: string;
  containerClassName?: string;
  /** Visually hidden when `hideLabel` is set, but always present for a11y. */
  hideLabel?: boolean;
  label: string;
};

/**
 * The multi-line sibling of components/ui/TextInput.
 *
 * The chat composer and the moderation report both take free text that runs to
 * more than one line, which the single-line TextInput primitive cannot carry.
 * The structure here is copied from it deliberately: one bordered wrapper owns
 * the border, the fill and the focus glow, and the <textarea> inside draws
 * nothing of its own.
 *
 * `arena-field-input` is load-bearing, not decoration. The global
 * :focus-visible rule in src/index.css matches `textarea`, and without that
 * class it paints a 2px offset ring *inside* the wrapper — the inner box the
 * field structure exists to avoid.
 */
export function FieldTextarea({
  className,
  containerClassName,
  disabled,
  hideLabel = false,
  id,
  label,
  onBlur,
  onFocus,
  ...textareaProps
}: FieldTextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={cn('flex flex-col gap-2', containerClassName)}>
      <label
        className={cn(
          'text-xs font-black uppercase tracking-[0.12em]',
          hideLabel && 'sr-only',
          isFocused ? 'text-electric-green' : 'text-white/65',
        )}
        htmlFor={textareaId}>
        {label}
      </label>

      <div
        className={cn(
          'flex rounded-2xl border bg-white/[0.04] transition duration-150 ease-arena',
          isFocused
            ? 'border-electric-green shadow-[0_0_12px_rgba(0,255,135,0.45)]'
            : 'border-border',
          disabled && 'opacity-60',
        )}>
        <textarea
          className={cn(
            'arena-field-input w-full min-w-0 flex-1 resize-none bg-transparent px-4 py-3',
            'text-sm font-semibold text-white placeholder:text-white/30',
            'appearance-none border-0 shadow-none outline-none',
            'caret-electric-green',
            'ring-0 ring-offset-0',
            'focus:border-0 focus:bg-transparent focus:shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0',
            'focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed',
            className,
          )}
          disabled={disabled}
          id={textareaId}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          {...textareaProps}
        />
      </div>
    </div>
  );
}
