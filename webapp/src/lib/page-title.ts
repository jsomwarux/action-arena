import { useEffect } from 'react';

import { matchPath } from 'react-router-dom';

import { ROUTES } from '@/lib/routes';

/**
 * What the browser tab says.
 *
 * Every route had the same `<title>Action Arena</title>` from index.html, which
 * on a desktop client is a real cost: a player with the Pick Board, their
 * matchup and the leaderboard open on a Sunday saw three identical tabs.
 *
 * The name goes last so the distinguishing half survives tab truncation —
 * "Pick Board · Action Arena" reads as "Pick Board…" at narrow widths, which is
 * the useful half.
 */
export const APP_NAME = 'Action Arena';

export function formatPageTitle(title?: string | null) {
  return title ? `${title} · ${APP_NAME}` : APP_NAME;
}

/**
 * Ordered most-specific first: `matchPath` with `end: true` still needs
 * `/leagues/create` to be tested before `/leagues/:leagueId`, since both match
 * that pathname exactly.
 */
const ROUTE_TITLES: { path: string; title: string }[] = [
  { path: ROUTES.login, title: 'Sign In' },
  { path: ROUTES.signup, title: 'Create Account' },
  { path: ROUTES.forgotPassword, title: 'Reset Password' },
  { path: ROUTES.resetPassword, title: 'Set a New Password' },
  { path: ROUTES.onboarding, title: 'Welcome' },
  { path: ROUTES.disclosure, title: 'Disclosure' },
  { path: ROUTES.terms, title: 'Terms of Service' },
  { path: ROUTES.privacy, title: 'Privacy Policy' },
  { path: ROUTES.invite, title: 'League Invite' },

  { path: ROUTES.picks, title: 'Pick Board' },
  { path: ROUTES.leagueCreate, title: 'Create a League' },
  { path: ROUTES.leagueJoin, title: 'Join a League' },
  { path: ROUTES.leagues, title: 'Leagues' },
  { path: ROUTES.league, title: 'League' },
  { path: ROUTES.matchups, title: 'Matchups' },
  { path: ROUTES.matchup, title: 'Matchup' },
  { path: ROUTES.leaderboard, title: 'Leaderboard' },
  { path: ROUTES.profile, title: 'Profile' },
  { path: ROUTES.member, title: 'Player Card' },
  { path: ROUTES.bet, title: 'Pick Detail' },
  { path: ROUTES.analytics, title: 'Strategy Lab' },
  { path: ROUTES.settings, title: 'Settings' },
  { path: ROUTES.notificationPreferences, title: 'Alert Settings' },
  { path: ROUTES.notifications, title: 'Notifications' },
  { path: ROUTES.seasonPass, title: 'Season Pass' },
  { path: ROUTES.shop, title: 'Arena Locker' },
  { path: ROUTES.coinStore, title: 'Arena Coins' },
  { path: ROUTES.home, title: 'Home' },
];

export function titleForPath(pathname: string) {
  const match = ROUTE_TITLES.find((entry) => matchPath({ end: true, path: entry.path }, pathname));
  return formatPageTitle(match?.title ?? 'Off the Board');
}

/**
 * A more specific title than the route alone can know — a league's name, an
 * opponent's name. Pass `undefined` while the data is still loading and the
 * route-level title stands.
 *
 * The route-level effect lives above this in the tree, so on a navigation it
 * runs first and this overwrites it; there is no frame where the old page's
 * specific title sits over the new page.
 */
export function useDocumentTitle(title: string | undefined | null) {
  useEffect(() => {
    if (!title) {
      return;
    }

    document.title = formatPageTitle(title);
  }, [title]);
}
