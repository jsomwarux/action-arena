import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PUBLIC_USER_SELECT } from '@/constants/public-user-select';
import { logAnalyticsEvent } from '@/lib/analytics';
import { TEAM_NAME_MAX_LENGTH } from '@/lib/league-member-display';
import { isPublicBrowseEligibleLeague } from '@/lib/league-settings';
import { supabase } from '@/lib/supabase';
import type {
  LeagueMemberRow,
  LeagueRow,
  LeagueSport,
  LeagueType,
  LeagueVisibility,
  SeasonRow,
  StandingRow,
  UserRow,
  WeeklyMatchupRow,
} from '@/types/database';

export type CreateLeagueInput = {
  maxMembers: number;
  name: string;
  sport: LeagueSport;
  type: LeagueType;
  visibility: LeagueVisibility;
};

export const LEAGUE_NAME_MAX_LENGTH = 50;
export const LEAGUE_NAME_MIN_LENGTH = 2;

export function getLeagueNameValidationError(name: string) {
  const trimmedName = name.trim();

  if (trimmedName.length < LEAGUE_NAME_MIN_LENGTH) {
    return `League name needs at least ${LEAGUE_NAME_MIN_LENGTH} characters.`;
  }

  if (trimmedName.length > LEAGUE_NAME_MAX_LENGTH) {
    return `League name must be ${LEAGUE_NAME_MAX_LENGTH} characters or fewer.`;
  }

  return undefined;
}

export type UpdateLeagueTeamNameInput = {
  leagueId: string;
  teamName: string;
  userId: string;
};

export type LeagueSummary = {
  currentUserStanding: StandingRow | null;
  league: LeagueRow;
  memberCount: number;
};

export type PublicLeagueSummary = {
  commissioner: UserRow | null;
  league: LeagueRow;
  memberCount: number;
};

export type LeagueDetail = {
  currentUserMatchup: WeeklyMatchupRow | null;
  currentWeekRevealAt: string | null;
  league: LeagueRow;
  matchups: WeeklyMatchupRow[];
  members: LeagueMemberRow[];
  profilesById: Record<string, UserRow>;
  seasonSnapshot: SeasonRow | null;
  seasonFirstKickoffAt: string | null;
  standings: StandingRow[];
};

const leagueKeys = {
  detail: (leagueId: string) => ['leagues', 'detail', leagueId] as const,
  mine: (userId: string | undefined) => ['leagues', 'mine', userId] as const,
  public: (search: string) => ['leagues', 'public', search] as const,
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

function latestStandingForLeague(standings: StandingRow[], league: LeagueRow) {
  return (
    standings.find(
      (standing) =>
        standing.league_id === league.id && standing.week_number === league.current_week,
    ) ??
    standings
      .filter((standing) => standing.league_id === league.id)
      .sort((left, right) => right.week_number - left.week_number)[0] ??
    null
  );
}

async function fetchRowsByIds<T extends { id: string }>(
  table: 'leagues' | 'users',
  ids: string[],
) {
  if (ids.length === 0) {
    return [];
  }

  const columns = table === 'users' ? PUBLIC_USER_SELECT : '*';
  const { data, error } = await supabase.from(table).select(columns).in('id', uniqueValues(ids));
  return assertSupabaseResult(data as T[] | null, error);
}

export function useMyLeagues(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async (): Promise<LeagueSummary[]> => {
      if (!userId) {
        return [];
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from('league_members')
        .select('*')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });

      const leagueMemberships = assertSupabaseResult(memberships, membershipsError);
      const leagueIds = leagueMemberships.map((membership) => membership.league_id);

      if (leagueIds.length === 0) {
        return [];
      }

      const [leagues, allMembers, standings] = await Promise.all([
        fetchRowsByIds<LeagueRow>('leagues', leagueIds),
        supabase.from('league_members').select('*').in('league_id', leagueIds),
        supabase.from('standings').select('*').eq('user_id', userId).in('league_id', leagueIds),
      ]);

      const memberRows = assertSupabaseResult(allMembers.data, allMembers.error);
      const standingRows = assertSupabaseResult(standings.data, standings.error);

      return leagues
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map((league) => ({
          currentUserStanding: latestStandingForLeague(standingRows, league),
          league,
          memberCount: memberRows.filter((member) => member.league_id === league.id).length,
        }));
    },
    queryKey: leagueKeys.mine(userId),
  });
}

