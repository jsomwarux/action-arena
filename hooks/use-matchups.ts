import { useQuery } from '@tanstack/react-query';

import { MINIMUM_BETS_PER_WEEK } from '@/constants/rules';
import { calculateWeeklyAwards, type WeeklyAwards } from '@/hooks/use-profile-stats';
import { supabase } from '@/lib/supabase';
import type {
  BetWithLegs,
  LeagueMemberRow,
  LeagueRow,
  StandingRow,
  UserRow,
  WeeklyMatchupRow,
} from '@/types/database';

export type { BetWithLegs } from '@/types/database';

export type MatchupPickVisibility = {
  hiddenReason: 'own_card' | 'revealed' | 'hidden_until_kickoff' | 'not_submitted' | 'no_user';
  isSubmitted: boolean;
  isVisible: boolean;
  revealAt: string | null;
  userId: string | null;
};

export type MatchupDetail = {
  awayBets: BetWithLegs[];
  awayPickVisibility: MatchupPickVisibility;
  awayStanding: StandingRow | null;
  awayUser: UserRow | null;
  homeBets: BetWithLegs[];
  homePickVisibility: MatchupPickVisibility;
  homeStanding: StandingRow | null;
  homeUser: UserRow;
  league: LeagueRow;
  matchup: WeeklyMatchupRow;
  revealAt: string | null;
};

export type HomeLeagueCard = {
  betsPlaced: number;
  currentMatchup: WeeklyMatchupRow | null;
  currentStanding: StandingRow | null;
  lastWeekBets: BetWithLegs[];
  lastWeekMatchup: WeeklyMatchupRow | null;
  lastWeekStanding: StandingRow | null;
  league: LeagueRow;
  memberCount: number;
  opponent: UserRow | null;
  thisWeekBets: BetWithLegs[];
  weeklyAwards: WeeklyAwards;
  weeklyProfit: number;
};

export type HomeDashboard = {
  cards: HomeLeagueCard[];
};

