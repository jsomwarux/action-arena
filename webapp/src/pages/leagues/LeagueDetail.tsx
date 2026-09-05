import { useEffect, useMemo, useRef, useState } from 'react';

import { AlertTriangle, ChevronLeft, Globe, Lock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { InviteShare } from '@/components/leagues/InviteShare';
import { LeagueChatPanel } from '@/components/leagues/LeagueChatPanel';
import { LeagueSettingsPanel } from '@/components/leagues/LeagueSettingsPanel';
import { MatchupSpotlight } from '@/components/leagues/MatchupSpotlight';
import { MembersPanel } from '@/components/leagues/MembersPanel';
import { SchedulePanel } from '@/components/leagues/SchedulePanel';
import { StandingsBoard } from '@/components/leagues/StandingsBoard';
import { WeeklyAwardsCard } from '@/components/leagues/WeeklyAwardsCard';
import { Badge, Button, Card, Modal, Notice, QueryErrorState, Skeleton, WeekNavigator } from '@/components/ui';
import { useEquippedCosmeticsForUsers } from '@/hooks/use-cosmetics';
import { useAuth } from '@/hooks/use-auth';
import { useReportContentMutation } from '@/hooks/use-content-moderation';
import { useLeagueDetail, type LeagueDetail as LeagueDetailData } from '@/hooks/use-leagues';
import { useWeeklyAwards } from '@/hooks/use-profile-stats';
import { formatLeagueType, formatSport } from '@/lib/format';
import {
  getLeagueMemberPrimaryName,
  getLeagueMemberSecondaryName,
} from '@/lib/league-member-display';
import { useDocumentTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import type { StandingRow } from '@/types/database';

/**
 * The standings snapshot for a week: the newest saved standings row at or
 * before it, ranked. Same reducer as the mobile hub.
 */
function getStandingsSnapshotForWeek(detail: LeagueDetailData, weekNumber: number) {
  const snapshotWeekNumber = detail.standings.reduce<number | null>((latestWeek, standing) => {
    if (standing.week_number > weekNumber) {
      return latestWeek;
    }

    if (latestWeek === null || standing.week_number > latestWeek) {
      return standing.week_number;
    }

    return latestWeek;
  }, null);

  if (snapshotWeekNumber === null) {
    return { standings: [] as StandingRow[], weekNumber: null };
  }

  return {
    standings: detail.standings
      .filter((standing) => standing.week_number === snapshotWeekNumber)
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }

        if (left.total_profit !== right.total_profit) {
          return right.total_profit - left.total_profit;
        }

        return left.user_id.localeCompare(right.user_id);
      }),
    weekNumber: snapshotWeekNumber,
  };
}

function getUserMatchupForWeek(detail: LeagueDetailData, userId: string, weekNumber: number) {
  return (
    detail.matchups.find(
      (matchup) =>
        matchup.week_number === weekNumber &&
        (matchup.home_user_id === userId || matchup.away_user_id === userId),
    ) ?? null
  );
}

function BackLink() {
  return (
    <Link
      className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-white/55 transition hover:text-electric-green"
      to={ROUTES.leagues}>
      <ChevronLeft aria-hidden className="h-4 w-4" />
      All leagues
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton height={44} width="34%" />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-7">
          <Skeleton height={160} radius={16} />
          <Skeleton height={360} radius={16} />
        </div>
        <div className="xl:col-span-5">
          <Skeleton height={520} radius={16} />
        </div>
      </div>
    </div>
  );
}

/**
 * The league hub — the screen desktop changes most.
 *
 * Mobile stacks standings, schedule, members and chat into four tabs, so a
 * player can only ever see one of them. Here standings and live chat sit side
 * by side, and members, the schedule and the commissioner's controls are all a
 * scroll away rather than a tab away.
 */
