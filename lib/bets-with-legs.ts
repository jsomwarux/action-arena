import { supabase } from '@/lib/supabase';
import type { BetLegRow, BetRow, BetWithLegs } from '@/types/database';

type FetchBetsWithLegsInput = {
  ascending?: boolean;
  leagueIds: string[];
  userId?: string;
  userIds?: string[];
  weekNumbers?: number[];
};

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

function sortLegs(left: BetLegRow, right: BetLegRow) {
  const timeDelta = Date.parse(left.game_start_time) - Date.parse(right.game_start_time);

  if (Number.isFinite(timeDelta) && timeDelta !== 0) {
    return timeDelta;
  }

  return left.id.localeCompare(right.id);
}

export function mergeBetsWithLegRows(bets: BetRow[], legs: BetLegRow[]): BetWithLegs[] {
  const legsByBetId = new Map<string, BetLegRow[]>();

  legs.forEach((leg) => {
    legsByBetId.set(leg.bet_id, [...(legsByBetId.get(leg.bet_id) ?? []), leg]);
  });

  return bets.map((bet) => ({
    ...bet,
    bet_legs: [...(legsByBetId.get(bet.id) ?? [])].sort(sortLegs),
  })) as BetWithLegs[];
}

export async function fetchBetsWithLegs({
  ascending = false,
  leagueIds,
  userId,
  userIds,
  weekNumbers,
}: FetchBetsWithLegsInput): Promise<BetWithLegs[]> {
  const filteredLeagueIds = uniqueValues(leagueIds.filter(Boolean));

  if (filteredLeagueIds.length === 0) {
    return [];
  }

  let betsQuery = supabase
    .from('bets')
    .select('*')
    .in('league_id', filteredLeagueIds)
    .order('created_at', { ascending });

  if (userId) {
    betsQuery = betsQuery.eq('user_id', userId);
  } else if (userIds && userIds.length > 0) {
    betsQuery = betsQuery.in('user_id', uniqueValues(userIds.filter(Boolean)));
  }

  if (weekNumbers && weekNumbers.length > 0) {
    betsQuery = betsQuery.in('week_number', uniqueValues(weekNumbers));
  }

  const { data: betData, error: betError } = await betsQuery;

  if (betError) {
    throw new Error(betError.message);
  }

  const bets = (betData ?? []) as BetRow[];
  const betIds = bets.map((bet) => bet.id);

  if (betIds.length === 0) {
    return [];
  }

  const { data: legData, error: legError } = await supabase
    .from('bet_legs')
    .select('*')
    .in('bet_id', betIds);

  if (legError) {
    throw new Error(legError.message);
  }

  return mergeBetsWithLegRows(bets, (legData ?? []) as BetLegRow[]);
}
