import { lazy, Suspense } from 'react';

import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { RequireAnon } from '@/components/auth/RequireAnon';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppShell } from '@/components/layout/AppShell';
import { AuthShell, type AuthShellWidth } from '@/components/layout/AuthShell';
import { DocumentTitle } from '@/components/layout/DocumentTitle';
import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { ROUTES } from '@/lib/routes';
import { FocusedLeagueProvider } from '@/providers/focused-league';
import { NotFoundPage } from '@/pages/NotFound';
import { OnboardingPage } from '@/pages/Onboarding';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPassword';
import { LoginPage } from '@/pages/auth/Login';
import { ResetPasswordPage } from '@/pages/auth/ResetPassword';
import { SignupPage } from '@/pages/auth/Signup';

/**
 * Route-level code splitting.
 *
 * Every route used to ship in one 1.05 MB chunk — /terms and /privacy
 * included — which a desktop SPA behind a login has no reason to do. The four
 * screens that can be a player's *first* paint stay eager, because a Suspense
 * fallback on the sign-in screen is a flash of nothing before the first thing
 * they ever see: the auth pages, onboarding, and the 404. Every other route is
 * fetched when it is first visited, behind the same <FullPageLoader> the auth
 * guards already show.
 */
const AnalyticsPage = lazy(() =>
  import('@/pages/Analytics').then((m) => ({ default: m.AnalyticsPage })),
);
const BetDetailPage = lazy(() =>
  import('@/pages/bets/BetDetail').then((m) => ({ default: m.BetDetailPage })),
);
const CoinStorePage = lazy(() =>
  import('@/pages/CoinStore').then((m) => ({ default: m.CoinStorePage })),
);
const CreateLeaguePage = lazy(() =>
  import('@/pages/leagues/CreateLeague').then((m) => ({ default: m.CreateLeaguePage })),
);
const DisclosurePage = lazy(() =>
  import('@/pages/legal/Disclosure').then((m) => ({ default: m.DisclosurePage })),
);
const HomePage = lazy(() => import('@/pages/Home').then((m) => ({ default: m.HomePage })));
const InviteJoinPage = lazy(() =>
  import('@/pages/join/InviteJoin').then((m) => ({ default: m.InviteJoinPage })),
);
const JoinLeaguePage = lazy(() =>
  import('@/pages/leagues/JoinLeague').then((m) => ({ default: m.JoinLeaguePage })),
);
const LeaderboardPage = lazy(() =>
  import('@/pages/Leaderboard').then((m) => ({ default: m.LeaderboardPage })),
);
const LeagueDetailPage = lazy(() =>
  import('@/pages/leagues/LeagueDetail').then((m) => ({ default: m.LeagueDetailPage })),
);
const LeaguesIndexPage = lazy(() =>
  import('@/pages/leagues/LeaguesIndex').then((m) => ({ default: m.LeaguesIndexPage })),
);
const MatchupDetailPage = lazy(() =>
  import('@/pages/matchups/MatchupDetail').then((m) => ({ default: m.MatchupDetailPage })),
);
const MatchupsIndexPage = lazy(() =>
  import('@/pages/matchups/MatchupsIndex').then((m) => ({ default: m.MatchupsIndexPage })),
);
const MemberDetailPage = lazy(() =>
  import('@/pages/members/MemberDetail').then((m) => ({ default: m.MemberDetailPage })),
);
const NotificationPreferencesPage = lazy(() =>
  import('@/pages/notifications/Preferences').then((m) => ({
    default: m.NotificationPreferencesPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('@/pages/Notifications').then((m) => ({ default: m.NotificationsPage })),
);
const PicksPage = lazy(() => import('@/pages/Picks').then((m) => ({ default: m.PicksPage })));
const PrivacyPage = lazy(() =>
  import('@/pages/legal/Privacy').then((m) => ({ default: m.PrivacyPage })),
);
const ProfilePage = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.ProfilePage })));
const SeasonPassPage = lazy(() =>
  import('@/pages/SeasonPass').then((m) => ({ default: m.SeasonPassPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })),
);
const ShopPage = lazy(() => import('@/pages/Shop').then((m) => ({ default: m.ShopPage })));
const TermsPage = lazy(() => import('@/pages/legal/Terms').then((m) => ({ default: m.TermsPage })));


/**
 * A screen with the auth-page chrome and, optionally, one of the guards.
 *
 * `guard` mirrors the mobile layout files: 'anon' is app/(auth)/_layout.tsx
 * (signed-in players bounce home, first-run players see onboarding first),
 * 'auth-pre-disclosure' is app/(app)/_layout.tsx minus the disclosure check,
 * which only /disclosure itself needs.
 */
