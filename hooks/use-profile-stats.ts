import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { PUBLIC_USER_SELECT } from '@/constants/public-user-select';
import { WEEKLY_BUDGET } from '@/constants/rules';
import {
  getLeagueMemberPrimaryName,
  indexLeagueMembersByUserId,
} from '@/lib/league-member-display';
import { fetchBetsWithLegs, fetchUserBetsWithLegs } from '@/lib/bets-with-legs';
import { getSettledBets, isSettledBet, sumSettledProfit } from '@/lib/settled-bets';
import { supabase } from '@/lib/supabase';
import type {
  AchievementKey,
  BetRow,
  BetResult,
  BetType,
  LeagueMemberRow,
  LeagueRow,
  StandingRow,
  TeaserPoints,
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
  seasonProfit: number;
  seasonRank: number;
  standing: StandingRow | null;
  seasonTrend: 'down' | 'up' | null;
  weeklyProfit: number;
  weeklyRank: number;
  weeklyTrend: 'down' | 'up' | null;
};

export type LeaderboardData = {
  leagueOptions: LeagueOption[];
  leagues: LeagueRow[];
  rows: LeaderboardRow[];
};

export type WeeklyAward = {
  bet: BetWithLegs | null;
  displayName: string;
  displayNames: string[];
  label: string;
  profit: number;
  roi: number;
  user: UserRow | null;
  users: UserRow[];
};

export type WeeklyLiveStanding = {
  displayName: string;
  pendingPicks: number;
  pickCount: number;
  profit: number;
  settledPicks: number;
  user: UserRow | null;
  userId: string;
};

