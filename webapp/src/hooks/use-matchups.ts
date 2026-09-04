import { useQuery } from '@tanstack/react-query';

import { PUBLIC_USER_SELECT } from '@/constants/public-user-select';
import { MINIMUM_BETS_PER_WEEK } from '@/constants/rules';
import { calculateWeeklyAwards, type WeeklyAwards } from '@/hooks/use-profile-stats';
import {
  getLeagueMemberPrimaryName,
  getLeagueMemberSecondaryName,
  indexLeagueMembersByUserId,
} from '@/lib/league-member-display';
import { fetchBetsWithLegs } from '@/lib/bets-with-legs';
import { sumSettledProfit } from '@/lib/settled-bets';
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
  awayMember: LeagueMemberRow | null;
  awayPickVisibility: MatchupPickVisibility;
  awayStanding: StandingRow | null;
  awayUser: UserRow | null;
  homeBets: BetWithLegs[];
  homeMember: LeagueMemberRow | null;
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
  opponentLabel: string;
  opponentSecondaryLabel: string | null;
  thisWeekBets: BetWithLegs[];
  viewerLabel: string;
  viewerSecondaryLabel: string | null;
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

  const { data, error } = await supabase.from('users').select(PUBLIC_USER_SELECT).in('id', userIds);
  return assertSupabaseResult(data as UserRow[] | null, error);
}

function betsForUserWeek(
  bets: BetWithLegs[],
  leagueId: string,
  userId: string | null,
  weekNumber: number,
) {
  if (!userId) {
    return [];
  }

  return bets.filter(
    (bet) =>
      bet.league_id === leagueId && bet.user_id === userId && bet.week_number === weekNumber,
  );
}

function sortByCreatedAt(bets: BetWithLegs[]) {
  return [...bets].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function normalizeMatchupDetail(data: unknown): MatchupDetail {
  const detail = data as MatchupDetail;
  return {
    ...detail,
    awayBets: sortByCreatedAt(detail.awayBets ?? []),
    awayMember: detail.awayMember ?? null,
    homeBets: sortByCreatedAt(detail.homeBets ?? []),
    homeMember: detail.homeMember ?? null,
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

      const detail = normalizeMatchupDetail(assertSupabaseResult(data, error));
      const memberIds = uniqueValues(
        [detail.matchup.home_user_id, detail.matchup.away_user_id].filter(
          (id): id is string => Boolean(id),
        ),
      );
      const { data: memberData, error: memberError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', detail.league.id)
        .in('user_id', memberIds);
      const members = assertSupabaseResult(memberData as LeagueMemberRow[] | null, memberError);
      const membersById = indexLeagueMembersByUserId(members);

      return {
        ...detail,
        awayMember: detail.matchup.away_user_id
          ? membersById[detail.matchup.away_user_id] ?? null
          : null,
        homeMember: membersById[detail.matchup.home_user_id] ?? detail.homeMember ?? null,
      };
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

      const [membersResult, standingsResult, matchupsResult, bets, leagueBets] = await Promise.all([
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
        fetchBetsWithLegs({ ascending: true, leagueIds, userId, weekNumbers }),
        fetchBetsWithLegs({ ascending: true, leagueIds, weekNumbers }),
      ]);

      const members = assertSupabaseResult(membersResult.data as LeagueMemberRow[] | null, membersResult.error);
      const standings = assertSupabaseResult(standingsResult.data as StandingRow[] | null, standingsResult.error);
      const matchups = assertSupabaseResult(matchupsResult.data as WeeklyMatchupRow[] | null, matchupsResult.error);
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
            const leagueMembers = members.filter((member) => member.league_id === league.id);
            const leagueMembersById = indexLeagueMembersByUserId(leagueMembers);
            const viewerMembership = leagueMembers.find((member) => member.user_id === userId);
            const opponentMembership = opponentId ? leagueMembersById[opponentId] : undefined;
            const opponentUser = opponentId ? usersById[opponentId] ?? null : null;
            const thisWeekBets = sortByCreatedAt(
              betsForUserWeek(bets, league.id, userId, currentWeek),
            );
            const lastWeekBets = sortByCreatedAt(
              betsForUserWeek(bets, league.id, userId, lastWeek),
            );

            return {
              betsPlaced: thisWeekBets.length,
              currentMatchup,
              currentStanding:
                standingsByKey[`${league.id}:${userId}:${currentWeek}`] ?? null,
              lastWeekBets,
              lastWeekMatchup,
              lastWeekStanding: standingsByKey[`${league.id}:${userId}:${lastWeek}`] ?? null,
              league,
              memberCount: leagueMembers.length,
              opponent: opponentUser,
              opponentLabel: opponentId
                ? getLeagueMemberPrimaryName(opponentMembership, opponentUser, 'Opponent')
                : currentMatchup
                  ? 'Bye Week'
                  : 'Schedule Pending',
              opponentSecondaryLabel: opponentId
                ? getLeagueMemberSecondaryName(opponentMembership, opponentUser)
                : null,
              thisWeekBets,
              viewerLabel: getLeagueMemberPrimaryName(viewerMembership, usersById[userId], 'You'),
              viewerSecondaryLabel: getLeagueMemberSecondaryName(viewerMembership, usersById[userId]),
              weeklyAwards: calculateWeeklyAwards(
                leagueBets.filter(
                  (bet) => bet.league_id === league.id && bet.week_number === awardsWeek,
                ),
                usersById,
                standings.filter(
                  (standing) => standing.league_id === league.id && standing.week_number === awardsWeek,
                ),
                leagueMembersById,
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
