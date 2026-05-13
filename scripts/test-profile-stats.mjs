#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const originalLoad = Module._load;
Module._load = function loadWithAppStubs(request, parent, isMain) {
  if (request === '@tanstack/react-query') {
    return {
      useQuery: () => {
        throw new Error('useQuery should not be called by profile stat tests.');
      },
      useQueryClient: () => ({
        invalidateQueries: () => Promise.resolve(),
      }),
    };
  }

  if (request === 'react') {
    return {
      useEffect: () => undefined,
    };
  }

  if (request === '@/constants/rules') {
    return { WEEKLY_BUDGET: 100 };
  }

  if (request === '@/lib/supabase') {
    return { supabase: {} };
  }

  return originalLoad.call(this, request, parent, isMain);
};

require.extensions['.ts'] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  buildAchievements,
  buildMemberComparison,
  buildProfileSummary,
  calculateWeeklyAwards,
  calculateBetTypeBreakdowns,
  calculateProfileStats,
  calculateTeaserBreakdowns,
  filterProfileBets,
} = require(path.join(root, 'hooks/use-profile-stats.ts'));

let nextBetId = 1;

function leg(overrides = {}) {
  return {
    adjusted_line: -2.5,
    bet_id: '',
    game_id: `game-${nextBetId}`,
    game_start_time: '2026-09-01T17:00:00.000Z',
    id: `leg-${nextBetId}-${Math.random().toString(36).slice(2)}`,
    leg_odds: -110,
    locked: true,
    market: 'spread',
    original_line: -8.5,
    result: 'win',
    selection: 'Buffalo Bills',
    ...overrides,
  };
}

function bet(overrides = {}) {
  const id = `bet-${nextBetId++}`;
  const result = overrides.result ?? 'win';
  const profit =
    Object.prototype.hasOwnProperty.call(overrides, 'profit')
      ? overrides.profit
      : result === 'win'
        ? 10
        : result === 'loss'
          ? -10
          : result === 'push'
            ? 0
            : null;
  const legs =
    overrides.bet_legs ??
    [leg({ bet_id: id, result: result === 'pending' ? 'pending' : result })];

  return {
    amount: 10,
    bet_legs: legs,
    bet_type: 'straight',
    created_at: `2026-09-${String(nextBetId).padStart(2, '0')}T12:00:00.000Z`,
    id,
    is_lock: false,
    league_id: 'league-a',
    odds: -110,
    potential_payout: 19.09,
    profit,
    result,
    teaser_points: null,
    user_id: 'target-user',
    week_number: 1,
    ...overrides,
  };
}

function achievementKeys(displays) {
  return new Set(displays.filter((achievement) => achievement.earned).map((achievement) => achievement.key));
}

const streakBets = [
  bet({ created_at: '2026-09-01T12:00:00.000Z', result: 'win' }),
  bet({ created_at: '2026-09-02T12:00:00.000Z', result: 'win' }),
  bet({ created_at: '2026-09-03T12:00:00.000Z', result: 'win' }),
  bet({ created_at: '2026-09-04T12:00:00.000Z', result: 'win' }),
  bet({ created_at: '2026-09-05T12:00:00.000Z', result: 'win' }),
  bet({ created_at: '2026-09-06T12:00:00.000Z', result: 'push' }),
];

assert.equal(calculateProfileStats(streakBets, []).currentStreak, 'W5');
assert.ok(achievementKeys(buildAchievements(streakBets, [])).has('hot_streak'));

const h2hStats = calculateProfileStats(
  [
    bet({ result: 'win' }),
    bet({ result: 'loss' }),
    bet({ result: 'push' }),
  ],
  [
    { league_id: 'league-a', losses: 2, ties: 0, week_number: 1, wins: 1 },
    { league_id: 'league-a', losses: 2, ties: 1, week_number: 2, wins: 3 },
    { league_id: 'league-b', losses: 0, ties: 1, week_number: 1, wins: 2 },
  ],
);
assert.equal(`${h2hStats.wins}-${h2hStats.losses}-${h2hStats.ties}`, '5-2-2');
assert.equal(h2hStats.winRate, 50);

