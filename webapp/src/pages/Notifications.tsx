import { useMemo } from 'react';

import { BellOff, Inbox, Settings2, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

import { NotificationRow } from '@/components/notifications/NotificationRow';
import {
  isUnread,
  useNotificationEvents,
  useNotificationReadState,
} from '@/components/notifications/use-notification-events';
import { Badge, Button, Card, Notice, Skeleton, StaggeredItem } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useRegisterPushNotifications } from '@/hooks/use-notifications';
import { ROUTES } from '@/lib/routes';

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3, 4].map((key) => (
        <Skeleton height={92} key={key} radius={16} />
      ))}
    </div>
  );
}

function EmptyInbox() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] text-white/50">
          <Inbox aria-hidden className="h-6 w-6" />
        </span>
        <h2 className="arena-heading text-2xl leading-none">Nothing Yet</h2>
        <p className="max-w-md text-sm font-semibold leading-6 text-white/55">
          Alerts land here as your week plays out — new lines, pick reminders, results, parlay legs,
          matchup outcomes and weekly awards.
        </p>
        <Link
          className="text-sm font-bold text-electric-green hover:underline"
          to={ROUTES.notificationPreferences}>
          Choose which alerts you get
        </Link>
      </div>
    </Card>
  );
}

/**
 * The in-app notifications inbox — web only.
 *
 * On iOS the delivery channel is a push notification, so mobile has no list
 * screen: `notification_events` rows are read by the process-notifications Edge
 * Function and pushed to the device. A browser has no Expo push token, which
 * means those same rows are marked `skipped` and would otherwise never reach
 * the player. This page is that missing channel — the events table, read
 * directly, newest first.
 *
 * Read state is a device-local marker rather than a column: the table grants
 * the recipient SELECT only, with no read flag to write. See
 * components/notifications/use-notification-events.ts.
 */
export function NotificationsPage() {
  const { user } = useAuth();
  const eventsQuery = useNotificationEvents(user?.id);
  const { isReady, markAllRead, readThrough } = useNotificationReadState(user?.id);
  const push = useRegisterPushNotifications();

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const unreadCount = useMemo(
    () => (isReady ? events.filter((event) => isUnread(event, readThrough)).length : 0),
    [events, isReady, readThrough],
  );

  const newestCreatedAt = events[0]?.created_at ?? null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-electric-green">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            Inbox
          </p>
          <h1 className="arena-heading mt-1 text-5xl leading-none">Notifications</h1>
          <p className="mt-2 max-w-2xl text-textMuted">
            Every alert your leagues generated, newest first.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {unreadCount > 0 ? (
            <Badge label={`${unreadCount} unread`} tone="green" />
          ) : (
            <Badge label="All caught up" tone="neutral" />
          )}
          <Button
            disabled={unreadCount === 0 || !newestCreatedAt}
            fullWidth={false}
            onClick={() => {
              if (newestCreatedAt) markAllRead(newestCreatedAt);
            }}
            title="Mark All Read"
            variant="secondary"
          />
          <Link
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-base font-black uppercase leading-5 tracking-[0.09em] text-white transition hover:bg-white/10"
            to={ROUTES.notificationPreferences}>
            <Settings2 aria-hidden className="h-[18px] w-[18px]" />
            Preferences
          </Link>
        </div>
      </header>

      {!push.isSupported ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] text-white/50">
              <BellOff aria-hidden className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                  Browser delivery
                </p>
                <Badge icon={Smartphone} label="Push is iOS only" tone="neutral" />
              </div>
              <p className="mt-1.5 text-sm font-medium leading-6 text-white/55">
                This browser cannot receive push notifications, so nothing is missed — every alert
                your leagues generate is listed here whether or not a phone was reachable.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {eventsQuery.isError ? (
        <Notice tone="error">
          Could not load notifications.{' '}
          {eventsQuery.error instanceof Error ? eventsQuery.error.message : 'Try again.'}
        </Notice>
      ) : null}

      {eventsQuery.isLoading ? <NotificationsSkeleton /> : null}

      {!eventsQuery.isLoading && events.length === 0 && !eventsQuery.isError ? <EmptyInbox /> : null}

      {events.length > 0 ? (
        <div className="flex flex-col gap-3">
          {events.map((event, index) => (
            <StaggeredItem index={index} key={event.id}>
              <NotificationRow event={event} unread={isReady && isUnread(event, readThrough)} />
            </StaggeredItem>
          ))}
        </div>
      ) : null}
    </section>
  );
}
