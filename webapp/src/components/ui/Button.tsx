import type { ButtonHTMLAttributes } from 'react';

import { Loader2, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  fullWidth?: boolean;
  /** Lucide icon component — the web stand-in for the mobile Ionicons name. */
  icon?: LucideIcon;
  loading?: boolean;
  title: string;
  variant?: ButtonVariant;
};

const containerClasses: Record<ButtonVariant, string> = {
  primary: 'border-electric-green bg-electric-green hover:brightness-110',
  secondary: 'border-white/15 bg-white/5 hover:bg-white/10',
  destructive: 'border-coral-red bg-coral-red hover:brightness-110',
};

const textClasses: Record<ButtonVariant, string> = {
  primary: 'text-arena-bg',
  secondary: 'text-white',
  destructive: 'text-white',
};

// Web equivalent of the mobile Pressable glow (shadowColor/shadowRadius).
const glowClasses: Record<ButtonVariant, string> = {
  primary: 'shadow-[0_6px_18px_rgba(0,255,135,0.45)]',
  secondary: 'shadow-[0_4px_12px_rgba(0,0,0,0.25)]',
  destructive: 'shadow-[0_6px_18px_rgba(255,71,87,0.40)]',
};

/** Port of components/ui/button.tsx. Same prop names, web semantics. */
export function Button({
  className,
  disabled,
  fullWidth = true,
  icon: Icon,
  loading = false,
  title,
  type = 'button',
  variant = 'primary',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={cn(
        'inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-5 py-3',
        'text-base font-black uppercase leading-5 tracking-[0.09em]',
        'transition duration-150 ease-arena active:scale-[0.96]',
        'disabled:pointer-events-none disabled:opacity-50',
        containerClasses[variant],
        glowClasses[variant],
        textClasses[variant],
        // In a column flex parent, `inline-flex` still stretches to the cross
        // axis; `w-fit` makes fullWidth={false} mean what it says.
        fullWidth ? 'w-full' : 'w-fit',
        className,
      )}
      disabled={isDisabled}
      type={type}
      {...rest}>
      {loading ? (
        <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
      ) : (
        <>
          {Icon ? <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" /> : null}
          <span className="min-w-0 truncate">{title}</span>
        </>
      )}
    </button>
  );
}
