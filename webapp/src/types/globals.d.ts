/**
 * React Native defines `__DEV__` as a global. The ported lib/ and hooks/ files
 * guard dev-only logging on it, so vite.config.ts defines it for the web build
 * and this declares it for the type checker. Keeping it means those files stay
 * byte-identical to their mobile originals.
 */
declare const __DEV__: boolean;
