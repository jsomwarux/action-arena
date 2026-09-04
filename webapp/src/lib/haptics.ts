/**
 * Web adapter for lib/haptics.ts.
 *
 * Browsers have no haptic engine, so every method is a no-op. The exported
 * surface matches mobile exactly so ported callers need no changes.
 */
export const haptics = {
  light() {},
  medium() {},
  heavy() {},
  selection() {},
  success() {},
  warning() {},
  error() {},
};
