import { Link } from 'react-router-dom';

import { PageStub } from '@/components/layout/PageStub';
import { Card } from '@/components/ui';
import { ROUTES, buildRoute } from '@/lib/routes';

/**
 * Scaffold aid: every route in the app, clickable. Parameterised routes use a
 * sample value. Delete this block when the real home screen lands.
 */
const ROUTE_DIRECTORY: Array<{ label: string; routes: Array<{ label: string; to: string }> }> = [
  {
    label: 'In shell',
    routes: [
      { label: 'Home', to: ROUTES.home },
      { label: 'Pick Board', to: ROUTES.picks },
      { label: 'Leagues', to: ROUTES.leagues },
      { label: 'Create League', to: ROUTES.leagueCreate },
      { label: 'Join League', to: ROUTES.leagueJoin },
      { label: 'League Detail', to: buildRoute.league('sample-league-id') },
      { label: 'Matchups', to: ROUTES.matchups },
      { label: 'Matchup Detail', to: buildRoute.matchup('sample-matchup-id') },
      { label: 'Leaderboard', to: ROUTES.leaderboard },
      { label: 'Profile', to: ROUTES.profile },
      { label: 'Member', to: buildRoute.member('sample-member-id') },
      { label: 'Pick Detail', to: buildRoute.bet('sample-bet-id') },
      { label: 'Analytics', to: ROUTES.analytics },
      { label: 'Settings', to: ROUTES.settings },
      { label: 'Notifications', to: ROUTES.notifications },
      { label: 'Season Pass', to: ROUTES.seasonPass },
      { label: 'Shop', to: ROUTES.shop },
      { label: 'Coin Store', to: ROUTES.coinStore },
      { label: 'Join by Invite', to: buildRoute.invite('ABC123') },
    ],
  },
  {
    label: 'Outside shell',
    routes: [
      { label: 'Log In', to: ROUTES.login },
      { label: 'Sign Up', to: ROUTES.signup },
      { label: 'Forgot Password', to: ROUTES.forgotPassword },
      { label: 'Reset Password', to: ROUTES.resetPassword },
      { label: 'Onboarding', to: ROUTES.onboarding },
      { label: 'Disclosure', to: ROUTES.disclosure },
      { label: 'Terms', to: ROUTES.terms },
      { label: 'Privacy', to: ROUTES.privacy },
    ],
  },
];

export function HomePage() {
  return (
    <PageStub
      description="The player's week at a glance: budget remaining, live picks, matchup state."
      route={ROUTES.home}
      title="Home">
      <Card className="flex flex-col gap-5">
        <div>
          <h2 className="arena-heading text-2xl leading-none">Route directory</h2>
          <p className="mt-1.5 text-sm text-textMuted">
            Scaffold aid — every stub route, clickable. Remove when the real home screen lands.
          </p>
        </div>

        {ROUTE_DIRECTORY.map((group) => (
          <div className="flex flex-col gap-2" key={group.label}>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.routes.map((route) => (
                <Link
                  className="rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-electric-green/40 hover:text-electric-green"
                  key={route.to}
                  to={route.to}>
                  {route.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </PageStub>
  );
}
