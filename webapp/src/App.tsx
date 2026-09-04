import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { RequireAnon } from '@/components/auth/RequireAnon';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppShell } from '@/components/layout/AppShell';
import { AuthShell, type AuthShellWidth } from '@/components/layout/AuthShell';
import { ROUTES } from '@/lib/routes';
import { AnalyticsPage } from '@/pages/Analytics';
import { CoinStorePage } from '@/pages/CoinStore';
import { HomePage } from '@/pages/Home';
import { LeaderboardPage } from '@/pages/Leaderboard';
import { NotFoundPage } from '@/pages/NotFound';
import { NotificationsPage } from '@/pages/Notifications';
import { OnboardingPage } from '@/pages/Onboarding';
import { PicksPage } from '@/pages/Picks';
import { ProfilePage } from '@/pages/Profile';
import { SeasonPassPage } from '@/pages/SeasonPass';
import { SettingsPage } from '@/pages/Settings';
import { ShopPage } from '@/pages/Shop';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPassword';
import { LoginPage } from '@/pages/auth/Login';
import { ResetPasswordPage } from '@/pages/auth/ResetPassword';
import { SignupPage } from '@/pages/auth/Signup';
import { BetDetailPage } from '@/pages/bets/BetDetail';
import { InviteJoinPage } from '@/pages/join/InviteJoin';
import { CreateLeaguePage } from '@/pages/leagues/CreateLeague';
import { JoinLeaguePage } from '@/pages/leagues/JoinLeague';
import { LeagueDetailPage } from '@/pages/leagues/LeagueDetail';
import { LeaguesIndexPage } from '@/pages/leagues/LeaguesIndex';
import { DisclosurePage } from '@/pages/legal/Disclosure';
import { PrivacyPage } from '@/pages/legal/Privacy';
import { TermsPage } from '@/pages/legal/Terms';
import { MatchupDetailPage } from '@/pages/matchups/MatchupDetail';
import { MatchupsIndexPage } from '@/pages/matchups/MatchupsIndex';
import { MemberDetailPage } from '@/pages/members/MemberDetail';

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
        <Route element={bare(<TermsPage />, { width: 'xl' })} path={ROUTES.terms} />
        <Route element={bare(<PrivacyPage />, { width: 'xl' })} path={ROUTES.privacy} />

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

          <Route element={<SeasonPassPage />} path={ROUTES.seasonPass} />
          <Route element={<ShopPage />} path={ROUTES.shop} />
          <Route element={<CoinStorePage />} path={ROUTES.coinStore} />

          <Route element={<NotFoundPage />} path="*" />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
