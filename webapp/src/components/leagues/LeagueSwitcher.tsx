import { useEffect, useRef, useState } from 'react';

import { Check, ChevronDown, Plus, Shield } from 'lucide-react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { useMyLeagues } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import { ROUTES, buildRoute } from '@/lib/routes';

/**
 * The top bar's league selector.
 *
 * "Current league" is read from the URL rather than held in shell state: the
 * league hub is the one route that names a league, and deriving it from the
 * path means the selector can never disagree with the page under it. Choosing a
 * league navigates to its hub.
 */
export function LeagueSwitcher() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const leaguesQuery = useMyLeagues(user?.id);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const leagues = leaguesQuery.data ?? [];
  const activeLeagueId = matchPath(ROUTES.league, location.pathname)?.params.leagueId ?? null;
  const activeLeague = leagues.find((summary) => summary.league.id === activeLeagueId) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const label = activeLeague
    ? activeLeague.league.name
    : leaguesQuery.isLoading
      ? 'Loading leagues…'
      : leagues.length === 0
        ? 'No leagues yet'
        : 'Select a league';

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-white/[0.04] px-3 py-2 text-left transition hover:bg-white/[0.07]"
        onClick={() => setIsOpen((open) => !open)}
        type="button">
        <span className="flex min-w-0 flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-textMuted">
            League
          </span>
          <span className="max-w-[14rem] truncate text-sm font-bold text-white/85">{label}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 shrink-0 text-white/45 transition', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen ? (
        <div
          className={cn(
            'absolute left-0 top-[calc(100%+0.5rem)] z-30 w-72 overflow-hidden rounded-2xl p-1.5',
            // Deliberately not `arena-glass`, and deliberately opaque. This
            // panel floats over page content, and the glass treatment's
            // translucent fill lets whatever is underneath read straight
            // through it. Its backdrop-blur cannot rescue that either: the
            // sticky header above is itself a backdrop-filter element, which
            // makes it a backdrop root, so a blur down here samples nothing of
            // the page behind the menu.
            'border border-white/10 bg-arena-surface shadow-[0_24px_64px_rgba(0,0,0,0.55)]',
          )}
          role="menu">
          {leagues.length === 0 ? (
            <p className="px-3 py-2 text-sm font-semibold text-textMuted">
              {leaguesQuery.isLoading ? 'Loading your leagues…' : 'You have not joined a league yet.'}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {leagues.map(({ league, memberCount }) => {
                const isActive = league.id === activeLeagueId;

                return (
                  <li key={league.id}>
                    <button
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition',
                        isActive
                          ? 'bg-electric-green/10 text-electric-green'
                          : 'text-white/80 hover:bg-white/[0.07] hover:text-white',
                      )}
                      onClick={() => {
                        setIsOpen(false);
                        navigate(buildRoute.league(league.id));
                      }}
                      role="menuitem"
                      type="button">
                      <Shield aria-hidden className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{league.name}</span>
                        <span className="block text-[11px] font-semibold text-textMuted">
                          Week {league.current_week} · {memberCount}/{league.max_members} players
                        </span>
                      </span>
                      {isActive ? <Check aria-hidden className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="my-1 h-px bg-border" />

          <Link
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold text-white/80 transition hover:bg-white/[0.07] hover:text-white"
            onClick={() => setIsOpen(false)}
            role="menuitem"
            to={ROUTES.leagues}>
            <Shield aria-hidden className="h-4 w-4" />
            All leagues
          </Link>
          <Link
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold text-white/80 transition hover:bg-white/[0.07] hover:text-white"
            onClick={() => setIsOpen(false)}
            role="menuitem"
            to={ROUTES.leagueCreate}>
            <Plus aria-hidden className="h-4 w-4" />
            Create a league
          </Link>
        </div>
      ) : null}
    </div>
  );
}
