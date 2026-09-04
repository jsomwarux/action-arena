import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type {
  NotificationPreferencesRow,
  NotificationPreferencesUpdate,
  NotificationType,
} from '@/types/database';

export const NOTIFICATION_PREFERENCE_LABELS: {
  description: string;
  key: NotificationType;
  title: string;
}[] = [
  {
    description: "When fresh weekly lines are ready, you'll get nudged back to the board.",
    key: 'odds_available',
    title: "New week's lines",
  },
  {
    description: 'A reminder before kickoff if your weekly card is still missing.',
    key: 'bet_reminders',
    title: 'Pick reminders',
  },
  {
    description: 'Final result alerts when individual picks settle.',
    key: 'bet_results',
    title: 'Pick results',
  },
  {
    description: 'Leg-by-leg updates for parlays and teasers while games finish.',
    key: 'parlay_leg_updates',
    title: 'Parlay and teaser legs',
  },
  {
    description: 'The big one: multi-leg hits with the full profit moment.',
    key: 'parlay_hits',
    title: 'Parlay and teaser hits',
  },
  {
    description: 'Weekly head-to-head results once your matchup settles.',
    key: 'matchup_results',
    title: 'Matchup results',
  },
  {
    description: 'Top Performer, Pick of the Week, and other league hardware.',
    key: 'weekly_awards',
    title: 'Weekly awards',
  },
  {
    description: 'Urgency when your opponent has already submitted their weekly picks.',
    key: 'opponent_bets_locked',
    title: 'Opponent submitted picks',
  },
];

const notificationKeys = {
  preferences: (userId: string | undefined) => ['notifications', 'preferences', userId] as const,
};

function assertSupabaseResult<T>(data: T | null, error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }

  if (data === null) {
    throw new Error('No data returned from Supabase.');
  }

  return data;
}

export function useNotificationPreferences(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async (): Promise<NotificationPreferencesRow> => {
      if (!userId) {
        throw new Error('User is required.');
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        return data;
      }

      const inserted = await supabase
        .from('notification_preferences')
        .insert({ user_id: userId })
        .select('*')
        .single();

      return assertSupabaseResult(inserted.data, inserted.error);
    },
    queryKey: notificationKeys.preferences(userId),
  });
}

export function useUpdateNotificationPreferences(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: NotificationPreferencesUpdate) => {
      if (!userId) {
        throw new Error('User is required.');
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .upsert({ ...updates, user_id: userId })
        .select('*')
        .single();

      return assertSupabaseResult(data, error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.preferences(userId) });
    },
  });
}

export type PushNotificationSupport = {
  isSupported: false;
};

/**
 * Web stub. Expo push registration and the users.push_token write are iOS-only,
 * so this reports that push is unsupported and does nothing else. Preference
 * reads and writes above are unchanged from mobile.
 */
export function useRegisterPushNotifications(): PushNotificationSupport {
  return { isSupported: false };
}