export function usePublicLeagues(search: string) {
  return useQuery({
    queryFn: async (): Promise<PublicLeagueSummary[]> => {
      let query = supabase
        .from('leagues')
        .select('*')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(100);

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      const { data: leagues, error } = await query;
      const publicLeagues = assertSupabaseResult(leagues, error)
        .filter(isPublicBrowseEligibleLeague)
        .slice(0, 50);
      const leagueIds = publicLeagues.map((league) => league.id);
      const commissionerIds = publicLeagues.map((league) => league.commissioner_id);

      const [members, commissioners] = await Promise.all([
        leagueIds.length > 0
          ? supabase.rpc('public_league_member_counts', { p_league_ids: leagueIds })
          : Promise.resolve({ data: [], error: null }),
        fetchRowsByIds<UserRow>('users', commissionerIds),
      ]);

      const memberRows = assertSupabaseResult(
        members.data as { league_id: string; member_count: number }[] | null,
        members.error,
      );
      const commissionerById = indexUsers(commissioners);

      return publicLeagues.map((league) => ({
        commissioner: commissionerById[league.commissioner_id] ?? null,
        league,
        memberCount: memberRows.find((member) => member.league_id === league.id)?.member_count ?? 0,
      }));
    },
    queryKey: leagueKeys.public(search.trim()),
  });
}

export function useLeagueDetail(leagueId: string | undefined, userId: string | undefined) {
  return useQuery({
    enabled: Boolean(leagueId && userId),
    queryFn: async (): Promise<LeagueDetail> => {
      if (!leagueId || !userId) {
        throw new Error('League and user are required.');
      }

      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single();
      const leagueRow = assertSupabaseResult(league, leagueError);

      const [
        membersResult,
        standingsResult,
        matchupsResult,
        seasonResult,
        revealTimeResult,
        seasonFirstKickoffResult,
      ] = await Promise.all([
        supabase.from('league_members').select('*').eq('league_id', leagueId).order('joined_at'),
        supabase
          .from('standings')
          .select('*')
          .eq('league_id', leagueId)
          .lte('week_number', leagueRow.current_week)
          .order('week_number', { ascending: true })
          .order('rank'),
        supabase
          .from('weekly_matchups')
          .select('*')
          .eq('league_id', leagueId)
          .order('week_number'),
        supabase
          .from('seasons')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season_year', leagueRow.season_year)
          .maybeSingle(),
        supabase.rpc('league_week_reveal_time', {
          p_league_id: leagueId,
          p_week_number: leagueRow.current_week,
        }),
        supabase
          .from('league_week_slate_games')
          .select('commence_time')
          .eq('league_id', leagueId)
          .order('commence_time', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      const members = assertSupabaseResult(membersResult.data, membersResult.error);
      const activeMemberIds = new Set(members.map((member) => member.user_id));
      const standings = assertSupabaseResult(standingsResult.data, standingsResult.error).filter(
        (standing) => activeMemberIds.has(standing.user_id),
      );
      const matchups = assertSupabaseResult(matchupsResult.data, matchupsResult.error);
      if (seasonResult.error) {
        throw new Error(seasonResult.error.message);
      }
      if (revealTimeResult.error) {
        throw new Error(revealTimeResult.error.message);
      }
      if (seasonFirstKickoffResult.error) {
        throw new Error(seasonFirstKickoffResult.error.message);
      }

      const profileIds = uniqueValues([
        leagueRow.commissioner_id,
        ...members.map((member) => member.user_id),
        ...matchups.flatMap((matchup) =>
          matchup.away_user_id
            ? [matchup.home_user_id, matchup.away_user_id]
            : [matchup.home_user_id],
        ),
      ]);
      const profiles = await fetchRowsByIds<UserRow>('users', profileIds);

      return {
        currentUserMatchup:
          matchups.find(
            (matchup) =>
              matchup.week_number === leagueRow.current_week &&
              (matchup.home_user_id === userId || matchup.away_user_id === userId),
          ) ?? null,
        currentWeekRevealAt: revealTimeResult.data ?? null,
        league: leagueRow,
        matchups,
        members,
        profilesById: indexUsers(profiles),
        seasonSnapshot: (seasonResult.data as SeasonRow | null) ?? null,
        seasonFirstKickoffAt: seasonFirstKickoffResult.data?.commence_time ?? null,
        standings,
      };
    },
    queryKey: leagueKeys.detail(leagueId ?? ''),
  });
}

export function useCreateLeagueMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLeagueInput) => {
      const nameError = getLeagueNameValidationError(input.name);

      if (nameError) {
        throw new Error(nameError);
      }

      const { data, error } = await supabase.rpc('create_league', {
        p_max_members: input.maxMembers,
        p_name: input.name.trim(),
        p_sport: input.sport,
        p_type: input.type,
        p_visibility: input.visibility,
      });

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (leagueId) => {
      logAnalyticsEvent('league_created', {
        league_id: leagueId,
        user_id: userId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leagueKeys.mine(userId) }),
        queryClient.invalidateQueries({ queryKey: leagueKeys.public('') }),
        queryClient.invalidateQueries({ queryKey: leagueKeys.detail(leagueId) }),
      ]);
    },
  });
}

