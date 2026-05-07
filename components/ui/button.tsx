import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  Text,
  type ViewStyle,
} from 'react-native';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

type ButtonProps = PressableProps & {
  fullWidth?: boolean;
  loading?: boolean;
  title: string;
  variant?: ButtonVariant;
};

const containerClasses: Record<ButtonVariant, string> = {
  primary: 'border-electric-green bg-electric-green',
  secondary: 'border-white/15 bg-white/5',
  destructive: 'border-coral-red bg-coral-red',
};

const textClasses: Record<ButtonVariant, string> = {
  primary: 'text-arena-bg',
  secondary: 'text-white',
  destructive: 'text-white',
};

const glowStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    shadowColor: THEME_COLORS.electricGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  secondary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  destructive: {
    shadowColor: THEME_COLORS.coralRed,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
  },
};

export function Button({
  disabled,
  fullWidth = true,
  loading = false,
  title,
  variant = 'primary',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        'min-h-14 items-center justify-center rounded-2xl border px-5 py-3',
        containerClasses[variant],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
      )}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        glowStyles[variant],
        {
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? THEME_COLORS.background : THEME_COLORS.textPrimary}
        />
      ) : (
        <Text
          adjustsFontSizeToFit
          className={cn('text-base font-black uppercase', textClasses[variant])}
          minimumFontScale={0.78}
          numberOfLines={1}
          style={{ letterSpacing: 1.5 }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
