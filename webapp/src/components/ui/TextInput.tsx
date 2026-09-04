import { useId, useState, type InputHTMLAttributes } from 'react';

import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/cn';

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  containerClassName?: string;
  error?: string;
  label: string;
  showPasswordToggle?: boolean;
  /** Native input type. Ignored when `showPasswordToggle` is set. */
  type?: InputHTMLAttributes<HTMLInputElement>['type'];
};

/**
 * Port of components/ui/text-input.tsx. Same prop names, web semantics.
 *
 * Structure matches mobile exactly: ONE bordered wrapper owns the border, the
 * background and the focus glow, and everything inside it draws nothing of its
 * own. React Native gives that for free — a web <input> and <button> do not, so
 * both are stripped back explicitly below. Without that a password field reads
 * as three nested boxes: the UA input chrome inside the green wrapper, with the
 * toggle's button chrome beside it.
 *
 * Autofill is the same bug wearing a disguise: Chrome repaints an autofilled
 * input's background from the UA origin, which no author-side `background-color`
 * can override. See `.arena-field-input` in src/index.css for the one lever that
 * does work.
 */
export function TextInput({
  className,
  containerClassName,
  disabled,
  error,
  id,
  label,
  onBlur,
  onFocus,
  showPasswordToggle,
  type = 'text',
  ...inputProps
}: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const effectiveType = showPasswordToggle ? (isPasswordVisible ? 'text' : 'password') : type;

  return (
    <div className={cn('flex flex-col gap-2', containerClassName)}>
      <label
        className={cn(
          'text-xs font-black uppercase tracking-[0.12em]',
          isFocused && !error ? 'text-electric-green' : 'text-white/65',
          error && 'text-coral-red',
        )}
        htmlFor={inputId}>
        {label}
      </label>

      {/* The only element that draws anything. */}
      <div
        className={cn(
          'flex min-h-14 items-center rounded-2xl bg-white/[0.04] transition duration-150 ease-arena',
          'border',
          error
            ? 'border-coral-red shadow-[0_0_12px_rgba(255,71,87,0.35)]'
            : isFocused
              ? 'border-electric-green shadow-[0_0_12px_rgba(0,255,135,0.45)]'
              : 'border-border',
          disabled && 'opacity-60',
        )}>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            // Layout only.
            'arena-field-input min-h-14 w-full min-w-0 flex-1 px-4',
            'text-base font-semibold text-white placeholder:text-white/30',
            // Every surface the UA would otherwise paint, in every state.
            'appearance-none border-0 bg-transparent shadow-none outline-none',
            'caret-electric-green',
            // ring-0 alone is not enough: Tailwind's ring width resolves to
            // `0 + var(--tw-ring-offset-width)`, so without ring-offset-0 the
            // global :focus-visible rule below still paints a 2px ring inside
            // the wrapper — the inner box this component exists to avoid.
            'ring-0 ring-offset-0',
            'focus:border-0 focus:bg-transparent focus:shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0',
            'focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed',
            showPasswordToggle && 'pr-2',
            className,
          )}
          disabled={disabled}
          id={inputId}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          type={effectiveType}
          {...inputProps}
        />

        {showPasswordToggle ? (
          <button
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            className={cn(
              'shrink-0 appearance-none rounded-xl border-0 bg-transparent px-3.5 py-3 shadow-none outline-none',
              'text-white/55 transition hover:text-white',
              // The wrapper is the field's focus indicator, so the toggle keeps
              // only a tight inline ring for keyboard users — no offset ring,
              // which would draw a second box inside the field.
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric-green focus-visible:ring-offset-0',
              'disabled:cursor-not-allowed',
            )}
            disabled={disabled}
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            type="button">
            {isPasswordVisible ? (
              <EyeOff aria-hidden className="h-5 w-5 text-electric-green" />
            ) : (
              <Eye aria-hidden className="h-5 w-5" />
            )}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs font-semibold text-coral-red" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