export function useJoinLeagueMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { inviteCode?: string; leagueId?: string }) => {
      if (input.inviteCode) {
        const { data, error } = await supabase.rpc('join_league_by_invite_code', {
          p_invite_code: input.inviteCode.trim().toUpperCase(),
        });
        return assertSupabaseResult(data, error);
      }

      if (input.leagueId) {
        const { data, error } = await supabase.rpc('join_league', {
          p_league_id: input.leagueId,
        });
        return assertSupabaseResult(data, error);
      }

      throw new Error('Choose a league or enter an invite code.');
    },
    onSuccess: async (leagueId) => {
      logAnalyticsEvent('league_joined', {
        league_id: leagueId,
        user_id: userId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leagueKeys.mine(userId) }),
        queryClient.invalidateQueries({ queryKey: leagueKeys.public('') }),
        queryClient.invalidateQueries({ queryKey: leagueKeys.detail(leagueId) }),
      ]);
    },
  });
}

export function useUpdateLeagueTeamNameMutation(viewerUserId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateLeagueTeamNameInput) => {
      const trimmedTeamName = input.teamName.trim();

      if (!trimmedTeamName) {
        throw new Error('Team name is required.');
      }

      if (trimmedTeamName.length > TEAM_NAME_MAX_LENGTH) {
        throw new Error(`Team name must be ${TEAM_NAME_MAX_LENGTH} characters or fewer.`);
      }

      const { data, error } = await supabase
        .from('league_members')
        .update({ team_name: trimmedTeamName })
        .eq('league_id', input.leagueId)
        .eq('user_id', input.userId)
        .select('*')
        .single();

      return assertSupabaseResult(data as LeagueMemberRow | null, error);
    },
    onMutate: async (input) => {
      const trimmedTeamName = input.teamName.trim();
      const detailKey = leagueKeys.detail(input.leagueId);

      await queryClient.cancelQueries({ queryKey: detailKey });
      const previousDetail = queryClient.getQueryData<LeagueDetail>(detailKey);

      queryClient.setQueryData<LeagueDetail>(detailKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          members: current.members.map((member) =>
            member.user_id === input.userId
              ? { ...member, team_name: trimmedTeamName }
              : member,
          ),
        };
      });

      return { detailKey, previousDetail };
    },
    onError: (_error, _input, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
    },
    onSuccess: async (_member, input) => {
      logAnalyticsEvent('league_team_name_updated', {
        league_id: input.leagueId,
        user_id: input.userId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leagueKeys.detail(input.leagueId) }),
        queryClient.invalidateQueries({ queryKey: leagueKeys.mine(viewerUserId) }),
        queryClient.invalidateQueries({ queryKey: ['home-dashboard', viewerUserId] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard', viewerUserId] }),
        queryClient.invalidateQueries({ queryKey: ['matchups'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['weekly-awards', input.leagueId] }),
      ]);
    },
  });
}

export function useGenerateScheduleMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leagueId: string) => {
      if (!userId) {
        throw new Error('You must be signed in to generate a schedule.');
      }

      const { data, error } = await supabase.rpc('activate_league_and_generate_schedule', {
        p_league_id: leagueId,
      });

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (_, leagueId) => {
      logAnalyticsEvent('league_schedule_generated', {
        league_id: leagueId,
        user_id: userId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leagueKeys.detail(leagueId) }),
        queryClient.invalidateQueries({ queryKey: leagueKeys.mine(userId) }),
        queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] }),
      ]);
    },
    onError: (error, leagueId) => {
      if (__DEV__) {
        console.error('[league_schedule_generation_failed]', {
          error: error instanceof Error ? error.message : String(error),
          league_id: leagueId,
          user_id: userId,
        });
      }
    },
  });
}

export function useLeaveLeagueMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leagueId: string) => {
      if (!userId) {
        throw new Error('You must be signed in to leave a league.');
      }

      const { error } = await supabase
        .from('league_members')
        .delete()
        .eq('league_id', leagueId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }

      return leagueId;
    },
    onSuccess: async (leagueId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leagueKeys.mine(userId) }),
        queryClient.invalidateQueries({ queryKey: leagueKeys.detail(leagueId) }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard', userId] }),
        queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] }),
      ]);
    },
  });
}
