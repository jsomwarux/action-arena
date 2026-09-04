import { Activity, Flame, Shield, Swords, Trophy, UserCircle, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

type NavItem = {
  end?: boolean;
  icon: LucideIcon;
  label: string;
  to: string;
};

/**
 * Desktop primary navigation. This replaces the mobile bottom tab bar
 * (app/(app)/(tabs)/_layout.tsx) — same destinations, laid out vertically.
 */
const NAV_ITEMS: NavItem[] = [
  { end: true, icon: Flame, label: 'Home', to: ROUTES.home },
  { icon: Activity, label: 'Pick Board', to: ROUTES.picks },
  { icon: Shield, label: 'Leagues', to: ROUTES.leagues },
  { icon: Swords, label: 'Matchups', to: ROUTES.matchups },
  { icon: Trophy, label: 'Leaderboard', to: ROUTES.leaderboard },
  { icon: UserCircle, label: 'Profile', to: ROUTES.profile },
];

export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-30 flex w-sidebar flex-col border-r border-border bg-arena-surface/60 backdrop-blur-xl">
      <div className="flex h-topbar shrink-0 items-center border-b border-border px-5">
        <NavLink className="flex items-baseline gap-1.5" to={ROUTES.home}>
          <span className="arena-heading text-2xl leading-none">Action</span>
          <span className="arena-heading text-2xl leading-none text-electric-green">Arena</span>
        </NavLink>
      </div>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ end, icon: Icon, label, to }) => (
          <li key={to}>
            <NavLink
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold uppercase tracking-[0.08em]',
                  'transition duration-150 ease-arena',
                  isActive
                    ? 'bg-electric-green/10 text-electric-green'
                    : 'text-white/60 hover:bg-white/5 hover:text-white',
                )
              }
              end={end}
              to={to}>
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      'h-5 w-0.5 rounded-full transition',
                      isActive ? 'bg-electric-green' : 'bg-transparent',
                    )}
                  />
                  <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                  <span className="min-w-0 truncate">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="border-t border-border px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-textMuted">
          No real money is wagered
        </p>
      </div>
    </nav>
  );
}
