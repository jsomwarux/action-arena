import type { TeaserLegCount, TeaserPoints } from '@/types/database';

export const WEEKLY_BUDGET = 100;
export const MINIMUM_BETS_PER_WEEK = 5;
export const MAX_SINGLE_BET = 35;
export const PARLAY_PAYOUT_CAP = 500;
export const DEFAULT_MAX_LEAGUE_MEMBERS = 10;
export const DEFAULT_MIN_LEAGUE_MEMBERS = 2;
export const DEFAULT_LEAGUE_SEASON_WEEKS = 17;
export const NFL_REGULAR_SEASON_WEEKS = 14;
export const NFL_PLAYOFF_WEEKS = 3;

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
