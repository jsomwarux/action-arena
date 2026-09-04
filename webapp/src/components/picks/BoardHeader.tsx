/**
 * The board's top strip: which league, which week, and which kind of pick the
 * slate's buttons are currently building.
 *
 * The mode toggle sits over the slate rather than over the rail because it
 * changes what the odds buttons mean — teaser mode hides moneylines and repaints
 * every spread and total at its teased number.
 */

import { AlertCircle, ChevronLeft, ChevronRight, Info, Link2, TrendingUp, X, Zap } from 'lucide-react';

import { SegmentedToggle, type SegmentedOption } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { LeagueRow } from '@/types/database';

import { REGULAR_SEASON_WEEKS, type BetMode } from './pick-board-model';

const BET_MODE_OPTIONS: SegmentedOption<BetMode>[] = [
  { accent: 'green', icon: Zap, label: 'Straight', value: 'straight' },
  { accent: 'amber', icon: Link2, label: 'Parlay', value: 'parlay' },
  { accent: 'cyan', icon: TrendingUp, label: 'Teaser', value: 'teaser' },
];

export function BoardModeToggle({
  onChange,
  value,
}: {
  onChange: (mode: BetMode) => void;
  value: BetMode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Pick Type</p>
      <SegmentedToggle onChange={onChange} options={BET_MODE_OPTIONS} value={value} />
    </div>
  );
}

export function LeagueSelect({
  leagues,
  onSelect,
  selectedLeagueId,
}: {
  leagues: LeagueRow[];
  onSelect: (leagueId: string) => void;
  selectedLeagueId: string | undefined;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
        League
      </span>
      <select
        className={cn(
          'min-h-11 min-w-[13rem] rounded-xl border border-border bg-white/[0.04] px-3',
          'text-sm font-bold text-white transition duration-150 ease-arena',
          'hover:border-electric-green/45',
        )}
        onChange={(event) => onSelect(event.target.value)}
        value={selectedLeagueId ?? ''}>
        {leagues.map((league) => (
          <option key={league.id} value={league.id}>
            {league.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WeekNavigator({
  maxWeek = REGULAR_SEASON_WEEKS,
  onChange,
  week,
}: {
  maxWeek?: number;
  onChange: (week: number) => void;
  week: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Week</span>
      <div className="flex min-h-11 items-center gap-1 rounded-xl border border-border bg-white/[0.04] px-1">
        <button
          aria-label="Previous week"
          className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
          disabled={week <= 1}
          onClick={() => onChange(week - 1)}
          type="button">
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
        <span className="min-w-[4.5rem] text-center text-sm font-black uppercase tracking-[0.08em] text-white">
          Week {week}
        </span>
        <button
          aria-label="Next week"
          className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
          disabled={week >= maxWeek}
          onClick={() => onChange(week + 1)}
          type="button">
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export type BoardMessageTone = 'info' | 'warn' | 'error' | 'success';

export type BoardMessage = {
  actionLabel?: string;
  id: string;
  onAction?: () => void;
  text: string;
  tone: BoardMessageTone;
};

const MESSAGE_CLASS: Record<BoardMessageTone, string> = {
  error: 'border-coral-red/40 bg-coral-red/10 text-coral-red',
  info: 'border-white/12 bg-white/[0.06] text-white/75',
  success: 'border-electric-green/40 bg-electric-green/10 text-electric-green',
  warn: 'border-amber-accent/40 bg-amber-accent/10 text-amber-accent',
};

/**
 * The desktop stand-in for the phone's Alert and inline conflict notice: an
 * inline strip, never a modal, so it cannot interrupt a click-through.
 */
export function BoardNotice({
  message,
  onDismiss,
}: {
  message: BoardMessage;
  onDismiss: () => void;
}) {
  const Icon = message.tone === 'info' ? Info : AlertCircle;

  return (
    <div
      className={cn('flex items-start gap-2 rounded-2xl border px-3 py-2.5', MESSAGE_CLASS[message.tone])}
      role={message.tone === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <p className="text-sm font-semibold leading-5">{message.text}</p>
        {message.actionLabel && message.onAction ? (
          <button
            className="rounded-full border border-electric-green/45 bg-electric-green/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-electric-green transition hover:bg-electric-green/25"
            onClick={message.onAction}
            type="button">
            {message.actionLabel}
          </button>
        ) : null}
      </div>
      <button
        aria-label="Dismiss message"
        className="shrink-0 rounded-lg p-1 opacity-70 transition hover:bg-white/10 hover:opacity-100"
        onClick={onDismiss}
        type="button">
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
