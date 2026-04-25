import type { LeagueSport, LeagueType, LeagueVisibility } from '@/types/database';

export const LEAGUE_TYPE_OPTIONS: Array<{
  description: string;
  label: string;
  value: LeagueType;
}> = [
  {
    description: 'Weekly head-to-head matchups, records, playoffs, and a championship bracket.',
    label: 'Head-to-Head',
    value: 'h2h',
  },
  {
    description: 'No weekly opponents. The highest total profit across the season wins.',
    label: 'Cumulative',
    value: 'cumulative',
  },
];

export const LEAGUE_VISIBILITY_OPTIONS: Array<{
  description: string;
  label: string;
  value: LeagueVisibility;
}> = [
  {
    description: 'Visible in public league search. Anyone can request to join while spots remain.',
    label: 'Public',
    value: 'public',
  },
  {
    description: 'Hidden from browse. New members need the 6-character invite code.',
    label: 'Private',
    value: 'private',
  },
];

export const LEAGUE_SPORT_OPTIONS: Array<{
  disabled?: boolean;
  label: string;
  value: LeagueSport;
}> = [
  {
    label: 'NFL',
    value: 'nfl',
  },
  {
    disabled: true,
    label: 'NBA',
    value: 'nba',
  },
  {
    disabled: true,
    label: 'MLB',
    value: 'mlb',
  },
];

export const MAX_MEMBER_OPTIONS = [4, 6, 8, 10, 12] as const;