export function LeagueDetailPage() {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const detailQuery = useLeagueDetail(leagueId, user?.id);
  const reportContent = useReportContentMutation(user?.id);

  const [selectedWeek, setSelectedWeek] = useState<number | undefined>();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const selectedWeekLeagueRef = useRef<string | undefined>(undefined);

  const detail = detailQuery.data;

  // A player with three leagues open on a Sunday should be able to tell the
  // tabs apart. Undefined while loading, so the generic route title stands.
  useDocumentTitle(detail?.league.name);
  const selectedWeekNumber = selectedWeek ?? detail?.league.current_week ?? 1;
  const selectedWeekAwardsNumber =
    detail && selectedWeekNumber <= detail.league.current_week ? selectedWeekNumber : undefined;
  const awardsQuery = useWeeklyAwards(leagueId, selectedWeekAwardsNumber);

  const cosmeticUserIds = useMemo(
    () =>
      detail
        ? [
            detail.league.commissioner_id,
            ...detail.members.map((member) => member.user_id),
            ...(detail.seasonSnapshot?.champion_user_id
              ? [detail.seasonSnapshot.champion_user_id]
              : []),
          ]
        : [],
    [detail],
  );
  const cosmeticsQuery = useEquippedCosmeticsForUsers(cosmeticUserIds);

  // Reset the week when the league changes; otherwise keep the player's pick.
  useEffect(() => {
    const league = detail?.league;

    if (!league) {
      return;
    }

    if (selectedWeekLeagueRef.current !== league.id) {
      selectedWeekLeagueRef.current = league.id;
      setSelectedWeek(league.current_week);
      return;
    }

    setSelectedWeek((existingWeek) => existingWeek ?? league.current_week);
  }, [detail?.league]);

  if (detailQuery.isLoading) {
    return <DetailSkeleton />;
  }

  // A failed fetch is not "you are not a member" — it used to be reported as one.
  if (detailQuery.isError) {
    return (
      <section className="flex flex-col gap-6">
        <BackLink />
        <Card className="py-10">
          <QueryErrorState
            error={detailQuery.error}
            fallback="We could not load this league right now."
            onRetry={() => void detailQuery.refetch()}
            retrying={detailQuery.isFetching}
            title="League Unavailable"
          />
        </Card>
      </section>
    );
  }

  if (!detail || !user) {
    return (
      <section className="flex flex-col gap-6">
        <BackLink />
        <Card className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-coral-red/40 bg-coral-red/10">
            <AlertTriangle aria-hidden className="h-7 w-7 text-coral-red" />
          </span>
          <h1 className="arena-heading text-3xl leading-none">League Unavailable</h1>
          <p className="max-w-sm text-base font-semibold text-white/55">
            You may need to join this league before viewing it.
          </p>
        </Card>
      </section>
    );
  }

  const userId = user.id;
  const snapshot = getStandingsSnapshotForWeek(detail, selectedWeekNumber);
  const selectedDetail: LeagueDetailData = {
    ...detail,
    currentUserMatchup: getUserMatchupForWeek(detail, userId, selectedWeekNumber),
    standings: snapshot.standings,
  };
  const currentUserMatchup = selectedDetail.currentUserMatchup;
  const cosmeticsByUserId = cosmeticsQuery.data ?? {};
  const isPrivate = detail.league.visibility === 'private';

  const selectedWeekSettled = Boolean(
    selectedDetail.standings.some(
      (standing) =>
        standing.weekly_profit !== 0 ||
        standing.wins !== 0 ||
        standing.losses !== 0 ||
        standing.ties !== 0,
    ) ||
      (awardsQuery.data?.isFullySettled && selectedWeekAwardsNumber === selectedWeekNumber),
  );

  const seasonFirstKickoffTime = detail.seasonFirstKickoffAt
    ? new Date(detail.seasonFirstKickoffAt).getTime()
    : null;
  const seasonInProgress =
    seasonFirstKickoffTime !== null &&
    !Number.isNaN(seasonFirstKickoffTime) &&
    Date.now() >= seasonFirstKickoffTime;

  const viewerMember = detail.members.find((member) => member.user_id === userId);
  const viewerProfile = detail.profilesById[userId];
  const opponentId =
    currentUserMatchup?.home_user_id === userId
      ? currentUserMatchup.away_user_id
      : (currentUserMatchup?.home_user_id ?? null);
  const opponentMember = opponentId
    ? detail.members.find((member) => member.user_id === opponentId)
    : undefined;
  const opponentProfile = opponentId ? detail.profilesById[opponentId] : undefined;
  const viewerStanding = selectedDetail.standings.find((standing) => standing.user_id === userId);

  const submitLeagueReport = async () => {
    try {
      await reportContent.mutateAsync({
        contentSnapshot: {
          commissioner_id: detail.league.commissioner_id,
          description: detail.league.description,
          name: detail.league.name,
          visibility: detail.league.visibility,
        },
        leagueId: detail.league.id,
        reportedUserId: detail.league.commissioner_id,
        targetId: detail.league.id,
        targetType: 'league',
      });
      setIsReportOpen(false);
      setReportError(null);
      setReportStatus('Report sent. This league name was flagged for moderation review.');
    } catch (error) {
      setIsReportOpen(false);
      setReportStatus(null);
      setReportError(error instanceof Error ? error.message : 'Could not report league.');
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <BackLink />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-green">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            League HQ
          </span>
          <h1 className="arena-heading mt-1 text-5xl leading-none">{detail.league.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              label={formatLeagueType(detail.league.type)}
              tone={detail.league.type === 'h2h' ? 'cyan' : 'gold'}
            />
            <Badge
              icon={isPrivate ? Lock : Globe}
              label={detail.league.visibility}
              tone={isPrivate ? 'red' : 'green'}
            />
            <Badge label={formatSport(detail.league.sport)} tone="green" />
          </div>
        </div>

        <WeekNavigator
          onChange={setSelectedWeek}
          week={selectedWeekNumber}
        />
      </header>

      {reportStatus ? <Notice tone="success">{reportStatus}</Notice> : null}
      {reportError ? <Notice tone="error">{reportError}</Notice> : null}

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-7">
          {detail.league.type === 'h2h' || currentUserMatchup ? (
            <MatchupSpotlight
              leagueType={detail.league.type}
              matchupId={currentUserMatchup?.id ?? null}
              memberCount={detail.members.length}
              opponentLabel={
                opponentId
                  ? getLeagueMemberPrimaryName(opponentMember, opponentProfile, 'Opponent')
                  : currentUserMatchup
                    ? 'Bye Week'
                    : 'Schedule Pending'
              }
              opponentSecondaryLabel={
                opponentId ? getLeagueMemberSecondaryName(opponentMember, opponentProfile) : null
              }
              viewerLabel={getLeagueMemberPrimaryName(viewerMember, viewerProfile, 'You')}
              viewerSecondaryLabel={getLeagueMemberSecondaryName(viewerMember, viewerProfile)}
              weekNumber={selectedWeekNumber}
              weeklyProfit={viewerStanding?.weekly_profit ?? 0}
            />
          ) : null}

          {awardsQuery.data && selectedWeekAwardsNumber ? (
            <WeeklyAwardsCard awards={awardsQuery.data} weekNumber={selectedWeekNumber} />
          ) : null}

          <StandingsBoard
            cosmeticsByUserId={cosmeticsByUserId}
            detail={selectedDetail}
            hasSeasonStandings={detail.standings.length > 0}
            leagueId={detail.league.id}
            selectedWeekNumber={selectedWeekNumber}
            selectedWeekSettled={selectedWeekSettled}
            standingsWeekNumber={snapshot.weekNumber}
            userId={userId}
          />
        </div>

        <div className="xl:col-span-5">
          {/* The desktop win: chat is always on screen, beside the standings,
              instead of behind a tab. */}
          <LeagueChatPanel
            className="h-[38rem] xl:sticky xl:top-[5.5rem] xl:h-[calc(100vh-8rem)]"
            cosmeticsByUserId={cosmeticsByUserId}
            detail={detail}
            userId={userId}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <MembersPanel cosmeticsByUserId={cosmeticsByUserId} detail={detail} userId={userId} />
        <SchedulePanel detail={detail} userId={userId} />
        <div className="flex flex-col gap-6">
          <InviteShare
            inviteCode={detail.league.invite_code}
            maxMembers={detail.league.max_members}
            memberCount={detail.members.length}
            seasonInProgress={seasonInProgress}
          />
          <LeagueSettingsPanel
            detail={detail}
            onReportLeague={() => setIsReportOpen(true)}
            userId={userId}
          />
        </div>
      </div>

      <Modal
        footer={
          <>
            <Button
              disabled={reportContent.isPending}
              fullWidth={false}
              onClick={() => setIsReportOpen(false)}
              title="Cancel"
              variant="secondary"
            />
            <Button
              fullWidth={false}
              loading={reportContent.isPending}
              onClick={() => void submitLeagueReport()}
              title="Report"
              variant="destructive"
            />
          </>
        }
        onClose={() => setIsReportOpen(false)}
        open={isReportOpen}
        title="Report league name?">
        <p className="text-sm font-semibold text-white/65">
          This flags the public league identity for review.
        </p>
      </Modal>
    </section>
  );
}
