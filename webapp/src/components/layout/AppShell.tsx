import { Outlet } from 'react-router-dom';

import { cn } from '@/lib/cn';

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * How wide the main content column is allowed to grow.
 *
 * - `default` (80rem / 1280px) — reading-oriented screens: forms, settings,
 *   detail pages, legal-ish text. Long line lengths hurt here.
 * - `wide` (120rem / 1920px) — dense screens that need the horizontal room a
 *   desktop client exists to provide: the Pick Board (games grid + persistent
 *   lineup rail), the league hub (standings beside live chat), matchup detail
 *   (two full pick sets side by side), and the leaderboard. Effectively full
 *   viewport on a 1920px monitor, still capped so ultrawides don't stretch
 *   content past readability.
 *
 * Both tiers keep the same gutters and stay usable down at 1280px.
 *
 * Set it per route in src/App.tsx — routes are grouped under two parent
 * <Route> elements, `<AppShell />` and `<AppShell width="wide" />`. To change a
 * screen's tier, move its <Route> between those two groups; nothing inside the
 * page component needs to know.
 */
export type ShellWidth = 'default' | 'wide';

const CONTENT_MAX_WIDTH: Record<ShellWidth, string> = {
  default: 'max-w-content',
  wide: 'max-w-content-wide',
};

export type AppShellProps = {
  width?: ShellWidth;
};

/**
 * The desktop chrome every in-app route renders inside: fixed left sidebar,
 * sticky top bar, and a max-width main content column.
 *
 * Auth and legal routes deliberately render outside this shell — see
 * src/App.tsx.
 */
export function AppShell({ width = 'default' }: AppShellProps) {
  return (
    <div className="min-h-full bg-arena-bg">
      <Sidebar />
      <div className="pl-sidebar">
        <TopBar />
        <main className={cn('mx-auto w-full px-8 py-8', CONTENT_MAX_WIDTH[width])}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
