import { useQuery } from '@tanstack/react-query';

import { WEEKLY_BUDGET } from '@/constants/rules';
import { supabase } from '@/lib/supabase';
import type {
  AchievementKey,
  BetResult,
  BetType,
  Json,
  LeagueMemberRow,
  LeagueRow,
  StandingRow,
  TeaserPoints,
  UserAchievementInsert,
  UserAchievementRow,
  UserRow,
  WeeklyMatchupRow,
  BetWithLegs,
} from '@/types/database';

export type LeagueOption = {
  id: string;
  label: string;
};

export type ProfileStats = {
  averageProfitPerBet: number;
  currentStreak: string;
  losses: number;
  roi: number;
  ties: number;
  totalAmount: number;
  totalProfit: number;
  totalSettledBets: number;
  winRate: number;
  wins: number;
};

export type BetTypeBreakdown = {
  averageLegs: number;
  hitRate: number;
  profit: number;
  record: string;
  total: number;
  type: BetType;
  winRate: number;
};

export type TeaserPointBreakdown = {
  points: TeaserPoints;
  record: string;
  total: number;
};

export type AchievementDefinition = {
  description: string;
  key: AchievementKey;
  title: string;
};

export type AchievementDisplay = AchievementDefinition & {
  earned: boolean;
  earnedAt: string | null;
};

export type ProfileSummary = {
  achievements: AchievementDisplay[];
  bestBet: BetWithLegs | null;
  betTypeBreakdowns: BetTypeBreakdown[];
  bets: BetWithLegs[];
  latestStanding: StandingRow | null;
  stats: ProfileStats;
  teaserBreakdowns: TeaserPointBreakdown[];
  weeklyProfits: { profit: number; week: number }[];
  worstBet: BetWithLegs | null;
};

export type MemberComparison = {
  h2hLosses: number;
  h2hTies: number;
  h2hWins: number;
  targetStats: ProfileStats;
  viewerStats: ProfileStats;
};

export type ProfileData = {
  achievements: UserAchievementRow[];
  bets: BetWithLegs[];
  leagueOptions: LeagueOption[];
  leagues: LeagueRow[];
  memberships: LeagueMemberRow[];
  profile: UserRow;
  standings: StandingRow[];
  targetMatchups: WeeklyMatchupRow[];
  viewerBets: BetWithLegs[];
  viewerMatchups: WeeklyMatchupRow[];
  viewerStandings: StandingRow[];
};

export type LeaderboardRow = {
  member: LeagueMemberRow;
  profile: UserRow | null;
  standing: StandingRow | null;
  trend: 'down' | 'same' | 'up';
};

export type LeaderboardData = {
  leagueOptions: LeagueOption[];
  leagues: LeagueRow[];
  rows: LeaderboardRow[];
};

export type WeeklyAward = {
  bet: BetWithLegs | null;
  label: string;
  profit: number;
  roi: number;
  user: UserRow | null;
};

export type WeeklyAwards = {
  degen: WeeklyAward | null;
  lock: WeeklyAward | null;
  sharpest: WeeklyAward | null;
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    description: 'Win five settled bets in a row.',
    key: 'hot_streak',
    title: 'Hot Streak',
  },
  {
    description: 'Win a bet at +300 or longer.',
    key: 'underdog_hunter',
    title: 'Underdog Hunter',
  },
  {
    description: 'Win every settled bet in a single week.',
    key: 'perfect_week',
    title: 'Perfect Week',
  },
  {
    description: 'Post positive weekly profit five weeks in a row.',
    key: 'budget_master',
    title: 'Budget Master',
  },
  {
    description: 'Hit a parlay with four or more legs.',
    key: 'parlay_king',
    title: 'Parlay King',
  },
  {
    description: 'Hit three teasers in one week.',
    key: 'teaser_genius',
    title: 'Teaser Genius',
  },
];

