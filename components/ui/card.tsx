import { BlurView } from 'expo-blur';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type CardTone = 'default' | 'highlight';

type CardProps = PropsWithChildren<{
  intensity?: number;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: CardTone;
}>;

export function Card({
  children,
  intensity = 28,
  padded = true,
  style,
  tone = 'default',
}: CardProps) {
  return (
    <View style={[styles.shadow, style]}>
      <BlurView intensity={intensity} style={styles.card} tint="dark">
        <View
          style={[
            styles.frost,
            tone === 'highlight' ? styles.frostHighlight : null,
            padded ? styles.padded : null,
          ]}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  frost: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    borderWidth: 1,
  },
  frostHighlight: {
    backgroundColor: 'rgba(0,255,135,0.06)',
    borderColor: 'rgba(0,255,135,0.22)',
  },
  padded: {
    padding: 16,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
});