const matchupKeys = {
  detail: (matchupId: string | undefined) => ['matchups', 'detail', matchupId] as const,
  home: (userId: string | undefined) => ['home-dashboard', userId] as const,
  userWeek: (
    leagueId: string | undefined,
    userId: string | undefined,
    weekNumber: number | undefined,
  ) => ['matchups', 'user-week', leagueId, userId, weekNumber] as const,
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

function uniqueValues(values: string[]) {
  return [...new Set(values)];
}

function indexUsers(users: UserRow[]) {
  return users.reduce<Record<string, UserRow>>((accumulator, user) => {
    accumulator[user.id] = user;
    return accumulator;
  }, {});
}

function indexStandings(standings: StandingRow[]) {
  return standings.reduce<Record<string, StandingRow>>((accumulator, standing) => {
    accumulator[`${standing.league_id}:${standing.user_id}:${standing.week_number}`] = standing;
    return accumulator;
  }, {});
}

async function fetchUsersByIds(ids: string[]) {
  const userIds = uniqueValues(ids.filter(Boolean));

  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('users').select('*').in('id', userIds);
  return assertSupabaseResult(data as UserRow[] | null, error);
}

async function fetchBetsForUsers({
  leagueId,
  userIds,
  weekNumbers,
}: {
  leagueId: string;
  userIds: string[];
  weekNumbers: number[];
}) {
  const filteredUserIds = uniqueValues(userIds.filter(Boolean));
  const filteredWeeks = uniqueValues(weekNumbers.map(String)).map(Number);

  if (filteredUserIds.length === 0 || filteredWeeks.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('bets')
    .select('*, bet_legs(*)')
    .eq('league_id', leagueId)
    .in('user_id', filteredUserIds)
    .in('week_number', filteredWeeks)
    .order('created_at', { ascending: true });

  return assertSupabaseResult(data as BetWithLegs[] | null, error);
}

function betsForUserWeek(bets: BetWithLegs[], userId: string | null, weekNumber: number) {
  if (!userId) {
    return [];
  }

  return bets.filter((bet) => bet.user_id === userId && bet.week_number === weekNumber);
}

function sumSettledProfit(bets: BetWithLegs[]) {
  return bets.reduce((total, bet) => total + (bet.profit ?? 0), 0);
}

function sortByCreatedAt(bets: BetWithLegs[]) {
  return [...bets].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function normalizeMatchupDetail(data: unknown): MatchupDetail {
  const detail = data as MatchupDetail;
  return {
    ...detail,
    awayBets: sortByCreatedAt(detail.awayBets ?? []),
    homeBets: sortByCreatedAt(detail.homeBets ?? []),
  };
}

export function useMatchupDetail(matchupId: string | undefined) {
  return useQuery({
    enabled: Boolean(matchupId),
    queryFn: async (): Promise<MatchupDetail> => {
      if (!matchupId) {
        throw new Error('Matchup is required.');
      }

      const { data, error } = await supabase.rpc('get_matchup_detail', {
        p_matchup_id: matchupId,
      });

      return normalizeMatchupDetail(assertSupabaseResult(data, error));
    },
    queryKey: matchupKeys.detail(matchupId),
  });
}

export function useUserWeekMatchup(
  leagueId: string | undefined,
  userId: string | undefined,
  weekNumber: number | undefined,
) {
  return useQuery({
    enabled: Boolean(leagueId && userId && weekNumber),
    queryFn: async (): Promise<WeeklyMatchupRow | null> => {
      if (!leagueId || !userId || !weekNumber) {
        return null;
      }

      const { data, error } = await supabase
        .from('weekly_matchups')
        .select('*')
        .eq('league_id', leagueId)
        .eq('week_number', weekNumber)
        .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return (data as WeeklyMatchupRow | null) ?? null;
    },
    queryKey: matchupKeys.userWeek(leagueId, userId, weekNumber),
  });
}

export function useHomeDashboard(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async (): Promise<HomeDashboard> => {
      if (!userId) {
        return { cards: [] };
      }

      const { data: membershipsData, error: membershipsError } = await supabase
        .from('league_members')
        .select('*')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });
      const memberships = assertSupabaseResult(
        membershipsData as LeagueMemberRow[] | null,
        membershipsError,
      );
      const leagueIds = memberships.map((membership) => membership.league_id);

      if (leagueIds.length === 0) {
        return { cards: [] };
      }

      const { data: leaguesData, error: leaguesError } = await supabase
        .from('leagues')
        .select('*')
        .in('id', leagueIds);
      const leagues = assertSupabaseResult(leaguesData as LeagueRow[] | null, leaguesError);
      const weekNumbers = uniqueValues(
        leagues.flatMap((league) => [
          String(league.current_week),
          String(Math.max(1, league.current_week - 1)),
        ]),
      ).map(Number);

      const [membersResult, standingsResult, matchupsResult, betsResult, leagueBetsResult] = await Promise.all([
        supabase.from('league_members').select('*').in('league_id', leagueIds),
        supabase
          .from('standings')
          .select('*')
          .in('league_id', leagueIds)
          .in('week_number', weekNumbers),
        supabase
          .from('weekly_matchups')
          .select('*')
          .in('league_id', leagueIds)
          .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
          .in('week_number', weekNumbers),
        supabase
          .from('bets')
          .select('*, bet_legs(*)')
          .in('league_id', leagueIds)
          .eq('user_id', userId)
          .in('week_number', weekNumbers)
          .order('created_at', { ascending: true }),
        supabase
          .from('bets')
          .select('*, bet_legs(*)')
          .in('league_id', leagueIds)
          .in('week_number', weekNumbers)
          .order('created_at', { ascending: true }),
      ]);

      const members = assertSupabaseResult(membersResult.data as LeagueMemberRow[] | null, membersResult.error);
      const standings = assertSupabaseResult(standingsResult.data as StandingRow[] | null, standingsResult.error);
      const matchups = assertSupabaseResult(matchupsResult.data as WeeklyMatchupRow[] | null, matchupsResult.error);
      const bets = assertSupabaseResult(betsResult.data as BetWithLegs[] | null, betsResult.error);
      const leagueBets = assertSupabaseResult(
        leagueBetsResult.data as BetWithLegs[] | null,
        leagueBetsResult.error,
      );
      const opponentIds = matchups
        .map((matchup) =>
          matchup.home_user_id === userId ? matchup.away_user_id : matchup.home_user_id,
        )
        .filter((id): id is string => Boolean(id));
      const usersById = indexUsers(
        await fetchUsersByIds(uniqueValues([...opponentIds, ...members.map((member) => member.user_id)])),
      );
      const standingsByKey = indexStandings(standings);

      return {
        cards: leagues
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((league) => {
            const currentWeek = league.current_week;
            const lastWeek = Math.max(1, currentWeek - 1);
            const awardsWeek = currentWeek > 1 ? lastWeek : currentWeek;
            const currentMatchup =
              matchups.find(
                (matchup) =>
                  matchup.league_id === league.id && matchup.week_number === currentWeek,
              ) ?? null;
            const lastWeekMatchup =
              matchups.find(
                (matchup) => matchup.league_id === league.id && matchup.week_number === lastWeek,
              ) ?? null;
            const opponentId =
              currentMatchup?.home_user_id === userId
                ? currentMatchup.away_user_id
                : currentMatchup?.home_user_id ?? null;
            const thisWeekBets = sortByCreatedAt(betsForUserWeek(bets, userId, currentWeek));
            const lastWeekBets = sortByCreatedAt(betsForUserWeek(bets, userId, lastWeek));

            return {
              betsPlaced: thisWeekBets.length,
              currentMatchup,
              currentStanding:
                standingsByKey[`${league.id}:${userId}:${currentWeek}`] ?? null,
              lastWeekBets,
              lastWeekMatchup,
              lastWeekStanding: standingsByKey[`${league.id}:${userId}:${lastWeek}`] ?? null,
              league,
              memberCount: members.filter((member) => member.league_id === league.id).length,
              opponent: opponentId ? usersById[opponentId] ?? null : null,
              thisWeekBets,
              weeklyAwards: calculateWeeklyAwards(
                leagueBets.filter(
                  (bet) => bet.league_id === league.id && bet.week_number === awardsWeek,
                ),
                usersById,
                standings.filter(
                  (standing) => standing.league_id === league.id && standing.week_number === awardsWeek,
                ),
              ),
              weeklyProfit: sumSettledProfit(thisWeekBets),
            };
          }),
      };
    },
    queryKey: matchupKeys.home(userId),
  });
}

export function remainingBetsNeeded(betsPlaced: number) {
  return Math.max(0, MINIMUM_BETS_PER_WEEK - betsPlaced);
}
