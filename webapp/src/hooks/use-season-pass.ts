import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CURRENT_SEASON_YEAR } from '@/constants/cosmetics';
import { logAnalyticsEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { SeasonPassRow } from '@/types/database';

export const seasonPassKeys = {
  access: (
    userId: string | undefined,
    leagueId: string | undefined,
    weekNumber: number | undefined,
  ) => ['season-pass', 'bet-board-access', userId, leagueId, weekNumber] as const,
  pass: (userId: string | undefined, seasonYear: number) =>
    ['season-pass', userId, seasonYear] as const,
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

export function useSeasonPass(userId: string | undefined, seasonYear = CURRENT_SEASON_YEAR) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async (): Promise<SeasonPassRow | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('season_passes')
        .select('*')
        .eq('user_id', userId)
        .eq('season_year', seasonYear)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return (data as SeasonPassRow | null) ?? null;
    },
    queryKey: seasonPassKeys.pass(userId, seasonYear),
  });
}

export function useRedeemSeasonPassMutation(
  userId: string | undefined,
  seasonYear = CURRENT_SEASON_YEAR,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('redeem_season_pass', {
        p_code: code,
        p_season_year: seasonYear,
      });

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (_passId, code) => {
      logAnalyticsEvent('season_pass_redeemed', {
        code: code.trim().toUpperCase(),
        season_year: seasonYear,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: seasonPassKeys.pass(userId, seasonYear) }),
        queryClient.invalidateQueries({ queryKey: ['cosmetics', 'mine', userId] }),
      ]);
    },
  });
}

export function useBetBoardAccess({
  leagueId,
  userId,
  weekNumber,
}: {
  leagueId: string | undefined;
  userId: string | undefined;
  weekNumber: number | undefined;
}) {
  return useQuery({
    enabled: Boolean(leagueId && userId && weekNumber),
    queryFn: async (): Promise<boolean> => {
      if (!leagueId || !weekNumber || !userId) {
        return true;
      }

      const { data, error } = await supabase.rpc('can_access_bet_board', {
        p_league_id: leagueId,
        p_user_id: userId,
        p_week_number: weekNumber,
      });

      return assertSupabaseResult(data, error);
    },
    queryKey: seasonPassKeys.access(userId, leagueId, weekNumber),
    staleTime: 60 * 1000,
  });
}