const achievementBets = [
  ...Array.from({ length: 5 }, (_, index) =>
    bet({ created_at: `2026-09-${10 + index}T12:00:00.000Z`, result: 'win', week_number: 2 }),
  ),
  bet({ odds: 350, result: 'win', week_number: 3 }),
  bet({
    bet_legs: [leg(), leg(), leg(), leg()],
    bet_type: 'parlay',
    result: 'win',
    week_number: 3,
  }),
  bet({ bet_type: 'teaser', result: 'win', teaser_points: 6, week_number: 4 }),
  bet({ bet_type: 'teaser', result: 'win', teaser_points: 6.5, week_number: 4 }),
  bet({ bet_type: 'teaser', result: 'win', teaser_points: 7, week_number: 4 }),
  bet({ profit: 8, result: 'win', week_number: 5 }),
  bet({ profit: 9, result: 'win', week_number: 6 }),
  bet({ profit: 10, result: 'win', week_number: 7 }),
  bet({ profit: 11, result: 'win', week_number: 8 }),
  bet({ profit: 12, result: 'win', week_number: 9 }),
];
const earned = achievementKeys(buildAchievements(achievementBets, []));
const budgetMaster = buildAchievements(achievementBets, []).find(
  (achievement) => achievement.key === 'budget_master',
);

assert.ok(earned.has('hot_streak'), 'five wins should unlock Hot Streak');
assert.ok(earned.has('underdog_hunter'), '+300 or longer win should unlock Underdog Hunter');
assert.ok(earned.has('perfect_week'), 'five winning settled picks in one week should unlock Perfect Week');
assert.ok(earned.has('parlay_king'), 'four-leg parlay win should unlock Parlay King');
assert.ok(earned.has('teaser_genius'), 'three teaser wins in one week should unlock Teaser Genius');
assert.ok(earned.has('budget_master'), 'five consecutive positive weeks should unlock Budget Master');
assert.equal(budgetMaster?.title, 'Budget Master');

const skippedWeekBets = [1, 2, 4, 5, 6].map((weekNumber) =>
  bet({ profit: 10, result: 'win', week_number: weekNumber }),
);
assert.equal(
  achievementKeys(buildAchievements(skippedWeekBets, [])).has('budget_master'),
  false,
  'missing calendar weeks should break Budget Master progress',
);

const breakdownBets = [
  bet({ bet_type: 'straight', profit: 12, result: 'win' }),
  bet({ bet_type: 'straight', profit: -10, result: 'loss' }),
  bet({ bet_legs: [leg(), leg(), leg()], bet_type: 'parlay', profit: 40, result: 'win' }),
  bet({ bet_type: 'teaser', profit: 9, result: 'win', teaser_points: 6 }),
  bet({ bet_type: 'teaser', profit: 0, result: 'push', teaser_points: 6 }),
];
const breakdowns = calculateBetTypeBreakdowns(breakdownBets);
assert.equal(breakdowns.find((row) => row.type === 'straight')?.record, '1-1');
assert.equal(breakdowns.find((row) => row.type === 'parlay')?.averageLegs, 3);
assert.equal(calculateTeaserBreakdowns(breakdownBets).find((row) => row.points === 6)?.record, '1-0-1');

const filtered = filterProfileBets({
  betType: 'teaser',
  bets: breakdownBets,
  leagueId: 'all',
  result: 'win',
  week: 'all',
});
assert.equal(filtered.length, 1);
assert.equal(filtered[0]?.bet_type, 'teaser');

