import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/cn';

/** Port of components/ui/week-navigator.tsx. Same copy, same bounds. */
export function WeekNavigator({
  maxWeek = 14,
  onChange,
  week,
}: {
  maxWeek?: number;
  onChange: (week: number) => void;
  week: number;
}) {
  const canGoPrevious = week > 1;
  const canGoNext = week < maxWeek;

  const stepClasses = (enabled: boolean) =>
    cn(
      'flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.05]',
      'transition duration-150 ease-arena',
      enabled ? 'text-white hover:bg-white/10' : 'cursor-not-allowed opacity-35',
    );

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        aria-label="Previous week"
        className={stepClasses(canGoPrevious)}
        disabled={!canGoPrevious}
        onClick={() => onChange(Math.max(1, week - 1))}
        type="button">
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </button>

      <span className="inline-flex items-center gap-1.5 rounded-full border border-electric-green/30 bg-electric-green/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-electric-green">
        <Calendar aria-hidden className="h-3 w-3" />
        Week {week} of {maxWeek}
      </span>

      <button
        aria-label="Next week"
        className={stepClasses(canGoNext)}
        disabled={!canGoNext}
        onClick={() => onChange(Math.min(maxWeek, week + 1))}
        type="button">
        <ChevronRight aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
