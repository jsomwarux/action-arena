import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { matchPath, useLocation, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/lib/routes';

/**
 * The one league the app is currently focused on.
 *
 * There used to be five answers to "which league am I looking at?" — the top
 * bar derived it from the URL, and Home, the Pick Board, the leaderboard and
 * the matchups index each kept their own `useState`. Only `/leagues/:leagueId`
 * names a league in its path, so on every other route the switcher fell back to
 * "Select a league" while the page beside it had happily resolved one. On the
 * Pick Board that put two league controls in the same viewport disagreeing:
 * the board's own picker read "WEB TEST LEAGUE", the top bar read "Select a
 * league". Choosing from the top bar only navigated to the league hub, so it
 * could never change what the current page showed.
 *
 * One id lives here, and the shell and the pages both read it:
 *
 * - A route that *names* a league wins — the `/leagues/:leagueId` path param,
 *   or a `?leagueId=` query (member cards and the board's deep link use it).
 *   Following a link to a league focuses it, so the switcher can never
 *   contradict a page that was opened for a specific league.
 * - Otherwise the last explicit choice stands, and it survives a reload.
 * - Pages reconcile it against the leagues they can actually show through
 *   `useFocusedLeagueId`, which writes the resolved id back so the switcher
 *   agrees rather than showing a league the page is not displaying.
 */
const STORAGE_KEY = 'action-arena.focused-league';

function readStoredLeagueId(): string | undefined {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    // Private mode and storage-blocked browsers: focus just does not persist.
    return undefined;
  }
}

function writeStoredLeagueId(leagueId: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, leagueId);
  } catch {
    // Advisory, exactly as in lib/storage.ts — never break the caller.
  }
}

type FocusedLeagueContextValue = {
  focusedLeagueId: string | undefined;
  setFocusedLeagueId: (leagueId: string) => void;
};

const FocusedLeagueContext = createContext<FocusedLeagueContextValue | null>(null);

/**
 * Renders inside <BrowserRouter> — it reads the location to adopt the league a
 * route names.
 */
export function FocusedLeagueProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [focusedLeagueId, setFocusedLeagueIdState] = useState<string | undefined>(
    readStoredLeagueId,
  );

  const routeLeagueId =
    matchPath(ROUTES.league, location.pathname)?.params.leagueId ??
    searchParams.get('leagueId') ??
    undefined;

  const setFocusedLeagueId = useCallback((leagueId: string) => {
    setFocusedLeagueIdState(leagueId);
    writeStoredLeagueId(leagueId);
  }, []);

  useEffect(() => {
    if (routeLeagueId) {
      setFocusedLeagueId(routeLeagueId);
    }
  }, [routeLeagueId, setFocusedLeagueId]);

  const value = useMemo(
    () => ({ focusedLeagueId, setFocusedLeagueId }),
    [focusedLeagueId, setFocusedLeagueId],
  );

  return <FocusedLeagueContext.Provider value={value}>{children}</FocusedLeagueContext.Provider>;
}

function useFocusedLeagueContext() {
  const context = useContext(FocusedLeagueContext);

  if (!context) {
    throw new Error('useFocusedLeagueId must be used inside FocusedLeagueProvider.');
  }

  return context;
}

/**
 * The focused league, reconciled against what this screen can actually show.
 *
 * `availableIds` is the screen's own list — the leaderboard only knows leagues
 * it has rows for, the matchups index only head-to-head ones. If the focused
 * league is not among them the screen falls back (to `fallbackId` when it has a
 * better idea than "the first one" — Home opens on the league that still needs
 * picks) and writes that back, so the top bar names the league the page is
 * really displaying instead of one it is not.
 */
export function useFocusedLeagueId(
  availableIds: string[],
  options: { fallbackId?: string } = {},
) {
  const { focusedLeagueId, setFocusedLeagueId } = useFocusedLeagueContext();
  const { fallbackId } = options;

  const resolvedLeagueId =
    focusedLeagueId && availableIds.includes(focusedLeagueId)
      ? focusedLeagueId
      : fallbackId && availableIds.includes(fallbackId)
        ? fallbackId
        : availableIds[0];

  useEffect(() => {
    if (resolvedLeagueId && resolvedLeagueId !== focusedLeagueId) {
      setFocusedLeagueId(resolvedLeagueId);
    }
  }, [focusedLeagueId, resolvedLeagueId, setFocusedLeagueId]);

  return { focusedLeagueId: resolvedLeagueId, setFocusedLeagueId };
}

/**
 * The raw focused id, for the shell. The top bar has no list of its own to
 * reconcile against — it renders whatever the leagues query returns — so it
 * reads the id directly.
 */
export function useFocusedLeague() {
  return useFocusedLeagueContext();
}
