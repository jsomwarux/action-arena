import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { BetLegInsert, BetLegRow, BetRow, BetType, Json, TeaserPoints } from '@/types/database';

export type StraightBetSubmission = {
  adjusted_line: number | null;
  amount: number;
  game_id: string;
  game_start_time: string;
  leg_odds: number;
  market: BetLegInsert['market'];
  odds: number;
  original_line: number | null;
  potential_payout: number;
  selection: string;
};

export type BetSubmissionLeg = {
  adjusted_line: number | null;
  game_id: string;
  game_start_time: string;
  leg_odds: number;
  market: BetLegInsert['market'];
  original_line: number | null;
  selection: string;
};

export type MixedBetSubmission = {
  amount: number;
  bet_type: BetType;
  odds: number;
  potential_payout: number;
  teaser_points: TeaserPoints | null;
  legs: BetSubmissionLeg[];
};

export type PlacedBet = BetRow & {
  bet_legs: BetLegRow[];
};

export type PlacedStraightBet = PlacedBet;

const straightBetKeys = {
  placed: (leagueId: string | undefined, userId: string | undefined, weekNumber: number | undefined) =>
    ['straight-bets', 'placed', leagueId, userId, weekNumber] as const,
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

export function usePlacedBets(
  leagueId: string | undefined,
  userId: string | undefined,
  weekNumber: number | undefined,
) {
  return useQuery({
    enabled: Boolean(leagueId && userId && weekNumber),
    queryFn: async (): Promise<PlacedBet[]> => {
      if (!leagueId || !userId || !weekNumber) {
        return [];
      }

      const { data, error } = await supabase
        .from('bets')
        .select('*, bet_legs(*)')
        .eq('league_id', leagueId)
        .eq('user_id', userId)
        .eq('week_number', weekNumber)
        .order('created_at', { ascending: true });

      return assertSupabaseResult(data as PlacedBet[] | null, error);
    },
    queryKey: straightBetKeys.placed(leagueId, userId, weekNumber),
  });
}

export function usePlacedStraightBets(
  leagueId: string | undefined,
  userId: string | undefined,
  weekNumber: number | undefined,
) {
  return usePlacedBets(leagueId, userId, weekNumber);
}

export function useSubmitBetsMutation(
  leagueId: string | undefined,
  userId: string | undefined,
  weekNumber: number | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async (bets: MixedBetSubmission[]) => {
      const queryKey = straightBetKeys.placed(leagueId, userId, weekNumber);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PlacedBet[]>(queryKey) ?? [];

      if (leagueId && userId && weekNumber) {
        const optimisticBets: PlacedBet[] = bets.map((bet, betIndex) => {
          const betId = `optimistic:${Date.now()}:${betIndex}`;
          return {
            amount: bet.amount,
            bet_legs: bet.legs.map((leg, legIndex) => ({
              adjusted_line: leg.adjusted_line,
              bet_id: betId,
              game_id: leg.game_id,
              game_start_time: leg.game_start_time,
              id: `${betId}:leg:${legIndex}`,
              leg_odds: leg.leg_odds,
              locked: false,
              market: leg.market,
              original_line: leg.original_line,
              result: 'pending',
              selection: leg.selection,
            })),
            bet_type: bet.bet_type,
            created_at: new Date().toISOString(),
            id: betId,
            league_id: leagueId,
            odds: bet.odds,
            potential_payout: bet.potential_payout,
            profit: null,
            result: 'pending',
            teaser_points: bet.teaser_points,
            user_id: userId,
            week_number: weekNumber,
          };
        });

        queryClient.setQueryData<PlacedBet[]>(queryKey, [...previous, ...optimisticBets]);
      }

      return { previous };
    },
    mutationFn: async (bets: MixedBetSubmission[]) => {
      if (!leagueId || !weekNumber) {
        throw new Error('Choose a league before submitting bets.');
      }

      const { data, error } = await supabase.rpc('submit_bets', {
        p_bets: bets as unknown as Json,
        p_league_id: leagueId,
        p_week_number: weekNumber,
      });

      return assertSupabaseResult(data, error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: straightBetKeys.placed(leagueId, userId, weekNumber),
      });
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(
        straightBetKeys.placed(leagueId, userId, weekNumber),
        context?.previous ?? [],
      );
    },
  });
}

export function useSubmitStraightBetsMutation(
  leagueId: string | undefined,
  userId: string | undefined,
  weekNumber: number | undefined,
) {
  return useSubmitBetsMutation(leagueId, userId, weekNumber);
}