const profileKeys = {
  awards: (leagueId: string | undefined, weekNumber: number | undefined) =>
    ['weekly-awards', leagueId, weekNumber] as const,
  leaderboard: (userId: string | undefined, leagueId: string | undefined) =>
    ['leaderboard', userId, leagueId] as const,
  profile: (
    viewerUserId: string | undefined,
    targetUserId: string | undefined,
    leagueId: string | undefined,
  ) => ['profile-stats', viewerUserId, targetUserId, leagueId] as const,
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

function latestStanding(standings: StandingRow[]) {
  return [...standings].sort((left, right) => right.week_number - left.week_number)[0] ?? null;
}

function settledBets(bets: BetWithLegs[]) {
  return bets.filter((bet) => bet.result !== 'pending' && bet.profit !== null);
}

function recordFromBets(bets: BetWithLegs[]) {
  const wins = bets.filter((bet) => bet.result === 'win').length;
  const losses = bets.filter((bet) => bet.result === 'loss').length;
  const pushes = bets.filter((bet) => bet.result === 'push').length;
  return `${wins}-${losses}${pushes > 0 ? `-${pushes}` : ''}`;
}

function currentBetStreak(bets: BetWithLegs[]) {
  const ordered = [...settledBets(bets)].sort((left, right) => right.created_at.localeCompare(left.created_at));
  const first = ordered[0];

  if (!first || first.result === 'push') {
    return 'No streak';
  }

  let count = 0;

  for (const bet of ordered) {
    if (bet.result !== first.result) {
      break;
    }

    count += 1;
  }

  return `${count}${first.result === 'win' ? 'W' : 'L'}`;
}

function weeklyProfitMap(bets: BetWithLegs[]) {
  const weeks = new Map<number, number>();

  settledBets(bets).forEach((bet) => {
    weeks.set(bet.week_number, (weeks.get(bet.week_number) ?? 0) + (bet.profit ?? 0));
  });

  return [...weeks.entries()]
    .map(([week, profit]) => ({ profit, week }))
    .sort((left, right) => left.week - right.week);
}

export function calculateProfileStats(bets: BetWithLegs[], standings: StandingRow[]): ProfileStats {
  const settled = settledBets(bets);
  const totalProfit = settled.reduce((sum, bet) => sum + (bet.profit ?? 0), 0);
  const totalAmount = settled.reduce((sum, bet) => sum + bet.amount, 0);
  const latest = latestStanding(standings);
  const wins = latest?.wins ?? 0;
  const losses = latest?.losses ?? 0;
  const ties = latest?.ties ?? 0;
  const wonBets = settled.filter((bet) => bet.result === 'win').length;
  const decisiveBets = settled.filter((bet) => bet.result === 'win' || bet.result === 'loss').length;

  return {
    averageProfitPerBet: settled.length > 0 ? totalProfit / settled.length : 0,
    currentStreak: currentBetStreak(bets),
    losses,
    roi: totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0,
    ties,
    totalAmount,
    totalProfit,
    totalSettledBets: settled.length,
    winRate: decisiveBets > 0 ? (wonBets / decisiveBets) * 100 : 0,
    wins,
  };
}

export function calculateBetTypeBreakdowns(bets: BetWithLegs[]): BetTypeBreakdown[] {
  const types: BetType[] = ['straight', 'parlay', 'teaser'];

  return types.map((type) => {
    const typeBets = settledBets(bets).filter((bet) => bet.bet_type === type);
    const wins = typeBets.filter((bet) => bet.result === 'win').length;
    const losses = typeBets.filter((bet) => bet.result === 'loss').length;
    const pushes = typeBets.filter((bet) => bet.result === 'push').length;
    const decisive = wins + losses;
    const profit = typeBets.reduce((sum, bet) => sum + (bet.profit ?? 0), 0);
    const averageLegs =
      typeBets.length > 0
        ? typeBets.reduce((sum, bet) => sum + bet.bet_legs.length, 0) / typeBets.length
        : 0;

    return {
      averageLegs,
      hitRate: type === 'parlay' ? (decisive > 0 ? (wins / decisive) * 100 : 0) : 0,
      profit,
      record: `${wins}-${losses}${pushes > 0 ? `-${pushes}` : ''}`,
      total: typeBets.length,
      type,
      winRate: decisive > 0 ? (wins / decisive) * 100 : 0,
    };
  });
}

export function calculateTeaserBreakdowns(bets: BetWithLegs[]): TeaserPointBreakdown[] {
  const points: TeaserPoints[] = [6, 6.5, 7];

  return points.map((point) => {
    const teaserBets = settledBets(bets).filter(
      (bet) => bet.bet_type === 'teaser' && bet.teaser_points === point,
    );

    return {
      points: point,
      record: recordFromBets(teaserBets),
      total: teaserBets.length,
    };
  });
}

function achievementKeysForBets(bets: BetWithLegs[]) {
  const earned = new Set<AchievementKey>();
  const ordered = [...settledBets(bets)].sort((left, right) => left.created_at.localeCompare(right.created_at));
  let streak = 0;

  ordered.forEach((bet) => {
    streak = bet.result === 'win' ? streak + 1 : bet.result === 'loss' ? 0 : streak;
    if (streak >= 5) {
      earned.add('hot_streak');
    }

    if (bet.result === 'win' && bet.odds >= 300) {
      earned.add('underdog_hunter');
    }

    if (bet.result === 'win' && bet.bet_type === 'parlay' && bet.bet_legs.length >= 4) {
      earned.add('parlay_king');
    }
  });

  const byWeek = new Map<number, BetWithLegs[]>();

  settledBets(bets).forEach((bet) => {
    byWeek.set(bet.week_number, [...(byWeek.get(bet.week_number) ?? []), bet]);
  });

  byWeek.forEach((weekBets) => {
    if (weekBets.length >= 5 && weekBets.every((bet) => bet.result === 'win')) {
      earned.add('perfect_week');
    }

    if (weekBets.filter((bet) => bet.bet_type === 'teaser' && bet.result === 'win').length >= 3) {
      earned.add('teaser_genius');
    }
  });

  const weeklyProfits = weeklyProfitMap(bets);
  let positiveWeeks = 0;

  weeklyProfits.forEach((week) => {
    positiveWeeks = week.profit > 0 ? positiveWeeks + 1 : 0;
    if (positiveWeeks >= 5) {
      earned.add('budget_master');
    }
  });

  return earned;
}

export function buildAchievements(
  bets: BetWithLegs[],
  storedAchievements: UserAchievementRow[],
): AchievementDisplay[] {
  const earnedKeys = achievementKeysForBets(bets);
  storedAchievements.forEach((achievement) => earnedKeys.add(achievement.achievement_key));

  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const stored = storedAchievements.find((achievement) => achievement.achievement_key === definition.key);
    return {
      ...definition,
      earned: earnedKeys.has(definition.key),
      earnedAt: stored?.earned_at ?? null,
    };
  });
}

