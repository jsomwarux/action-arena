/**
 * localStorage behind AsyncStorage's async signature.
 *
 * The mobile hooks await every storage call, so keeping the Promise-returning
 * shape lets them port across unchanged. Reads and writes are wrapped because
 * localStorage throws in private-mode and storage-blocked browsers.
 */
const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage is advisory here — a blocked write must not break the caller.
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Same as setItem: a blocked removal is not worth throwing over.
    }
  },
};

export default AsyncStorage;
