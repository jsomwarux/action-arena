import { useEffect, useRef, useState } from 'react';

/**
 * Port of components/ui/animated-number.tsx, with one deliberate divergence.
 *
 * Mobile renders a `display` state that only the animation listener ever
 * writes, so the number on screen is whatever the last delivered frame said.
 * On the web that is a correctness bug, not a motion bug: a throttled rAF — a
 * backgrounded tab, reduced motion, animations disabled — leaves the counter
 * showing a stale figure. The Pick Board hit exactly this, reading `0 coins`
 * while validation correctly reported 60 allocated.
 *
 * So `value` is the truth and is what renders. The tween is an overlay that
 * exists only while it is actually running: when rAF never arrives, `tween`
 * stays null and the real figure shows immediately. The timeout is the belt to
 * that braces — setTimeout is clamped in background tabs but never paused, so
 * a tween that stops mid-flight still resolves to the true number.
 *
 * Formatting and easing stay mobile's: `toFixed(decimals)` unless a formatter
 * is passed, and `Easing.out(Easing.cubic)` over `duration`.
 */

/** Backstop headroom over `duration` before the overlay is force-cleared. */
const SETTLE_GRACE_MS = 280;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function AnimatedNumber({
  className,
  decimals = 0,
  duration = 360,
  formatter,
  prefix = '',
  style,
  suffix = '',
  value,
}: {
  className?: string;
  decimals?: number;
  duration?: number;
  formatter?: (value: number) => string;
  prefix?: string;
  style?: React.CSSProperties;
  suffix?: string;
  value: number;
}) {
  const [tween, setTween] = useState<number | null>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;

    if (from === value || prefersReducedMotion()) {
      setTween(null);
      return undefined;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const linear = Math.min(1, (now - start) / duration);

      if (linear >= 1) {
        setTween(null);
        return;
      }

      // Easing.out(Easing.cubic), the mobile curve.
      const eased = 1 - (1 - linear) ** 3;
      setTween(from + (value - from) * eased);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    const settle = window.setTimeout(() => setTween(null), duration + SETTLE_GRACE_MS);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      setTween(null);
    };
  }, [duration, value]);

  const shown = tween ?? value;
  const formatted = formatter ? formatter(shown) : shown.toFixed(decimals);

  return (
    <span className={className} style={style}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
