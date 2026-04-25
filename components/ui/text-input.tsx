import { useState } from 'react';
import { Text, TextInput as NativeTextInput, type TextInputProps, View } from 'react-native';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';

type AppTextInputProps = TextInputProps & {
  containerClassName?: string;
  error?: string;
  label: string;
};

export function TextInput({
  containerClassName,
  error,
  label,
  onBlur,
  onFocus,
  placeholderTextColor = 'rgba(255,255,255,0.32)',
  ...textInputProps
}: AppTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? THEME_COLORS.coralRed
    : isFocused
      ? THEME_COLORS.electricGreen
      : 'rgba(255,255,255,0.12)';
  const fieldStyle = {
    borderColor,
    shadowColor: error ? THEME_COLORS.coralRed : THEME_COLORS.electricGreen,
    shadowOffset: { width: 0, height: 0 } as const,
    shadowOpacity: error ? 0.35 : isFocused ? 0.45 : 0,
    shadowRadius: 12,
  };

  return (
    <View className={cn('gap-2', containerClassName)}>
      <Text
        className={cn(
          'text-xs font-black uppercase',
          isFocused && !error ? 'text-electric-green' : 'text-white/65',
          error ? 'text-coral-red' : null,
        )}
        style={{ letterSpacing: 1.5 }}>
        {label}
      </Text>

      <View className="min-h-14 rounded-2xl border bg-white/[0.04]" style={fieldStyle}>
        <NativeTextInput
          className="min-h-14 px-4 text-base font-semibold text-white"
          placeholderTextColor={placeholderTextColor}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          selectionColor={THEME_COLORS.electricGreen}
          {...textInputProps}
        />
      </View>

      {error ? (
        <Text className="text-xs font-semibold text-coral-red">{error}</Text>
      ) : null}
    </View>
  );
}
