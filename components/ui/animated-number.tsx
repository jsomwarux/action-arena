import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, type TextProps } from 'react-native';

type AnimatedNumberProps = Omit<TextProps, 'children'> & {
  decimals?: number;
  duration?: number;
  formatter?: (value: number) => string;
  prefix?: string;
  suffix?: string;
  value: number;
};

const defaultFormatter = (value: number, decimals: number) => value.toFixed(decimals);

// Tweens a numeric value to its target using RN's core Animated.Value driven on
// the JS thread (text content can't be driven natively). No Reanimated worklets.
export function AnimatedNumber({
  decimals = 0,
  duration = 360,
  formatter,
  prefix = '',
  suffix = '',
  value,
  ...textProps
}: AnimatedNumberProps) {
  const animatedValue = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: next }) => {
      setDisplay(next);
    });
    return () => animatedValue.removeListener(listenerId);
  }, [animatedValue]);

  useEffect(() => {
    Animated.timing(animatedValue, {
      duration,
      easing: Easing.out(Easing.cubic),
      toValue: value,
      useNativeDriver: false,
    }).start();
  }, [animatedValue, duration, value]);

  const formatted = formatter ? formatter(display) : defaultFormatter(display, decimals);

  return (
    <Text {...textProps}>
      {prefix}
      {formatted}
      {suffix}
    </Text>
  );
}
