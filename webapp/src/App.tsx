import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { AuthShell } from '@/components/layout/AuthShell';
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
 * The whole route tree.
 *
 * Two groups: everything under <AppShell> gets the desktop chrome (sidebar +
 * top bar); auth, onboarding and legal render bare inside <AuthShell>.
 *
 * TODO(webapp): these routes are all public right now. An auth guard wraps the
 * <AppShell> branch once the session provider lands.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth + onboarding — outside the app shell. */}
        <Route
          element={
            <AuthShell>
              <LoginPage />
            </AuthShell>
          }
          path={ROUTES.login}
        />
        <Route
          element={
            <AuthShell>
              <SignupPage />
            </AuthShell>
          }
          path={ROUTES.signup}
        />
        <Route
          element={
            <AuthShell>
              <ForgotPasswordPage />
            </AuthShell>
          }
          path={ROUTES.forgotPassword}
        />
        <Route
          element={
            <AuthShell>
              <ResetPasswordPage />
            </AuthShell>
          }
          path={ROUTES.resetPassword}
        />
        <Route
          element={
            <AuthShell>
              <OnboardingPage />
            </AuthShell>
          }
          path={ROUTES.onboarding}
        />

        {/* Legal — outside the app shell. */}
        <Route
          element={
            <AuthShell>
              <DisclosurePage />
            </AuthShell>
          }
          path={ROUTES.disclosure}
        />
        <Route
          element={
            <AuthShell>
              <TermsPage />
            </AuthShell>
          }
          path={ROUTES.terms}
        />
        <Route
          element={
            <AuthShell>
              <PrivacyPage />
            </AuthShell>
          }
          path={ROUTES.privacy}
        />

        {/* Dense screens — wide content tier. See AppShell's ShellWidth docs.
            Move a <Route> between this group and the one below to change its
            width tier; the page component itself needs no changes. */}
        <Route element={<AppShell width="wide" />}>
          <Route element={<PicksPage />} path={ROUTES.picks} />
          <Route element={<LeagueDetailPage />} path={ROUTES.league} />
          <Route element={<MatchupDetailPage />} path={ROUTES.matchup} />
          <Route element={<LeaderboardPage />} path={ROUTES.leaderboard} />
        </Route>

        {/* Everything else — default (reading) content tier. */}
        <Route element={<AppShell />}>
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

          <Route element={<InviteJoinPage />} path={ROUTES.invite} />

          <Route element={<NotFoundPage />} path="*" />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
