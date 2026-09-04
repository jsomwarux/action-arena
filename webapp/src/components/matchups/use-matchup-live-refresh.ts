import { useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * Keeps an open matchup fresh on a Sunday without making the page twitch.
 *
 * Two signals feed one debounced refetch:
 *  - Postgres changes on this league's `bets` and `weekly_matchups` rows, which
 *    is what settlement writes to.
 *  - A slow poll, but only while at least one leg is actually in progress —
 *    otherwise an idle tab sits silent.
 *
 * Refetching (rather than re-mounting) means React Query keeps the previous
 * data on screen until the new rows land, so nothing flashes.
 */
export function useMatchupLiveRefresh({
  hasLiveGames,
  leagueId,
  matchupId,
}: {
  hasLiveGames: boolean;
  leagueId: string | undefined;
  matchupId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!leagueId || !matchupId) {
      return undefined;
    }

    const requestRefresh = () => {
      if (pendingRef.current !== null) {
        return;
      }

      pendingRef.current = window.setTimeout(() => {
        pendingRef.current = null;
        void queryClient
          .invalidateQueries({ queryKey: ['matchups', 'detail'] })
          .then(() => setLastRefreshedAt(Date.now()));
      }, 1500);
    };

    // Supabase reuses channels by topic and rejects new postgres_changes
    // callbacks on an already-subscribed topic, so each effect run takes a
    // fresh topic — the same guard use-live-scores.ts documents.
    const channelTopic = `matchup-detail:${matchupId}:${Date.now().toString(36)}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        { event: '*', filter: `league_id=eq.${leagueId}`, schema: 'public', table: 'bets' },
        requestRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `league_id=eq.${leagueId}`,
          schema: 'public',
          table: 'weekly_matchups',
        },
        requestRefresh,
      )
      .subscribe();

    return () => {
      if (pendingRef.current !== null) {
        window.clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [leagueId, matchupId, queryClient]);

  useEffect(() => {
    if (!hasLiveGames || !matchupId) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void queryClient
        .invalidateQueries({ queryKey: ['matchups', 'detail'] })
        .then(() => setLastRefreshedAt(Date.now()));
    }, 45_000);

    return () => window.clearInterval(interval);
  }, [hasLiveGames, matchupId, queryClient]);

  return { lastRefreshedAt, markRefreshed: () => setLastRefreshedAt(Date.now()) };
}
