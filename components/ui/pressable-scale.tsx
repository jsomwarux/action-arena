import type { PropsWithChildren } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type PressableScaleProps = PropsWithChildren<
  PressableProps & {
    pressedScale?: number;
    style?: StyleProp<ViewStyle>;
  }
>;

// Static press feedback — uses Pressable's built-in `pressed` state to drive a
// subtle scale + opacity change without Reanimated worklets, which keeps things
// crash-safe across screens with many press targets.
export function PressableScale({
  children,
  pressedScale = 0.97,
  style,
  ...rest
}: PressableScaleProps) {
  return (
    <Pressable
      {...rest}
      style={(state) => [
        {
          opacity: state.pressed ? 0.92 : 1,
          transform: [{ scale: state.pressed ? pressedScale : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}>
      {children}
    </Pressable>
  );
}
