import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type {
  NotificationPreferencesRow,
  NotificationPreferencesUpdate,
  NotificationType,
} from '@/types/database';

type NotificationRouteData = {
  betId?: unknown;
  leagueId?: unknown;
  matchupId?: unknown;
  type?: unknown;
};

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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function assertSupabaseResult<T>(data: T | null, error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }

  if (data === null) {
    throw new Error('No data returned from Supabase.');
  }

  return data;
}

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.projectId
  );
}

function getString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function routeFromNotificationData(data: NotificationRouteData) {
  const type = getString(data.type);

  if (type === 'bet') {
    const betId = getString(data.betId);
    return betId
      ? ({
          pathname: '/bets/[betId]' as const,
          params: { betId },
        } as const)
      : null;
  }

  if (type === 'matchup') {
    const matchupId = getString(data.matchupId);
    return matchupId
      ? ({
          pathname: '/matchups/[matchupId]' as const,
          params: { matchupId },
        } as const)
      : null;
  }

  if (type === 'league' || type === 'league_chat') {
    const leagueId = getString(data.leagueId);
    return leagueId
      ? ({
          pathname: '/leagues/[leagueId]' as const,
          params: { initialTab: type === 'league_chat' ? 'chat' : undefined, leagueId },
        } as const)
      : null;
  }

  if (type === 'bet_board') {
    return '/bet-board' as const;
  }

  return null;
}

async function registerForPushToken() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      importance: Notifications.AndroidImportance.MAX,
      lightColor: '#00FF87',
      name: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing.status === 'granted'
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = getProjectId();
  // Supported iOS simulator/dev-build setups can register Expo push tokens too.
  // Unsupported runtimes throw here and are handled by the caller.
  const token = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return token.data;
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

export function useRegisterPushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const token = await registerForPushToken();

        if (cancelled || !token) {
          return;
        }

        await supabase.from('users').update({ push_token: token }).eq('id', user.id);
      } catch (error) {
        if (__DEV__) {
          console.warn('Push notification registration failed', error);
        }
      }
    };

    void register();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationRouteData;
      const route = routeFromNotificationData(data);

      if (route) {
        router.push(route);
      }
    });

    return () => subscription.remove();
  }, []);
}