export function buildProfileSummary(
  data: ProfileData,
  selectedLeagueId: string | 'all',
): ProfileSummary {
  const leagueIds =
    selectedLeagueId === 'all' ? data.leagues.map((league) => league.id) : [selectedLeagueId];
  const bets = data.bets.filter((bet) => leagueIds.includes(bet.league_id));
  const standings = data.standings.filter((standing) => leagueIds.includes(standing.league_id));
  const achievements = data.achievements.filter((achievement) => leagueIds.includes(achievement.league_id));
  const settled = settledBets(bets);

  return {
    achievements: buildAchievements(bets, achievements),
    bestBet:
      [...settled].sort((left, right) => (right.profit ?? 0) - (left.profit ?? 0))[0] ?? null,
    betTypeBreakdowns: calculateBetTypeBreakdowns(bets),
    bets,
    latestStanding: latestStanding(standings),
    stats: calculateProfileStats(bets, standings),
    teaserBreakdowns: calculateTeaserBreakdowns(bets),
    weeklyProfits: weeklyProfitMap(bets),
    worstBet:
      [...settled].sort((left, right) => (left.profit ?? 0) - (right.profit ?? 0))[0] ?? null,
  };
}

function achievementUpserts(userId: string, bets: BetWithLegs[]) {
  const byLeague = new Map<string, BetWithLegs[]>();

  bets.forEach((bet) => {
    byLeague.set(bet.league_id, [...(byLeague.get(bet.league_id) ?? []), bet]);
  });

  const rows: UserAchievementInsert[] = [];

  byLeague.forEach((leagueBets, leagueId) => {
    achievementKeysForBets(leagueBets).forEach((achievementKey) => {
      rows.push({
        achievement_key: achievementKey,
        league_id: leagueId,
        metadata: {} as Json,
        user_id: userId,
      });
    });
  });

  return rows;
}

