import type { PropsWithChildren } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { THEME_COLORS } from '@/constants/theme';

type ModalShellVariant = 'fullscreen' | 'overlay';

type ModalShellProps = PropsWithChildren<{
  edges?: ReadonlyArray<Edge>;
  style?: StyleProp<ViewStyle>;
  variant?: ModalShellVariant;
}>;

const DEFAULT_EDGES: ReadonlyArray<Edge> = ['top', 'bottom', 'left', 'right'];

// react-native-safe-area-context's SafeAreaView reads insets from a Provider.
// React Native's <Modal> renders into a separate native view, so the root
// SafeAreaProvider's insets aren't available inside it — without re-providing,
// SafeAreaView falls back to zero insets and content slides under the status
// bar / dynamic island. ModalShell re-wraps Modal contents with a
// SafeAreaProvider so insets are recomputed for the modal's window.
export function ModalShell({
  children,
  edges = DEFAULT_EDGES,
  style,
  variant = 'fullscreen',
}: ModalShellProps) {
  const fullscreenStyle = variant === 'fullscreen' ? styles.fullscreen : styles.overlay;

  return (
    <SafeAreaProvider>
      <View style={[fullscreenStyle, style]}>
        <SafeAreaView edges={edges} style={styles.flex}>
          {children}
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fullscreen: {
    backgroundColor: THEME_COLORS.background,
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
