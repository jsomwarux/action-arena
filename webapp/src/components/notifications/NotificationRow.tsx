import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  ChevronRight,
  Layers,
  PartyPopper,
  Swords,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatGameTime } from '@/lib/format';
import { buildRoute } from '@/lib/routes';
import type { NotificationEventRow, NotificationType } from '@/types/database';

type Tone = 'green' | 'gold' | 'amber' | 'cyan' | 'red';

const TYPE_META: Record<NotificationType, { icon: LucideIcon; label: string; tone: Tone }> = {
  bet_reminders: { icon: CalendarClock, label: 'Pick reminder', tone: 'cyan' },
  bet_results: { icon: Target, label: 'Pick result', tone: 'green' },
  matchup_results: { icon: Swords, label: 'Matchup', tone: 'green' },
  odds_available: { icon: BellRing, label: 'New lines', tone: 'cyan' },
  opponent_bets_locked: { icon: Swords, label: 'Opponent', tone: 'amber' },
  parlay_hits: { icon: PartyPopper, label: 'Parlay hit', tone: 'amber' },
  parlay_leg_updates: { icon: Layers, label: 'Leg update', tone: 'amber' },
  weekly_awards: { icon: Trophy, label: 'Weekly award', tone: 'gold' },
};

const ICON_TONE: Record<Tone, string> = {
  amber: 'border-amber-accent/35 bg-amber-accent/12 text-amber-accent',
  cyan: 'border-cyan-accent/35 bg-cyan-accent/12 text-cyan-accent',
  gold: 'border-gold/35 bg-gold/12 text-gold',
  green: 'border-electric-green/35 bg-electric-green/12 text-electric-green',
  red: 'border-coral-red/35 bg-coral-red/12 text-coral-red',
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Relative for the last week, absolute after that — the same read as chat. */
function formatWhen(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime();

  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`;

  return formatGameTime(iso);
}

/**
 * Where an event points, if anywhere.
 *
 * `notification_events` carries nullable bet, matchup and league references;
 * the most specific one wins, so a settled-pick alert opens that pick rather
 * than the league it belongs to.
 */
function destinationFor(event: NotificationEventRow) {
  if (event.bet_id) return buildRoute.bet(event.bet_id);
  if (event.matchup_id) return buildRoute.matchup(event.matchup_id);
  if (event.league_id) return buildRoute.league(event.league_id);
  return null;
}

export function NotificationRow({
  event,
  unread,
}: {
  event: NotificationEventRow;
  unread: boolean;
}) {
  const meta = TYPE_META[event.notification_type];
  const Icon = meta.icon;
  const destination = destinationFor(event);

  const body = (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-4 transition duration-150 ease-arena',
        unread
          ? 'border-electric-green/30 bg-electric-green/[0.06]'
          : 'border-white/[0.07] bg-white/[0.03]',
        // The <a> is the hover target, so this row follows it via `group-`
        // rather than carrying .arena-row-interactive itself.
        destination && 'group-hover:border-white/20 group-hover:bg-white/[0.07]',
      )}>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
          ICON_TONE[meta.tone],
        )}>
        <Icon aria-hidden className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {unread ? (
            <span
              aria-label="Unread"
              className="h-2 w-2 shrink-0 rounded-full bg-electric-green shadow-[0_0_6px_rgba(0,255,135,0.8)]"
            />
          ) : null}
          <p className="min-w-0 truncate text-base font-black tracking-[-0.01em] text-white">
            {event.title}
          </p>
          <Badge label={meta.label} tone="neutral" />
          {event.status === 'failed' ? (
            <Badge icon={AlertTriangle} label="Delivery failed" tone="red" />
          ) : null}
        </div>

        <p className="mt-1 text-sm font-medium leading-6 text-white/60">{event.body}</p>

        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/35">
          {formatWhen(event.created_at)}
        </p>
      </div>

      {destination ? (
        <ChevronRight
          aria-hidden
          className="mt-1 h-4 w-4 shrink-0 text-white/25 transition group-hover:text-white/60"
        />
      ) : null}
    </div>
  );

  if (!destination) {
    return body;
  }

  return (
    <Link className="group block" to={destination}>
      {body}
    </Link>
  );
}