async function fetchUsersByIds(ids: string[]) {
  const userIds = uniqueValues(ids.filter(Boolean));

  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('users').select('*').in('id', userIds);
  return assertSupabaseResult(data as UserRow[] | null, error);
}

async function fetchBets(leagueIds: string[], userId: string) {
  if (leagueIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('bets')
    .select('*, bet_legs(*)')
    .in('league_id', leagueIds)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return assertSupabaseResult(data as BetWithLegs[] | null, error);
}

export function useProfileData({
  leagueId,
  targetUserId,
  viewerUserId,
}: {
  leagueId?: string;
  targetUserId: string | undefined;
  viewerUserId: string | undefined;
}) {
  return useQuery({
    enabled: Boolean(targetUserId && viewerUserId),
    queryFn: async (): Promise<ProfileData> => {
      if (!targetUserId || !viewerUserId) {
        throw new Error('User is required.');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', targetUserId)
        .single();
      const profile = assertSupabaseResult(profileData as UserRow | null, profileError);

      const membershipQuery = leagueId
        ? supabase
            .from('league_members')
            .select('*')
            .eq('league_id', leagueId)
            .eq('user_id', targetUserId)
        : supabase.from('league_members').select('*').eq('user_id', targetUserId);

      const { data: membershipData, error: membershipError } = await membershipQuery;
      const memberships = assertSupabaseResult(membershipData as LeagueMemberRow[] | null, membershipError);
      const leagueIds = uniqueValues(memberships.map((membership) => membership.league_id));

      if (leagueIds.length === 0) {
        return {
          achievements: [],
          bets: [],
          leagueOptions: [],
          leagues: [],
          memberships: [],
          profile,
          standings: [],
          targetMatchups: [],
          viewerBets: [],
          viewerMatchups: [],
          viewerStandings: [],
        };
      }

      const [
        leaguesResult,
        standingsResult,
        matchupsResult,
        achievementsResult,
        bets,
        viewerBets,
        viewerStandingsResult,
        viewerMatchupsResult,
      ] = await Promise.all([
        supabase.from('leagues').select('*').in('id', leagueIds),
        supabase.from('standings').select('*').in('league_id', leagueIds).eq('user_id', targetUserId),
        supabase
          .from('weekly_matchups')
          .select('*')
          .in('league_id', leagueIds)
          .or(`home_user_id.eq.${targetUserId},away_user_id.eq.${targetUserId}`),
        supabase
          .from('user_achievements')
          .select('*')
          .in('league_id', leagueIds)
          .eq('user_id', targetUserId),
        fetchBets(leagueIds, targetUserId),
        fetchBets(leagueIds, viewerUserId),
        supabase.from('standings').select('*').in('league_id', leagueIds).eq('user_id', viewerUserId),
        supabase
          .from('weekly_matchups')
          .select('*')
          .in('league_id', leagueIds)
          .or(`home_user_id.eq.${viewerUserId},away_user_id.eq.${viewerUserId}`),
      ]);

      const leagues = assertSupabaseResult(leaguesResult.data as LeagueRow[] | null, leaguesResult.error);
      const standings = assertSupabaseResult(
        standingsResult.data as StandingRow[] | null,
        standingsResult.error,
      );
      const targetMatchups = assertSupabaseResult(
        matchupsResult.data as WeeklyMatchupRow[] | null,
        matchupsResult.error,
      );
      const achievements = assertSupabaseResult(
        achievementsResult.data as UserAchievementRow[] | null,
        achievementsResult.error,
      );
      const viewerStandings = assertSupabaseResult(
        viewerStandingsResult.data as StandingRow[] | null,
        viewerStandingsResult.error,
      );
      const viewerMatchups = assertSupabaseResult(
        viewerMatchupsResult.data as WeeklyMatchupRow[] | null,
        viewerMatchupsResult.error,
      );

      if (targetUserId === viewerUserId) {
        const upserts = achievementUpserts(targetUserId, bets);
        if (upserts.length > 0) {
          await supabase
            .from('user_achievements')
            .upsert(upserts, { onConflict: 'user_id,league_id,achievement_key' });
        }
      }

      const leagueOptions = leagues
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((league) => ({ id: league.id, label: league.name }));

      return {
        achievements,
        bets,
        leagueOptions,
        leagues,
        memberships,
        profile,
        standings,
        targetMatchups,
        viewerBets,
        viewerMatchups,
        viewerStandings,
      };
    },
    queryKey: profileKeys.profile(viewerUserId, targetUserId, leagueId),
  });
}

export function buildMemberComparison(
  data: ProfileData,
  leagueId: string,
  targetUserId: string,
  viewerUserId: string,
): MemberComparison {
  const targetBets = data.bets.filter((bet) => bet.league_id === leagueId);
  const viewerBets = data.viewerBets.filter((bet) => bet.league_id === leagueId);
  const targetStandings = data.standings.filter((standing) => standing.league_id === leagueId);
  const viewerStandings = data.viewerStandings.filter((standing) => standing.league_id === leagueId);
  const sharedMatchups = data.targetMatchups.filter(
    (matchup) =>
      matchup.league_id === leagueId &&
      ((matchup.home_user_id === targetUserId && matchup.away_user_id === viewerUserId) ||
        (matchup.home_user_id === viewerUserId && matchup.away_user_id === targetUserId)) &&
      (matchup.home_profit !== null || matchup.away_profit !== null),
  );

  return {
    h2hLosses: sharedMatchups.filter((matchup) => matchup.winner_id === targetUserId).length,
    h2hTies: sharedMatchups.filter((matchup) => matchup.winner_id === null).length,
    h2hWins: sharedMatchups.filter((matchup) => matchup.winner_id === viewerUserId).length,
    targetStats: calculateProfileStats(targetBets, targetStandings),
    viewerStats: calculateProfileStats(viewerBets, viewerStandings),
  };
}

export function filterProfileBets({
  betType,
  bets,
  leagueId,
  result,
  week,
}: {
  betType: BetType | 'all';
  bets: BetWithLegs[];
  leagueId: string | 'all';
  result: BetResult | 'all';
  week: number | 'all';
}) {
  return bets.filter((bet) => {
    if (leagueId !== 'all' && bet.league_id !== leagueId) return false;
    if (week !== 'all' && bet.week_number !== week) return false;
    if (result !== 'all' && bet.result !== result) return false;
    if (betType !== 'all' && bet.bet_type !== betType) return false;
    return true;
  });
}

export function useLeaderboardData(userId: string | undefined, selectedLeagueId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async (): Promise<LeaderboardData> => {
      if (!userId) {
        return { leagueOptions: [], leagues: [], rows: [] };
      }

      const { data: membershipsData, error: membershipsError } = await supabase
        .from('league_members')
        .select('*')
        .eq('user_id', userId);
      const viewerMemberships = assertSupabaseResult(
        membershipsData as LeagueMemberRow[] | null,
        membershipsError,
      );
      const leagueIds = uniqueValues(viewerMemberships.map((membership) => membership.league_id));

      if (leagueIds.length === 0) {
        return { leagueOptions: [], leagues: [], rows: [] };
      }

      const { data: leaguesData, error: leaguesError } = await supabase
        .from('leagues')
        .select('*')
        .in('id', leagueIds);
      const leagues = assertSupabaseResult(leaguesData as LeagueRow[] | null, leaguesError).sort((left, right) =>
        left.name.localeCompare(right.name),
      );
      const resolvedLeagueId = selectedLeagueId ?? leagues[0]?.id;
      const league = leagues.find((item) => item.id === resolvedLeagueId) ?? leagues[0];

      if (!league) {
        return { leagueOptions: [], leagues, rows: [] };
      }

      const previousWeek = Math.max(1, league.current_week - 1);
      const [membersResult, standingsResult, previousStandingsResult] = await Promise.all([
        supabase.from('league_members').select('*').eq('league_id', league.id).order('joined_at'),
        supabase
          .from('standings')
          .select('*')
          .eq('league_id', league.id)
          .eq('week_number', league.current_week),
        supabase
          .from('standings')
          .select('*')
          .eq('league_id', league.id)
          .eq('week_number', previousWeek),
      ]);
      const members = assertSupabaseResult(membersResult.data as LeagueMemberRow[] | null, membersResult.error);
      const standings = assertSupabaseResult(standingsResult.data as StandingRow[] | null, standingsResult.error);
      const previousStandings = assertSupabaseResult(
        previousStandingsResult.data as StandingRow[] | null,
        previousStandingsResult.error,
      );
      const usersById = indexUsers(await fetchUsersByIds(members.map((member) => member.user_id)));

      return {
        leagueOptions: leagues.map((item) => ({ id: item.id, label: item.name })),
        leagues,
        rows: members
          .map((member) => {
            const standing = standings.find((item) => item.user_id === member.user_id) ?? null;
            const previous = previousStandings.find((item) => item.user_id === member.user_id) ?? null;
            const trend: LeaderboardRow['trend'] =
              previous && standing
                ? standing.rank < previous.rank
                  ? 'up'
                  : standing.rank > previous.rank
                    ? 'down'
                    : 'same'
                : 'same';

            return {
              member,
              profile: usersById[member.user_id] ?? null,
              standing,
              trend,
            };
          })
          .sort((left, right) => {
            const leftProfit = left.standing?.total_profit ?? 0;
            const rightProfit = right.standing?.total_profit ?? 0;
            return rightProfit - leftProfit;
          }),
      };
    },
    queryKey: profileKeys.leaderboard(userId, selectedLeagueId),
  });
}

