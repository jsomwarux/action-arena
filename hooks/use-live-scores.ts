import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { supabase } from '@/lib/supabase';
import type { LiveGameStateRow } from '@/types/database';

const liveScoreKeys = {
  byGames: (gameIdsKey: string) => ['live-scores', gameIdsKey] as const,
};

function uniqueSortedGameIds(gameIds: string[]) {
  return [...new Set(gameIds.filter(Boolean))].sort();
}

function isLiveGameStateRow(value: unknown): value is LiveGameStateRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Partial<LiveGameStateRow>;
  return typeof row.game_id === 'string' && typeof row.status === 'string';
}

function indexScores(scores: LiveGameStateRow[]) {
  return scores.reduce<Record<string, LiveGameStateRow>>((accumulator, score) => {
    accumulator[score.game_id] = score;
    return accumulator;
  }, {});
}

export function useLiveScores(gameIds: string[]) {
  const queryClient = useQueryClient();
  const sortedGameIds = useMemo(() => uniqueSortedGameIds(gameIds), [gameIds]);
  const gameIdsKey = sortedGameIds.join('|');
  // Keep the subscription key primitive so realtime updates don't churn the
  // query/effect cycle and recreate the Pick Board scroll-loop regression.
  const queryKey = useMemo(() => liveScoreKeys.byGames(gameIdsKey), [gameIdsKey]);

  const query = useQuery({
    enabled: sortedGameIds.length > 0,
    queryFn: async (): Promise<LiveGameStateRow[]> => {
      if (sortedGameIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('live_game_states')
        .select('*')
        .in('game_id', sortedGameIds);

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as LiveGameStateRow[];
    },
    queryKey,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (sortedGameIds.length === 0) {
      return undefined;
    }

    const activeIds = new Set(gameIdsKey.split('|').filter(Boolean));
    // Supabase reuses channels by topic and rejects adding postgres_changes
    // callbacks after a previous same-topic channel has subscribed. Give each
    // effect run a fresh topic while keeping filtering/cache keys stable.
    const channelTopic = `live-game-states:${Date.now().toString(36)}:${Math.random()
      .toString(36)
      .slice(2)}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_game_states',
        },
        (payload) => {
          const nextRow = isLiveGameStateRow(payload.new) ? payload.new : null;
          const previousRow = isLiveGameStateRow(payload.old) ? payload.old : null;
          const gameId = nextRow?.game_id ?? previousRow?.game_id;

          if (!gameId || !activeIds.has(gameId)) {
            return;
          }

          queryClient.setQueryData<LiveGameStateRow[]>(queryKey, (current = []) => {
            if (!nextRow) {
              return current.filter((score) => score.game_id !== gameId);
            }

            const existing = current.find((score) => score.game_id === gameId);
            if (!existing) {
              return [...current, nextRow];
            }

            return current.map((score) => (score.game_id === gameId ? nextRow : score));
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameIdsKey, queryClient, queryKey]);

  const scoresByGameId = useMemo(() => indexScores(query.data ?? []), [query.data]);

  return {
    ...query,
    scoresByGameId,
  };
}
