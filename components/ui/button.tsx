import type { ComponentProps } from 'react';

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

type ButtonProps = PressableProps & {
  fullWidth?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
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
  icon,
  iconColor,
  loading = false,
  title,
  variant = 'primary',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const contentColor =
    iconColor ?? (variant === 'primary' ? THEME_COLORS.background : THEME_COLORS.textPrimary);

  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        'min-h-14 items-center justify-center rounded-2xl border px-5 py-3',
        containerClasses[variant],
        fullWidth && 'w-full',
      )}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        glowStyles[variant],
        {
          opacity: isDisabled ? 0.5 : pressed ? 0.92 : 1,
          transform: [{ scale: isDisabled ? 1 : pressed ? 0.96 : 1 }],
        },
      ]}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? THEME_COLORS.background : THEME_COLORS.textPrimary}
        />
      ) : (
        <View className="flex-row items-center justify-center gap-2" style={styles.content}>
          {icon ? <Ionicons color={contentColor} name={icon} size={18} /> : null}
          <Text
            className={cn('font-black uppercase', textClasses[variant])}
            numberOfLines={1}
            style={styles.label}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: '100%',
    width: '100%',
  },
  label: {
    flexShrink: 1,
    fontSize: 16,
    letterSpacing: 1.5,
    lineHeight: 20,
    minWidth: 0,
    textAlign: 'center',
  },
});