const targetWin = {
  away_profit: 5,
  away_user_id: 'viewer-user',
  home_profit: 12,
  home_user_id: 'target-user',
  league_id: 'league-a',
  winner_id: 'target-user',
};
const viewerWin = {
  away_profit: 14,
  away_user_id: 'viewer-user',
  home_profit: 2,
  home_user_id: 'target-user',
  league_id: 'league-a',
  winner_id: 'viewer-user',
};
const tie = {
  away_profit: 7,
  away_user_id: 'viewer-user',
  home_profit: 7,
  home_user_id: 'target-user',
  league_id: 'league-a',
  winner_id: null,
};
const comparison = buildMemberComparison(
  {
    achievements: [],
    bets: [bet({ league_id: 'league-a', result: 'win', user_id: 'target-user' })],
    leagueOptions: [],
    leagues: [],
    memberships: [],
    profile: { id: 'target-user' },
    standings: [],
    targetMatchups: [targetWin, viewerWin, tie],
    viewerBets: [bet({ league_id: 'league-a', result: 'loss', user_id: 'viewer-user' })],
    viewerMatchups: [targetWin, viewerWin, tie],
    viewerStandings: [],
  },
  'league-a',
  'target-user',
  'viewer-user',
);
assert.equal(comparison.h2hWins, 1, 'h2hWins is from the viewer perspective for the comparison UI');
assert.equal(comparison.h2hLosses, 1);
assert.equal(comparison.h2hTies, 1);

const profileSummary = buildProfileSummary(
  {
    achievements: [],
    bets: [
      bet({ league_id: 'league-a', profit: 20, result: 'win' }),
      bet({ league_id: 'league-a', profit: -15, result: 'loss' }),
      bet({ league_id: 'league-b', profit: 50, result: 'win' }),
    ],
    leagueOptions: [],
    leagues: [{ id: 'league-a', name: 'League A' }, { id: 'league-b', name: 'League B' }],
    memberships: [],
    profile: { id: 'target-user' },
    standings: [],
    targetMatchups: [],
    viewerBets: [],
    viewerMatchups: [],
    viewerStandings: [],
  },
  'league-a',
);
assert.equal(profileSummary.bestBet?.profit, 20);
assert.equal(profileSummary.worstBet?.profit, -15);

const awardUsersById = {
  'award-user-1': { display_name: 'Award User 1', id: 'award-user-1' },
  'award-user-2': { display_name: 'Award User 2', id: 'award-user-2' },
  'award-user-3': { display_name: 'Award User 3', id: 'award-user-3' },
};
const lockedParlay = bet({
  amount: 25,
  bet_legs: [leg({ result: 'win' }), leg({ result: 'win' }), leg({ result: 'win' })],
  bet_type: 'parlay',
  is_lock: true,
  profit: 90,
  result: 'win',
  user_id: 'award-user-1',
});
const weeklyAwards = calculateWeeklyAwards(
  [
    lockedParlay,
    bet({ amount: 35, profit: 60, result: 'win', user_id: 'award-user-2' }),
  ],
  awardUsersById,
  [
    { league_id: 'league-a', user_id: 'award-user-1', week_number: 1, weekly_profit: 90 },
    { league_id: 'league-a', user_id: 'award-user-2', week_number: 1, weekly_profit: 60 },
    { league_id: 'league-a', user_id: 'award-user-3', week_number: 1, weekly_profit: -100 },
  ],
);
assert.equal(weeklyAwards.isFullySettled, true);
assert.equal(weeklyAwards.sharpest?.label, 'Top Performer');
assert.equal(weeklyAwards.sharpest?.user?.id, 'award-user-1');
assert.equal(weeklyAwards.sharpest?.roi, 90);
assert.equal(weeklyAwards.coldStreak?.label, 'Cold Streak');
assert.equal(weeklyAwards.coldStreak?.user?.id, 'award-user-3');
assert.equal(weeklyAwards.coldStreak?.profit, -100);
assert.equal(weeklyAwards.lock?.label, 'Pick of the Week');
assert.equal(weeklyAwards.lock?.profit, 90);
assert.equal(weeklyAwards.lock?.bet?.bet_legs.length, 3);

console.log('Profile stats and achievements regression tests passed.');
