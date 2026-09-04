import { useQuery } from '@tanstack/react-query';

import { PUBLIC_USER_SELECT } from '@/constants/public-user-select';
import {
  getLeagueMemberPrimaryName,
  indexLeagueMembersByUserId,
} from '@/lib/league-member-display';
import { supabase } from '@/lib/supabase';
import type {
  LeagueMemberRow,
  LeagueRow,
  StandingRow,
  UserRow,
  WeeklyMatchupRow,
} from '@/types/database';

/**
 * One row per league the player belongs to, describing where that league's
 * current week stands for them.
 *
 * The matchups index has no mobile counterpart — on a phone the home dashboard
 * fills this role. It exists on desktop because the sidebar points at
 * /matchups, and because a second monitor can hold every league at once.
 *
 * Profits come from the same two places the detail screen reads: the settled
 * numbers written onto `weekly_matchups`, falling back to the live
 * `standings.weekly_profit` while a week is still running.
 */
export type CurrentWeekMatchupCard = {
  awayName: string;
  awayProfit: number;
  awayUserId: string | null;
  homeName: string;
  homeProfit: number;
  homeUserId: string | null;
  league: LeagueRow;
  matchup: WeeklyMatchupRow | null;
  memberCount: number;
  opponentUserId: string | null;
  picksPlaced: number;
  viewerIsHome: boolean;
  viewerProfit: number;
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
  return [...new Set(values.filter(Boolean))];
}

export function useCurrentWeekMatchups(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async (): Promise<CurrentWeekMatchupCard[]> => {
      if (!userId) {
        return [];
      }

      const { data: membershipData, error: membershipError } = await supabase
        .from('league_members')
        .select('*')
        .eq('user_id', userId);
      const memberships = assertSupabaseResult(
        membershipData as LeagueMemberRow[] | null,
        membershipError,
      );
      const leagueIds = uniqueValues(memberships.map((membership) => membership.league_id));

      if (leagueIds.length === 0) {
        return [];
      }

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .in('id', leagueIds);
      const leagues = assertSupabaseResult(leagueData as LeagueRow[] | null, leagueError);
      const weekNumbers = [...new Set(leagues.map((league) => league.current_week))];

      const [membersResult, matchupsResult, standingsResult, betsResult] = await Promise.all([
        supabase.from('league_members').select('*').in('league_id', leagueIds),
        supabase
          .from('weekly_matchups')
          .select('*')
          .in('league_id', leagueIds)
          .in('week_number', weekNumbers)
          .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`),
        supabase
          .from('standings')
          .select('*')
          .in('league_id', leagueIds)
          .in('week_number', weekNumbers),
        supabase
          .from('bets')
          .select('id,league_id,week_number,user_id')
          .eq('user_id', userId)
          .in('league_id', leagueIds)
          .in('week_number', weekNumbers),
      ]);

      const members = assertSupabaseResult(
        membersResult.data as LeagueMemberRow[] | null,
        membersResult.error,
      );
      const matchups = assertSupabaseResult(
        matchupsResult.data as WeeklyMatchupRow[] | null,
        matchupsResult.error,
      );
      const standings = assertSupabaseResult(
        standingsResult.data as StandingRow[] | null,
        standingsResult.error,
      );
      const bets = assertSupabaseResult(
        betsResult.data as { id: string; league_id: string; user_id: string; week_number: number }[] | null,
        betsResult.error,
      );

      const profileIds = uniqueValues(members.map((member) => member.user_id));
      const { data: profileData, error: profileError } =
        profileIds.length > 0
          ? await supabase.from('users').select(PUBLIC_USER_SELECT).in('id', profileIds)
          : { data: [] as UserRow[], error: null };
      const profiles = assertSupabaseResult(profileData as UserRow[] | null, profileError);
      const profilesById = profiles.reduce<Record<string, UserRow>>((accumulator, profile) => {
        accumulator[profile.id] = profile;
        return accumulator;
      }, {});

      const standingFor = (leagueId: string, week: number, forUserId: string | null) =>
        forUserId
          ? standings.find(
              (standing) =>
                standing.league_id === leagueId &&
                standing.week_number === week &&
                standing.user_id === forUserId,
            ) ?? null
          : null;

      return leagues
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((league) => {
          const week = league.current_week;
          const leagueMembers = members.filter((member) => member.league_id === league.id);
          const membersByUserId = indexLeagueMembersByUserId(leagueMembers);
          const matchup =
            matchups.find(
              (candidate) =>
                candidate.league_id === league.id && candidate.week_number === week,
            ) ?? null;
          const homeUserId = matchup?.home_user_id ?? null;
          const awayUserId = matchup?.away_user_id ?? null;
          const viewerIsHome = homeUserId === userId;
          const opponentUserId = viewerIsHome ? awayUserId : homeUserId;
          const homeProfit =
            matchup?.home_profit ?? standingFor(league.id, week, homeUserId)?.weekly_profit ?? 0;
          const awayProfit =
            matchup?.away_profit ?? standingFor(league.id, week, awayUserId)?.weekly_profit ?? 0;
          const nameFor = (forUserId: string | null, fallback: string) =>
            forUserId
              ? getLeagueMemberPrimaryName(
                  membersByUserId[forUserId],
                  profilesById[forUserId],
                  fallback,
                )
              : fallback;

          return {
            awayName: nameFor(awayUserId, matchup ? 'Bye Week' : 'Away'),
            awayProfit,
            awayUserId,
            homeName: nameFor(homeUserId, 'Home'),
            homeProfit,
            homeUserId,
            league,
            matchup,
            memberCount: leagueMembers.length,
            opponentUserId,
            picksPlaced: bets.filter(
              (bet) => bet.league_id === league.id && bet.week_number === week,
            ).length,
            viewerIsHome,
            viewerProfit: viewerIsHome ? homeProfit : awayProfit,
          };
        });
    },
    queryKey: ['matchups', 'current-week-index', userId] as const,
  });
}
