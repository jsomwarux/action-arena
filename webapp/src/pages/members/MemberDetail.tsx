import { useEffect } from 'react';

import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';

import { ProfileContent } from '@/components/profile';
import { Card, LiveRefreshBadge, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { buildMemberComparison, useProfileData } from '@/hooks/use-profile-stats';
import { logAnalyticsEvent } from '@/lib/analytics';
import { buildRoute } from '@/lib/routes';

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton height={34} width="45%" />
      <Skeleton height={180} radius={20} />
      <Skeleton height={220} radius={20} />
    </div>
  );
}

/**
 * Another player's public profile.
 *
 * Port of app/(app)/members/[memberId].tsx. Visibility is exactly mobile's:
 * `useProfileData` runs the same queries under the same RLS policies, so this
 * page shows what a league member is allowed to see and nothing more. There is
 * no client-side unlock — a pick that is hidden simply does not come back.
 *
 * The league scope arrives with the link. Callers inside a league pass it, so
 * the scope switcher is hidden and the head-to-head block appears; reaching a
 * member without one falls back to their all-leagues view with no comparison,
 * which is what mobile does when the param is absent.
 */
export function MemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.id;

  // Two entry shapes exist in this app: the league surfaces pass the league in
  // router state (MembersPanel, StandingsBoard), the leaderboard puts it in the
  // query string so the row stays a shareable URL. Accept both.
  const stateLeagueId = (location.state as { leagueId?: string } | null)?.leagueId;
  const leagueId = searchParams.get('leagueId') ?? stateLeagueId ?? undefined;

  const profileQuery = useProfileData({
    leagueId,
    targetUserId: memberId,
    viewerUserId: userId,
  });

  useEffect(() => {
    if (!memberId) return;

    logAnalyticsEvent('profile_viewed', {
      league_id: leagueId,
      target_user_id: memberId,
      user_id: userId,
    });
  }, [leagueId, memberId, userId]);

  const comparison =
    profileQuery.data && leagueId && userId && memberId && userId !== memberId
      ? buildMemberComparison(profileQuery.data, leagueId, memberId, userId)
      : undefined;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          {leagueId ? (
            <Link
              className="flex w-fit items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-white/50 transition hover:text-electric-green"
              to={buildRoute.league(leagueId)}>
              <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
              Back to league
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
              <span className="text-xs font-black uppercase tracking-[0.14em] text-electric-green">
                Player Card
              </span>
            </div>
          )}
          <h1 className="arena-heading text-5xl leading-none">Member Profile</h1>
          <p className="text-textMuted">
            {leagueId
              ? 'Their record, picks and head-to-head history in this league.'
              : 'Their record and pick history across every shared league.'}
          </p>
        </div>
        <LiveRefreshBadge
          isLive={false}
          isRefreshing={profileQuery.isRefetching}
          lastRefreshedAt={profileQuery.dataUpdatedAt || Date.now()}
          onRefresh={() => void profileQuery.refetch()}
        />
      </header>

      {profileQuery.isLoading ? <LoadingState /> : null}

      {!profileQuery.isLoading && profileQuery.data ? (
        <ProfileContent
          comparison={comparison}
          data={profileQuery.data}
          initialLeagueId={leagueId ?? 'all'}
          readOnlyLeague={Boolean(leagueId)}
          title="Member Profile"
        />
      ) : null}

      {!profileQuery.isLoading && !profileQuery.data ? (
        <Card>
          <p className="text-base font-semibold text-white/55">Member profile is unavailable.</p>
        </Card>
      ) : null}
    </section>
  );
}
