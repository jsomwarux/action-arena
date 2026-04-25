import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function safe(fn: () => Promise<unknown>) {
  if (Platform.OS === 'web') {
    return;
  }
  fn().catch(() => {
    // Haptics are advisory — silently swallow failures on unsupported devices.
  });
}

export const haptics = {
  light() {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  medium() {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  heavy() {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  selection() {
    safe(() => Haptics.selectionAsync());
  },
  success() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};
