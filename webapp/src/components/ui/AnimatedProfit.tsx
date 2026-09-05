import { cn } from '@/lib/cn';
import { formatProfit, getProfitTone } from '@/lib/format';

import { AnimatedNumber } from './AnimatedNumber';

/**
 * A profit figure that counts to its new value.
 *
 * AGENTS.md asks for animated number counters, and profit is where they earn
 * their keep: on a Sunday these figures move on their own as `sync-live-scores`
 * lands, and a number that ticks tells the player *that* it moved — a number
 * that swaps silently does not.
 *
 * Formatting and tone travel together so the sign, the "coins" suffix and the
 * green/red never drift apart across the twenty-odd places profit is shown.
 * The counter is an overlay over the true value (see AnimatedNumber), so if the
 * tween never runs, the correct figure is on screen immediately.
 */
export function AnimatedProfit({
  className,
  toned = true,
  value,
}: {
  className?: string;
  /** Off when the surrounding element already owns the colour. */
  toned?: boolean;
  value: number;
}) {
  return (
    <AnimatedNumber
      className={cn(toned && getProfitTone(value), className)}
      formatter={formatProfit}
      value={value}
    />
  );
}
