import { Calendar, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';

import {
  getNflWeekLabel,
  NFL_REGULAR_SEASON_WEEKS,
  NFL_SEASON_WEEKS,
} from '@/constants/rules';
import { cn } from '@/lib/cn';

/**
 * Port of components/ui/week-navigator.tsx.
 *
 * The ceiling is the whole season, not the regular season. It used to default
 * to 14, which read "WEEK 15 OF 14" through the playoffs and disabled the
 * forward arrow, so playoff weeks could not be navigated to for review even
 * though `leagues.status` has a `'playoffs'` value and the schedule panel
 * already renders all three rounds.
 */
export function WeekNavigator({
  maxWeek = NFL_SEASON_WEEKS,
  onChange,
  week,
}: {
  maxWeek?: number;
  onChange: (week: number) => void;
  week: number;
}) {
  const canGoPrevious = week > 1;
  const canGoNext = week < maxWeek;
  const isPlayoffWeek = week > NFL_REGULAR_SEASON_WEEKS;
  const stepClasses =
    'flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05] text-textPrimary transition duration-150 ease-arena hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-35';

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        aria-label="Previous week"
        className={stepClasses}
        disabled={!canGoPrevious}
        onClick={() => onChange(Math.max(1, week - 1))}
        type="button">
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </button>

      <span
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-4 py-2',
          isPlayoffWeek
            ? 'border-gold/40 bg-gold/10'
            : 'border-electric-green/30 bg-electric-green/10',
        )}>
        {isPlayoffWeek ? (
          <Trophy aria-hidden className="h-3 w-3 text-gold" />
        ) : (
          <Calendar aria-hidden className="h-3 w-3 text-electric-green" />
        )}
        <span
          className={cn(
            'whitespace-nowrap text-[10px] font-black uppercase tracking-[0.15em]',
            isPlayoffWeek ? 'text-gold' : 'text-electric-green',
          )}>
          {getNflWeekLabel(week)}
        </span>
      </span>

      <button
        aria-label="Next week"
        className={stepClasses}
        disabled={!canGoNext}
        onClick={() => onChange(Math.min(maxWeek, week + 1))}
        type="button">
        <ChevronRight aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