function bare(
  element: JSX.Element,
  {
    guard,
    hideWordmark = false,
    width = 'md',
  }: {
    guard?: 'anon' | 'auth-pre-disclosure';
    hideWordmark?: boolean;
    width?: AuthShellWidth;
  } = {},
) {
  const shell = (
    <AuthShell hideWordmark={hideWordmark} width={width}>
      {element}
    </AuthShell>
  );

  if (guard === 'anon') {
    return <RequireAnon>{shell}</RequireAnon>;
  }

  if (guard === 'auth-pre-disclosure') {
    return <RequireAuth allowBeforeDisclosure>{shell}</RequireAuth>;
  }

  return shell;
}

/**
 * The whole route tree.
 *
 * Two groups: everything under <AppShell> gets the desktop chrome (sidebar +
 * top bar) behind <RequireAuth>; auth, onboarding, invite and legal render bare
 * inside <AuthShell>.
 */
export default function App() {
  return (
    <BrowserRouter>
      <FocusedLeagueProvider>
        <DocumentTitle />
        <Suspense fallback={<FullPageLoader />}>
        <Routes>
          {/* Auth — outside the app shell.

              /reset-password is deliberately unguarded. A recovery link signs the
              player in on the way to this screen, so RequireAnon would bounce
              them home before they could set a password. Mobile carves out the
              same route with its `isPasswordResetRoute` flag. */}
          <Route
            element={bare(<LoginPage />, { guard: 'anon', hideWordmark: true })}
            path={ROUTES.login}
          />
          <Route
            element={bare(<SignupPage />, { guard: 'anon', hideWordmark: true })}
            path={ROUTES.signup}
          />
          <Route
            element={bare(<ForgotPasswordPage />, { guard: 'anon', hideWordmark: true })}
            path={ROUTES.forgotPassword}
          />
          <Route
            element={bare(<ResetPasswordPage />, { hideWordmark: true })}
            path={ROUTES.resetPassword}
          />
          {/* Onboarding renders bare — it is a full-width pitch screen, not a
              centred card, so it deliberately skips <AuthShell>. */}
          <Route element={<OnboardingPage />} path={ROUTES.onboarding} />

          {/* Invite landing — outside the app shell so a signed-out player can
              reach it and bank the code before any redirect. */}
          <Route element={bare(<InviteJoinPage />, { hideWordmark: true })} path={ROUTES.invite} />

          {/* Legal — outside the app shell. The disclosure is a gate, so unlike
              terms and privacy it needs a session to acknowledge against. */}
          <Route
            element={bare(<DisclosurePage />, {
              guard: 'auth-pre-disclosure',
              hideWordmark: true,
              width: 'xl',
            })}
            path={ROUTES.disclosure}
          />
          {/* Terms and Privacy render bare rather than inside <AuthShell>: they
              are long-form documents with headed sections, lists and a table, and
              AuthShell's widest tier is a 36rem card. LegalPage supplies their own
              reading column, wordmark and back control. */}
          <Route element={<TermsPage />} path={ROUTES.terms} />
          <Route element={<PrivacyPage />} path={ROUTES.privacy} />

          {/* Dense screens — wide content tier. See AppShell's ShellWidth docs.
              Move a <Route> between this group and the one below to change its
              width tier; the page component itself needs no changes. */}
          <Route
            element={
              <RequireAuth>
                <AppShell width="wide" />
              </RequireAuth>
            }>
            <Route element={<PicksPage />} path={ROUTES.picks} />
            <Route element={<LeagueDetailPage />} path={ROUTES.league} />
            <Route element={<MatchupDetailPage />} path={ROUTES.matchup} />
            <Route element={<LeaderboardPage />} path={ROUTES.leaderboard} />
          </Route>

          {/* Everything else — default (reading) content tier. */}
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }>
            <Route element={<HomePage />} index />

            <Route element={<LeaguesIndexPage />} path={ROUTES.leagues} />
            <Route element={<CreateLeaguePage />} path={ROUTES.leagueCreate} />
            <Route element={<JoinLeaguePage />} path={ROUTES.leagueJoin} />

            <Route element={<MatchupsIndexPage />} path={ROUTES.matchups} />

            <Route element={<ProfilePage />} path={ROUTES.profile} />
            <Route element={<MemberDetailPage />} path={ROUTES.member} />
            <Route element={<BetDetailPage />} path={ROUTES.bet} />

            <Route element={<AnalyticsPage />} path={ROUTES.analytics} />
            <Route element={<SettingsPage />} path={ROUTES.settings} />
            <Route element={<NotificationsPage />} path={ROUTES.notifications} />
            <Route
              element={<NotificationPreferencesPage />}
              path={ROUTES.notificationPreferences}
            />

            <Route element={<SeasonPassPage />} path={ROUTES.seasonPass} />
            <Route element={<ShopPage />} path={ROUTES.shop} />
            <Route element={<CoinStorePage />} path={ROUTES.coinStore} />

            <Route element={<NotFoundPage />} path="*" />
          </Route>
          </Routes>
        </Suspense>
      </FocusedLeagueProvider>
    </BrowserRouter>
  );
}
