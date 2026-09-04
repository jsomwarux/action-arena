import { useCallback, useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import AsyncStorage from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { NotificationEventRow } from '@/types/database';

/** How far back the in-app list reaches. Older events stay in the table. */
const NOTIFICATION_PAGE_SIZE = 100;

export const notificationEventKeys = {
  list: (userId: string | undefined) => ['notifications', 'events', userId] as const,
};

/**
 * The signed-in player's queued and delivered notifications.
 *
 * `notification_events` is the table the settlement, award and reminder jobs
 * write into; RLS already limits a reader to their own rows
 * (`recipient_user_id = auth.uid()`), so no extra filtering is needed beyond
 * ordering. Mobile never reads this table — push notifications *are* its
 * inbox — so this query is web-only, and it is the reason the desktop client
 * needs a notifications list at all.
 */
export function useNotificationEvents(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async (): Promise<NotificationEventRow[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('notification_events')
        .select('*')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATION_PAGE_SIZE);

      if (error) {
        throw new Error(error.message);
      }

      return (data as NotificationEventRow[] | null) ?? [];
    },
    queryKey: notificationEventKeys.list(userId),
    staleTime: 30 * 1000,
  });
}

function readMarkerKey(userId: string) {
  return `action-arena.notifications-read-through.${userId}`;
}

export type NotificationReadState = {
  /** True once the stored marker has been read, so the list can avoid a flash. */
  isReady: boolean;
  /** ISO timestamp; every event created at or before it counts as read. */
  readThrough: string | null;
  markAllRead: (throughIso: string) => void;
};

/**
 * Read state for the in-app list.
 *
 * `notification_events` has no per-row read flag and grants the recipient
 * SELECT only — there is no UPDATE policy and no RPC to mark one read — so
 * read/unread is tracked on this device rather than invented server-side. A
 * single "read through" timestamp is compared against each event's
 * `created_at`, which is enough for a reverse-chronological list and degrades
 * honestly: a second browser starts with everything unread instead of showing
 * a state the database never agreed to.
 */
export function useNotificationReadState(userId: string | undefined): NotificationReadState {
  const [readThrough, setReadThrough] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setReadThrough(null);
      setIsReady(true);
      return () => {
        active = false;
      };
    }

    setIsReady(false);

    AsyncStorage.getItem(readMarkerKey(userId))
      .then((stored) => {
        if (active) {
          setReadThrough(stored);
        }
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const markAllRead = useCallback(
    (throughIso: string) => {
      if (!userId) return;
      setReadThrough(throughIso);
      void AsyncStorage.setItem(readMarkerKey(userId), throughIso);
    },
    [userId],
  );

  return { isReady, markAllRead, readThrough };
}

/** An event is unread until the device marker has caught up to its timestamp. */
export function isUnread(event: NotificationEventRow, readThrough: string | null) {
  if (!readThrough) return true;
  return event.created_at > readThrough;
}
