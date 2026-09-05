import type { TeaserLegCount, TeaserPoints } from '@/types/database';

export const WEEKLY_BUDGET = 100;
export const MINIMUM_BETS_PER_WEEK = 5;
export const MAX_SINGLE_BET = 35;
export const PARLAY_PAYOUT_CAP = 500;
export const LOCK_OF_THE_WEEK_MULTIPLIER = 1.5;
export const DEFAULT_MAX_LEAGUE_MEMBERS = 10;
export const DEFAULT_MIN_LEAGUE_MEMBERS = 2;
export const DEFAULT_LEAGUE_SEASON_WEEKS = 17;
export const NFL_REGULAR_SEASON_WEEKS = 14;
export const NFL_PLAYOFF_WEEKS = 3;
/** AGENTS.md: "14 regular weeks + 3 playoff weeks". Derived so it cannot drift. */
export const NFL_SEASON_WEEKS = NFL_REGULAR_SEASON_WEEKS + NFL_PLAYOFF_WEEKS;
export const NFL_PLAYOFF_ROUND_LABELS = ['Playoff Round 1', 'Semifinals', 'Championship'] as const;

/**
 * The name of a week. Weeks past the regular season are rounds, not numbers —
 * "Week 15 of 14" was the old answer, and it was wrong twice over.
 */
export function getNflWeekLabel(weekNumber: number) {
  if (weekNumber <= NFL_REGULAR_SEASON_WEEKS) {
    return `Week ${weekNumber} of ${NFL_REGULAR_SEASON_WEEKS}`;
  }

  return (
    NFL_PLAYOFF_ROUND_LABELS[weekNumber - NFL_REGULAR_SEASON_WEEKS - 1] ?? `Week ${weekNumber}`
  );
}
export const TEASER_MIN_LEGS: TeaserLegCount = 2;
export const TEASER_MAX_LEGS: TeaserLegCount = 4;

export const TEASER_ODDS_LOOKUP: Record<TeaserLegCount, Record<TeaserPoints, number>> = {
  2: {
    6: -110,
    6.5: -120,
    7: -130,
  },
  3: {
    6: 150,
    6.5: 130,
    7: 110,
  },
  4: {
    6: 250,
    6.5: 200,
    7: 160,
  },
};
