/**
 * Every route path in the web app, in one place.
 *
 * Use these constants instead of hardcoding strings, so a path change is a
 * one-line edit. Parameterised routes expose both the pattern (for <Route
 * path>) and a builder (for <Link to>).
 *
 * Paths mirror the mobile app/ file-based routes; see AGENTS.md.
 */

export const ROUTES = {
  // Auth — rendered outside the app shell.
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  onboarding: '/onboarding',

  // Legal — rendered outside the app shell.
  disclosure: '/disclosure',
  terms: '/terms',
  privacy: '/privacy',

  // App — rendered inside the app shell.
  home: '/',
  picks: '/picks',
  leagues: '/leagues',
  leagueCreate: '/leagues/create',
  leagueJoin: '/leagues/join',
  league: '/leagues/:leagueId',
  matchups: '/matchups',
  matchup: '/matchups/:matchupId',
  leaderboard: '/leaderboard',
  profile: '/profile',
  member: '/members/:memberId',
  bet: '/bets/:betId',
  analytics: '/analytics',
  settings: '/settings',
  notifications: '/notifications',
  seasonPass: '/season-pass',
  shop: '/shop',
  coinStore: '/coin-store',
  invite: '/join/:inviteCode',
} as const;

export const buildRoute = {
  league: (leagueId: string) => `/leagues/${leagueId}`,
  matchup: (matchupId: string) => `/matchups/${matchupId}`,
  member: (memberId: string) => `/members/${memberId}`,
  bet: (betId: string) => `/bets/${betId}`,
  invite: (inviteCode: string) => `/join/${inviteCode}`,
} as const;
