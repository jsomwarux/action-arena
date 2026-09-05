import { useEffect } from 'react';

import { ChevronRight, Coins, LineChart, Ribbon, Settings, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CosmeticAvatar } from '@/components/cosmetics';
import { EquippedLocker, ProfileContent } from '@/components/profile';
import {
  AnimatedNumber,
  Badge,
  Card,
  LiveRefreshBadge,
  Skeleton,
  type BadgeTone,
  QueryErrorState,
} from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { useProfileData } from '@/hooks/use-profile-stats';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { logAnalyticsEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';

const QUICK_ACTIONS = [
  { icon: Store, label: 'Shop', to: ROUTES.shop },
  { icon: Coins, label: 'Coins', to: ROUTES.coinStore },
  { icon: Ribbon, label: 'Pass', to: ROUTES.seasonPass },
  { icon: LineChart, label: 'Analytics', to: ROUTES.analytics },
];

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton height={140} radius={20} />
      <Skeleton height={220} radius={20} />
      <Skeleton height={320} radius={20} />
    </div>
  );
}

/**
 * The signed-in player's own profile.
 *
 * Same screen as app/(app)/(tabs)/profile.tsx: the locker card (avatar, coin
 * balance, quick links, Season Pass state), the settings entry, then the whole
 * of <ProfileContent> scoped to every league the player has picks in.
 *
 * The desktop additions are both about the room a sidebar layout gives back:
 * the locker sits beside an equipped-cosmetics summary instead of sending the
 * player to the shop to find out what they have on, and the refresh that mobile
 * gets from pull-to-refresh is an explicit control.
 */
export function ProfilePage() {
  const { user } = useAuth();
  const userId = user?.id;

  const profileQuery = useProfileData({ targetUserId: userId, viewerUserId: userId });
  const cosmeticsQuery = useUserCosmetics(userId);
  const seasonPassQuery = useSeasonPass(userId);
  const hasSeasonPass = Boolean(seasonPassQuery.data);

  useEffect(() => {
    logAnalyticsEvent('profile_viewed', { screen: 'profile_tab', user_id: userId });
  }, [userId]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            <span className="text-xs font-black uppercase tracking-[0.14em] text-electric-green">
              Locker
            </span>
          </div>
          <h1 className="arena-heading text-5xl leading-none">My Profile</h1>
          <p className="text-textMuted">
            Season profit, pick history and everything you have equipped.
          </p>
        </div>
        <LiveRefreshBadge
          isLive={false}
          isRefreshing={profileQuery.isRefetching}
          lastRefreshedAt={profileQuery.dataUpdatedAt || Date.now()}
          onRefresh={() => {
            void profileQuery.refetch();
            void cosmeticsQuery.refetch();
            void seasonPassQuery.refetch();
          }}
        />
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="flex flex-col gap-4 p-6" tone="highlight">
          <div className="flex items-center gap-4">
            <CosmeticAvatar
              cosmetics={cosmeticsQuery.data?.equippedByCategory}
              name={profileQuery.data?.profile.display_name ?? user?.email ?? 'Player'}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-2xl font-extrabold tracking-[-0.3px] text-white">
                {profileQuery.data?.profile.display_name ?? user?.email ?? 'Player'}
              </p>
              <p className="mt-0.5 flex items-baseline gap-1.5">
                <AnimatedNumber
                  className="text-lg font-extrabold tracking-[-0.3px] tabular-nums text-white"
                  value={cosmeticsQuery.data?.coinBalance ?? 0}
                />
                <span className="text-xs font-medium text-white/55">Arena Coins</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_ACTIONS.map(({ icon: Icon, label, to }) => (
              <Link
                className="arena-card-interactive flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3"
                key={to}
                to={to}>
                <Icon aria-hidden className="h-[17px] w-[17px] text-electric-green" />
                <span className="truncate text-[11px] font-semibold text-white/75">{label}</span>
              </Link>
            ))}
          </div>

          <div
            className={
              hasSeasonPass
                ? 'flex items-center justify-between gap-3 rounded-2xl border border-electric-green/35 bg-electric-green/10 p-3'
                : 'flex items-center justify-between gap-3 rounded-2xl border border-gold/35 bg-gold/10 p-3'
            }>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Ribbon
                aria-hidden
                className={hasSeasonPass ? 'h-4 w-4 text-electric-green' : 'h-4 w-4 text-gold'}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                {hasSeasonPass ? 'Season Pass holder' : 'Season Pass preview available'}
              </span>
            </span>
            <Badge
              label={hasSeasonPass ? 'Active' : 'Free'}
              tone={(hasSeasonPass ? 'green' : 'gold') satisfies BadgeTone}
            />
          </div>

          <Link
            className="arena-row-interactive flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
            to={ROUTES.settings}>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[1.2px] text-electric-green">
                Preferences
              </span>
              <span className="mt-0.5 block text-base font-extrabold tracking-[-0.2px] text-white">
                App Settings
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-electric-green">
              <Settings aria-hidden className="h-5 w-5" />
              <ChevronRight aria-hidden className="h-4 w-4" />
            </span>
          </Link>
        </Card>

        <EquippedLocker
          cosmetics={cosmeticsQuery.data?.equippedByCategory}
          isLoading={cosmeticsQuery.isLoading}
        />
      </div>

      {profileQuery.isLoading ? <LoadingState /> : null}

      {!profileQuery.isLoading && profileQuery.data ? (
        <ProfileContent data={profileQuery.data} title="My Profile" />
      ) : null}

      {!profileQuery.isLoading && profileQuery.isError ? (
        <Card>
          <QueryErrorState
            error={profileQuery.error}
            fallback="We could not load your profile right now."
            onRetry={() => void profileQuery.refetch()}
            retrying={profileQuery.isFetching}
            title="Profile Unavailable"
          />
        </Card>
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && !profileQuery.data ? (
        <Card>
          <p className="text-base font-semibold text-white/55">Profile data is unavailable.</p>
        </Card>
      ) : null}
    </section>
  );
}
