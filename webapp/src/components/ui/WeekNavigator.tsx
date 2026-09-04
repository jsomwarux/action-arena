import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

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

      <span className="flex items-center gap-1.5 rounded-full border border-electric-green/30 bg-electric-green/10 px-4 py-2">
        <Calendar aria-hidden className="h-3 w-3 text-electric-green" />
        <span className="text-[10px] font-black uppercase tracking-[1.5px] text-electric-green">
          Week {week} of {maxWeek}
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
