import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchUpcomingNflOdds, isUsingMockOdds } from '@/lib/odds-api';
import type { OddsGame } from '@/lib/odds-api';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

export function useUpcomingNflOdds() {
  return useQuery({
    gcTime: 1000 * 60 * 30,
    queryFn: fetchUpcomingNflOdds,
    queryKey: ['odds', 'nfl', 'upcoming', isUsingMockOdds ? 'mock' : 'live'],
    staleTime: 1000 * 60 * 5,
  });
}

export function useLeagueWeekRevealTime(
  leagueId: string | undefined,
  weekNumber: number | undefined,
) {
  return useQuery({
    enabled: Boolean(leagueId && weekNumber),
    queryFn: async (): Promise<string | null> => {
      if (!leagueId || !weekNumber) {
        return null;
      }

      const { data, error } = await supabase.rpc('league_week_reveal_time', {
        p_league_id: leagueId,
        p_week_number: weekNumber,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    queryKey: ['league-week-reveal-time', leagueId, weekNumber],
    refetchInterval: 1000 * 30,
    staleTime: 1000 * 15,
  });
}

export function useSyncLeagueWeekSlate(
  leagueId: string | undefined,
  weekNumber: number | undefined,
  games: OddsGame[] | undefined,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leagueId || !weekNumber || !games || games.length === 0) {
      return;
    }

    const payload = games.map((game) => ({
      away_team: game.awayTeam,
      commence_time: game.commenceTime,
      game_id: game.id,
      home_team: game.homeTeam,
    }));

    void supabase
      .rpc('sync_league_week_slate', {
        p_games: payload as unknown as Json,
        p_league_id: leagueId,
        p_week_number: weekNumber,
      })
      .then(({ error }) => {
        if (error) {
          console.warn('Weekly slate sync failed', error.message);
          return;
        }
        void queryClient.invalidateQueries({
          queryKey: ['league-week-reveal-time', leagueId, weekNumber],
        });
      });
  }, [games, leagueId, queryClient, weekNumber]);
}