export type WeeklyAwards = {
  coldStreak: WeeklyAward | null;
  hasBets: boolean;
  isFullySettled: boolean;
  liveStandings: WeeklyLiveStanding[];
  lock: WeeklyAward | null;
  sharpest: WeeklyAward | null;
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    description: 'Win five settled picks in a row.',
    key: 'hot_streak',
    title: 'Hot Streak',
  },
  {
    description: 'Win a pick at +300 or longer.',
    key: 'underdog_hunter',
    title: 'Underdog Hunter',
  },
  {
    description: 'Win every settled pick in a single week.',
    key: 'perfect_week',
    title: 'Perfect Week',
  },
  {
    description: 'Post positive weekly profit five weeks in a row.',
    key: 'budget_master',
    title: 'Strategy Master',
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

function latestStandingsByLeague(standings: StandingRow[]) {
  const latestByLeague = new Map<string, StandingRow>();

  standings.forEach((standing) => {
    const current = latestByLeague.get(standing.league_id);
    if (!current || standing.week_number > current.week_number) {
      latestByLeague.set(standing.league_id, standing);
    }
  });

  return latestByLeague;
}

function latestStandingAtOrBefore(standings: StandingRow[], weekNumber: number) {
  return [...standings]
    .filter((standing) => standing.week_number <= weekNumber)
    .sort((left, right) => right.week_number - left.week_number)[0] ?? null;
}

function latestLeagueRecord(standings: StandingRow[]) {
  return [...latestStandingsByLeague(standings).values()].reduce(
    (record, standing) => ({
      losses: record.losses + standing.losses,
      ties: record.ties + standing.ties,
      wins: record.wins + standing.wins,
    }),
    { losses: 0, ties: 0, wins: 0 },
  );
}

function filterBetsToLatestStandings(bets: BetWithLegs[], standings: StandingRow[]) {
  const latestByLeague = latestStandingsByLeague(standings);

  if (latestByLeague.size === 0) {
    return bets;
  }

  return bets.filter((bet) => {
    const latest = latestByLeague.get(bet.league_id);
    return !latest || bet.week_number <= latest.week_number;
  });
}

function seasonProfitFromStandings(standings: StandingRow[]) {
  const latestByLeague = latestStandingsByLeague(standings);

  if (latestByLeague.size === 0) {
    return null;
  }

  const latestStandings = [...latestByLeague.values()];

  if (!latestStandings.every((standing) => Number.isFinite(standing.total_profit))) {
    return null;
  }

  return latestStandings.reduce((sum, standing) => sum + standing.total_profit, 0);
}

function settledBets<T extends Pick<BetRow, 'profit' | 'result'>>(bets: T[]) {
  return getSettledBets(bets);
}

function sumSettledBetProfit<T extends Pick<BetRow, 'profit' | 'result'>>(bets: T[]) {
  return sumSettledProfit(bets);
}

function recordFromBets(bets: BetWithLegs[]) {
  const wins = bets.filter((bet) => bet.result === 'win').length;
  const losses = bets.filter((bet) => bet.result === 'loss').length;
  const pushes = bets.filter((bet) => bet.result === 'push').length;
  return `${wins}-${losses}${pushes > 0 ? `-${pushes}` : ''}`;
}

function currentBetStreak(bets: BetWithLegs[]) {
  const ordered = [...settledBets(bets)]
    .filter((bet) => bet.result === 'win' || bet.result === 'loss')
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const first = ordered[0];

  if (!first) {
    return 'No streak';
  }

  let count = 0;

  for (const bet of ordered) {
    if (bet.result !== first.result) {
      break;
    }

    count += 1;
  }

  return `${first.result === 'win' ? 'W' : 'L'}${count}`;
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
  const seasonBets = filterBetsToLatestStandings(bets, standings);
  const settled = settledBets(seasonBets);
  const totalProfit = seasonProfitFromStandings(standings) ?? sumSettledBetProfit(seasonBets);
  const totalAmount = settled.reduce((sum, bet) => sum + bet.amount, 0);
  const record = latestLeagueRecord(standings);
  const wonBets = settled.filter((bet) => bet.result === 'win').length;
  const lostBets = settled.filter((bet) => bet.result === 'loss').length;
  const decisiveBets = wonBets + lostBets;

  return {
    averageProfitPerBet: settled.length > 0 ? totalProfit / settled.length : 0,
    currentStreak: currentBetStreak(seasonBets),
    losses: record.losses,
    roi: totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0,
    ties: record.ties,
    totalAmount,
    totalProfit,
    totalSettledBets: settled.length,
    winRate: decisiveBets > 0 ? (wonBets / decisiveBets) * 100 : 0,
    wins: record.wins,
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
  let previousWeek: number | null = null;

  weeklyProfits.forEach((week) => {
    if (previousWeek !== null && week.week !== previousWeek + 1) {
      positiveWeeks = 0;
    }

    positiveWeeks = week.profit > 0 ? positiveWeeks + 1 : 0;
    previousWeek = week.week;

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
    selectedLeagueId === 'all'
      ? uniqueValues([
          ...data.leagues.map((league) => league.id),
          ...data.bets.map((bet) => bet.league_id),
          ...data.standings.map((standing) => standing.league_id),
        ])
      : [selectedLeagueId];
  const bets = data.bets.filter((bet) => leagueIds.includes(bet.league_id));
  const standings = data.standings.filter((standing) => leagueIds.includes(standing.league_id));
  const achievements = data.achievements.filter((achievement) => leagueIds.includes(achievement.league_id));
  const seasonBets = filterBetsToLatestStandings(bets, standings);
  const settled = settledBets(seasonBets);

  return {
    achievements: buildAchievements(seasonBets, achievements),
    bestBet:
      [...settled].sort((left, right) => (right.profit ?? 0) - (left.profit ?? 0))[0] ?? null,
    betTypeBreakdowns: calculateBetTypeBreakdowns(seasonBets),
    bets,
    latestStanding: latestStanding(standings),
    stats: calculateProfileStats(bets, standings),
    teaserBreakdowns: calculateTeaserBreakdowns(seasonBets),
    weeklyProfits: weeklyProfitMap(seasonBets),
    worstBet:
      [...settled].sort((left, right) => (left.profit ?? 0) - (right.profit ?? 0))[0] ?? null,
  };
}

function displayNameForLeaderboardRow(row: Pick<LeaderboardRow, 'member' | 'profile'>) {
  return getLeagueMemberPrimaryName(row.member, row.profile, 'Player');
}

function compareLeaderboardRows(
  left: Pick<LeaderboardRow, 'member' | 'profile' | 'seasonProfit' | 'standing' | 'weeklyProfit'>,
  right: Pick<LeaderboardRow, 'member' | 'profile' | 'seasonProfit' | 'standing' | 'weeklyProfit'>,
  value: 'seasonProfit' | 'weeklyProfit',
) {
  const profitDelta = right[value] - left[value];
  if (profitDelta !== 0) {
    return profitDelta;
  }

  const winsDelta = (right.standing?.wins ?? 0) - (left.standing?.wins ?? 0);
  if (winsDelta !== 0) {
    return winsDelta;
  }

  const lossesDelta = (left.standing?.losses ?? 0) - (right.standing?.losses ?? 0);
  if (lossesDelta !== 0) {
    return lossesDelta;
  }

  const nameDelta = displayNameForLeaderboardRow(left).localeCompare(displayNameForLeaderboardRow(right));
  if (nameDelta !== 0) {
    return nameDelta;
  }

  return left.member.joined_at.localeCompare(right.member.joined_at);
}

function indexedRanks<T extends { member: LeagueMemberRow }>(
  rows: T[],
  compare: (left: T, right: T) => number,
) {
  return [...rows].sort(compare).reduce<Record<string, number>>((ranks, row, index) => {
    ranks[row.member.user_id] = index + 1;
    return ranks;
  }, {});
}

function trendFromRanks(currentRank: number, previousRank: number | null): 'down' | 'up' | null {
  if (!previousRank || currentRank === previousRank) {
    return null;
  }

  return currentRank < previousRank ? 'up' : 'down';
}

function hasLeaderboardSeparation<T>(rows: T[], valueFor: (row: T) => number) {
  return new Set(rows.map(valueFor)).size > 1;
}

async function fetchUsersByIds(ids: string[]) {
  const userIds = uniqueValues(ids.filter(Boolean));

  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('users').select(PUBLIC_USER_SELECT).in('id', userIds);
  return assertSupabaseResult(data as UserRow[] | null, error);
}

async function fetchBets(leagueIds: string[], userId: string) {
  return fetchBetsWithLegs({ leagueIds, userId });
}

async function fetchOwnBets(userId: string) {
  return fetchUserBetsWithLegs({ userId });
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
        .select(PUBLIC_USER_SELECT)
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
      const membershipLeagueIds = uniqueValues(memberships.map((membership) => membership.league_id));
      const ownHistoricalBets =
        targetUserId === viewerUserId && !leagueId ? await fetchOwnBets(targetUserId) : null;
      const leagueIds = uniqueValues([
        ...membershipLeagueIds,
        ...(ownHistoricalBets?.map((bet) => bet.league_id) ?? []),
      ]);

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
        ownHistoricalBets ? Promise.resolve(ownHistoricalBets) : fetchBets(leagueIds, targetUserId),
        ownHistoricalBets && targetUserId === viewerUserId
          ? Promise.resolve(ownHistoricalBets)
          : fetchBets(leagueIds, viewerUserId),
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
  const queryClient = useQueryClient();
  const query = useQuery({
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
      const [membersResult, standingsResult, betsResult] = await Promise.all([
        supabase.from('league_members').select('*').eq('league_id', league.id).order('joined_at'),
        supabase
          .from('standings')
          .select('*')
          .eq('league_id', league.id)
          .lte('week_number', league.current_week),
        supabase
          .from('bets')
          .select('*')
          .eq('league_id', league.id)
          .lte('week_number', league.current_week)
          .neq('result', 'pending')
          .not('profit', 'is', null),
      ]);
      const members = assertSupabaseResult(membersResult.data as LeagueMemberRow[] | null, membersResult.error);
      const standings = assertSupabaseResult(standingsResult.data as StandingRow[] | null, standingsResult.error);
      const bets = assertSupabaseResult(betsResult.data as BetRow[] | null, betsResult.error).filter(
        isSettledBet,
      );
      const usersById = indexUsers(await fetchUsersByIds(members.map((member) => member.user_id)));

      const draftRows = members.map((member) => {
        const memberBets = bets.filter((bet) => bet.user_id === member.user_id);
        const memberStandings = standings.filter((standing) => standing.user_id === member.user_id);
        const latestStandingForMember = latestStandingAtOrBefore(memberStandings, league.current_week);
        const currentStanding = memberStandings.find(
          (standing) => standing.week_number === league.current_week,
        ) ?? null;
        const previousStanding =
          league.current_week > 1 ? latestStandingAtOrBefore(memberStandings, previousWeek) : null;
        const currentWeekBets = memberBets.filter((bet) => bet.week_number === league.current_week);
        const previousWeekBets = memberBets.filter((bet) => bet.week_number === previousWeek);

        return {
          member,
          previousSeasonProfit:
            previousStanding?.total_profit ??
            (league.current_week > 1
              ? sumSettledBetProfit(memberBets.filter((bet) => bet.week_number <= previousWeek))
              : 0),
          previousWeeklyProfit: previousStanding?.weekly_profit ?? sumSettledBetProfit(previousWeekBets),
          profile: usersById[member.user_id] ?? null,
          seasonProfit: latestStandingForMember?.total_profit ?? sumSettledBetProfit(memberBets),
          standing: latestStandingForMember,
          weeklyProfit: currentStanding?.weekly_profit ?? sumSettledBetProfit(currentWeekBets),
        };
      });

      const seasonRanks = indexedRanks(draftRows, (left, right) =>
        compareLeaderboardRows(left, right, 'seasonProfit'),
      );
      const weeklyRanks = indexedRanks(draftRows, (left, right) =>
        compareLeaderboardRows(left, right, 'weeklyProfit'),
      );
      const previousSeasonRanks: Record<string, number> =
        league.current_week > 1
          ? indexedRanks(
              draftRows.map((row) => ({ ...row, seasonProfit: row.previousSeasonProfit })),
              (left, right) => compareLeaderboardRows(left, right, 'seasonProfit'),
            )
          : {};
      const previousWeeklyRanks: Record<string, number> =
        league.current_week > 1
          ? indexedRanks(
              draftRows.map((row) => ({ ...row, weeklyProfit: row.previousWeeklyProfit })),
              (left, right) => compareLeaderboardRows(left, right, 'weeklyProfit'),
            )
          : {};
      const hasSeasonSeparation = hasLeaderboardSeparation(draftRows, (row) => row.seasonProfit);
      const hasWeeklySeparation = hasLeaderboardSeparation(draftRows, (row) => row.weeklyProfit);

      return {
        leagueOptions: leagues.map((item) => ({ id: item.id, label: item.name })),
        leagues,
        rows: draftRows
          .map((row) => {
            const seasonRank = seasonRanks[row.member.user_id] ?? members.length;
            const weeklyRank = weeklyRanks[row.member.user_id] ?? members.length;
            const previousSeasonRank = previousSeasonRanks[row.member.user_id] ?? null;
            const previousWeeklyRank = previousWeeklyRanks[row.member.user_id] ?? null;

            return {
              member: row.member,
              profile: row.profile,
              seasonProfit: row.seasonProfit,
              seasonRank,
              seasonTrend: hasSeasonSeparation ? trendFromRanks(seasonRank, previousSeasonRank) : null,
              standing: row.standing,
              weeklyProfit: row.weeklyProfit,
              weeklyRank,
              weeklyTrend: hasWeeklySeparation ? trendFromRanks(weeklyRank, previousWeeklyRank) : null,
            };
          })
          .sort((left, right) => {
            return compareLeaderboardRows(left, right, 'seasonProfit');
          }),
      };
    },
    queryKey: profileKeys.leaderboard(userId, selectedLeagueId),
  });

  const activeLeagueId = selectedLeagueId ?? query.data?.leagues[0]?.id;

  useEffect(() => {
    if (!userId || !activeLeagueId) {
      return undefined;
    }

    const invalidateLeaderboard = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leaderboard', userId] }),
        queryClient.invalidateQueries({ queryKey: ['profile-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] }),
        queryClient.invalidateQueries({ queryKey: ['leagues', 'detail', activeLeagueId] }),
      ]);
    };
    const channelTopic = `leaderboard-settlement:${activeLeagueId}:${Date.now().toString(36)}:${Math.random()
      .toString(36)
      .slice(2)}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `league_id=eq.${activeLeagueId}`,
          schema: 'public',
          table: 'bets',
        },
        invalidateLeaderboard,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `league_id=eq.${activeLeagueId}`,
          schema: 'public',
          table: 'standings',
        },
        invalidateLeaderboard,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `league_id=eq.${activeLeagueId}`,
          schema: 'public',
          table: 'league_members',
        },
        invalidateLeaderboard,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `league_id=eq.${activeLeagueId}`,
          schema: 'public',
          table: 'weekly_matchups',
        },
        invalidateLeaderboard,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bet_legs',
        },
        invalidateLeaderboard,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeLeagueId, queryClient, userId]);

  return query;
}

export function calculateWeeklyAwards(
  bets: BetWithLegs[],
  usersById: Record<string, UserRow>,
  standings: StandingRow[] = [],
  membersById: Record<string, LeagueMemberRow | undefined> = {},
): WeeklyAwards {
  type AwardDraftRow = Omit<WeeklyAward, 'users'>;

  const settled = settledBets(bets);
  const hasBets = bets.length > 0;
  const hasPendingBets = bets.some((bet) => bet.result === 'pending');
  const hasResolvedStandings = standings.some(
    (standing) =>
      standing.weekly_profit !== 0 ||
      standing.wins !== 0 ||
      standing.losses !== 0 ||
      standing.ties !== 0,
  );
  const isFullySettled =
    !hasPendingBets && (hasResolvedStandings || (hasBets && settled.length === bets.length));
  const userIds = uniqueValues([
    ...Object.keys(usersById),
    ...bets.map((bet) => bet.user_id),
    ...standings.map((standing) => standing.user_id),
  ]);
  const byUser = new Map<string, BetWithLegs[]>();
  const standingByUserId = standings.reduce<Record<string, StandingRow>>((accumulator, standing) => {
    accumulator[standing.user_id] = standing;
    return accumulator;
  }, {});
  const displayNameForUser = (userId: string) =>
    getLeagueMemberPrimaryName(membersById[userId], usersById[userId], 'Player');

  bets.forEach((bet) => {
    byUser.set(bet.user_id, [...(byUser.get(bet.user_id) ?? []), bet]);
  });

  const profitForUser = (userId: string, userBets: BetWithLegs[]) => {
    const standing = standingByUserId[userId];

    if (standing) {
      return standing.weekly_profit;
    }

    if (isFullySettled && userBets.length === 0) {
      return -WEEKLY_BUDGET;
    }

    return settledBets(userBets).reduce((sum, bet) => sum + (bet.profit ?? 0), 0);
  };

  const liveStandings = userIds
    .map((userId) => {
      const userBets = byUser.get(userId) ?? [];
      const settledUserBets = settledBets(userBets);
      const profit = profitForUser(userId, userBets);

      return {
        displayName: displayNameForUser(userId),
        pendingPicks: userBets.filter((bet) => bet.result === 'pending').length,
        pickCount: userBets.length,
        profit,
        settledPicks: settledUserBets.length,
        user: usersById[userId] ?? null,
        userId,
      };
    })
    .sort((left, right) => {
      if (right.profit !== left.profit) {
        return right.profit - left.profit;
      }

      return left.displayName.localeCompare(right.displayName);
    });

  const profitRows: AwardDraftRow[] = userIds.map((userId) => {
    const userBets = byUser.get(userId) ?? [];
    const profit = profitForUser(userId, userBets);
    return {
      bet: null,
      displayName: displayNameForUser(userId),
      displayNames: [],
      label: '',
      profit,
      roi: (profit / WEEKLY_BUDGET) * 100,
      user: usersById[userId] ?? null,
    };
  });
  const makeAward = (label: string, rows: AwardDraftRow[]): WeeklyAward | null => {
    const first = rows[0];

    if (!first) {
      return null;
    }

    const users = rows.map((row) => row.user).filter((user): user is UserRow => Boolean(user));

    return {
      ...first,
      displayNames: rows.map((row) => row.displayName),
      label: rows.length > 1 ? `${label} Tie` : label,
      users,
    };
  };
  const lockRows: AwardDraftRow[] = settled
    .filter((bet) => bet.is_lock && bet.profit > 0)
    .map((bet) => ({
      bet,
      displayName: displayNameForUser(bet.user_id),
      displayNames: [],
      label: '',
      profit: bet.profit,
      roi: bet.amount > 0 ? (bet.profit / bet.amount) * 100 : 0,
      user: usersById[bet.user_id] ?? null,
    }));
  const topLockProfit =
    isFullySettled && lockRows.length > 0
      ? Math.max(...lockRows.map((row) => row.profit))
      : null;
  const lockAwardRows =
    topLockProfit === null
      ? []
      : lockRows.filter((row) => row.profit === topLockProfit);
  const lockAward = makeAward('Pick of the Week', lockAwardRows);

  let sharpest: WeeklyAward | null = null;
  let coldStreak: WeeklyAward | null = null;

  if (isFullySettled && profitRows.length > 0) {
    const profits = profitRows.map((row) => row.profit);
    const maxProfit = Math.max(...profits);
    const minProfit = Math.min(...profits);
    const topRows = profitRows.filter((row) => row.profit === maxProfit);
    const coldRows = profitRows.filter((row) => row.profit === minProfit);

    if (profitRows.length === 1 || maxProfit === minProfit) {
      if (maxProfit > 0) {
        sharpest = makeAward('Top Performer', topRows);
      } else if (minProfit < 0) {
        coldStreak = makeAward('Cold Streak', coldRows);
      }
    } else {
      sharpest = makeAward('Top Performer', topRows);
      coldStreak = makeAward('Cold Streak', coldRows);
    }
  }

  return {
    coldStreak,
    hasBets,
    isFullySettled,
    liveStandings,
    lock: lockAward,
    sharpest,
  };
}

export function useWeeklyAwards(leagueId: string | undefined, weekNumber: number | undefined) {
  return useQuery({
    enabled: Boolean(leagueId && weekNumber),
    queryFn: async (): Promise<WeeklyAwards> => {
      if (!leagueId || !weekNumber) {
        return {
          coldStreak: null,
          hasBets: false,
          isFullySettled: false,
          liveStandings: [],
          lock: null,
          sharpest: null,
        };
      }

      const [bets, membersResult, standingsResult] = await Promise.all([
        fetchBetsWithLegs({ ascending: true, leagueIds: [leagueId], weekNumbers: [weekNumber] }),
        supabase.from('league_members').select('*').eq('league_id', leagueId),
        supabase
          .from('standings')
          .select('*')
          .eq('league_id', leagueId)
          .eq('week_number', weekNumber),
      ]);
      const members = assertSupabaseResult(membersResult.data as LeagueMemberRow[] | null, membersResult.error);
      const standings = assertSupabaseResult(
        standingsResult.data as StandingRow[] | null,
        standingsResult.error,
      );
      const usersById = indexUsers(await fetchUsersByIds(members.map((member) => member.user_id)));

      return calculateWeeklyAwards(bets, usersById, standings, indexLeagueMembersByUserId(members));
    },
    queryKey: profileKeys.awards(leagueId, weekNumber),
  });
}
