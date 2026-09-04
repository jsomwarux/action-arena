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

/** Port of components/ui/text-input.tsx. Same prop names, web semantics. */
export function TextInput({
  className,
  containerClassName,
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

      <div
        className={cn(
          'flex min-h-14 items-center rounded-2xl border bg-white/[0.04] transition duration-150 ease-arena',
          error
            ? 'border-coral-red shadow-[0_0_12px_rgba(255,71,87,0.35)]'
            : isFocused
              ? 'border-electric-green shadow-[0_0_12px_rgba(0,255,135,0.45)]'
              : 'border-border',
        )}>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            'min-h-14 w-full min-w-0 flex-1 bg-transparent px-4 text-base font-semibold text-white',
            'placeholder:text-white/30 focus:outline-none focus-visible:ring-0',
            showPasswordToggle && 'pr-2',
            className,
          )}
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
            className="px-3.5 py-3 text-white/55 transition hover:text-white"
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            type="button">
            {isPasswordVisible ? (
              <EyeOff className="h-5 w-5 text-electric-green" />
            ) : (
              <Eye className="h-5 w-5" />
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