export function calculateWeeklyAwards(
  bets: BetWithLegs[],
  usersById: Record<string, UserRow>,
): WeeklyAwards {
  const settled = settledBets(bets);
  const byUser = new Map<string, BetWithLegs[]>();

  settled.forEach((bet) => {
    byUser.set(bet.user_id, [...(byUser.get(bet.user_id) ?? []), bet]);
  });

  const roiRows = [...byUser.entries()].map(([userId, userBets]) => {
    const profit = userBets.reduce((sum, bet) => sum + (bet.profit ?? 0), 0);
    const amount = userBets.reduce((sum, bet) => sum + bet.amount, 0) || WEEKLY_BUDGET;
    return {
      bet: null,
      label: '',
      profit,
      roi: amount > 0 ? (profit / amount) * 100 : 0,
      user: usersById[userId] ?? null,
    };
  });
  const lockBet = [...settled].sort((left, right) => (right.profit ?? 0) - (left.profit ?? 0))[0] ?? null;

  return {
    degen: roiRows.sort((left, right) => left.roi - right.roi)[0]
      ? { ...roiRows.sort((left, right) => left.roi - right.roi)[0], label: 'Degen of the Week' }
      : null,
    lock: lockBet
      ? {
          bet: lockBet,
          label: 'Lock of the Week',
          profit: lockBet.profit ?? 0,
          roi: lockBet.amount > 0 ? ((lockBet.profit ?? 0) / lockBet.amount) * 100 : 0,
          user: usersById[lockBet.user_id] ?? null,
        }
      : null,
    sharpest: roiRows.sort((left, right) => right.roi - left.roi)[0]
      ? { ...roiRows.sort((left, right) => right.roi - left.roi)[0], label: 'Sharpest Bettor' }
      : null,
  };
}

export function useWeeklyAwards(leagueId: string | undefined, weekNumber: number | undefined) {
  return useQuery({
    enabled: Boolean(leagueId && weekNumber),
    queryFn: async (): Promise<WeeklyAwards> => {
      if (!leagueId || !weekNumber) {
        return { degen: null, lock: null, sharpest: null };
      }

      const [betsResult, membersResult] = await Promise.all([
        supabase
          .from('bets')
          .select('*, bet_legs(*)')
          .eq('league_id', leagueId)
          .eq('week_number', weekNumber),
        supabase.from('league_members').select('*').eq('league_id', leagueId),
      ]);
      const bets = assertSupabaseResult(betsResult.data as BetWithLegs[] | null, betsResult.error);
      const members = assertSupabaseResult(membersResult.data as LeagueMemberRow[] | null, membersResult.error);
      const usersById = indexUsers(await fetchUsersByIds(members.map((member) => member.user_id)));

      return calculateWeeklyAwards(bets, usersById);
    },
    queryKey: profileKeys.awards(leagueId, weekNumber),
  });
}
