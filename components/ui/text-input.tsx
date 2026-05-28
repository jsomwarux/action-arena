import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput as NativeTextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';

type AppTextInputProps = TextInputProps & {
  containerClassName?: string;
  error?: string;
  label: string;
  showPasswordToggle?: boolean;
};

export function TextInput({
  containerClassName,
  error,
  label,
  onBlur,
  onFocus,
  placeholderTextColor = 'rgba(255,255,255,0.32)',
  secureTextEntry,
  showPasswordToggle,
  ...textInputProps
}: AppTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

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

  const effectiveSecureTextEntry = showPasswordToggle ? !isPasswordVisible : secureTextEntry;

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

      <View
        className="min-h-14 flex-row items-center rounded-2xl border bg-white/[0.04]"
        style={fieldStyle}>
        <NativeTextInput
          className={cn(
            'min-h-14 flex-1 px-4 text-base font-semibold text-white',
            showPasswordToggle ? 'pr-2' : null,
          )}
          placeholderTextColor={placeholderTextColor}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          secureTextEntry={effectiveSecureTextEntry}
          selectionColor={THEME_COLORS.electricGreen}
          {...textInputProps}
        />
        {showPasswordToggle ? (
          <Pressable
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.55 : 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
            })}>
            <Ionicons
              color={isPasswordVisible ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.55)'}
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={20}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text className="text-xs font-semibold text-coral-red">{error}</Text>
      ) : null}
    </View>
  );
}
