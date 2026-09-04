import { useEffect, useState } from 'react';

/**
 * A coarse ticking clock for lock state.
 *
 * Legs lock when their own game starts, so the board has to notice time passing
 * without any server round trip. Mobile's `useLockClock` does the same thing at
 * the same 30s cadence; anything faster would re-render the whole slate for no
 * visible gain.
 */
export function useBoardClock(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return now;
}
