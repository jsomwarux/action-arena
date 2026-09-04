import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ArrowLeft, Trophy } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { WinCelebration } from '@/components/cosmetics';
import {
  BetColumnSection,
  ByeWeekBanner,
  FightCardHeader,
  LockShowdown,
  MatchupUnavailable,
  NoMatchupScheduledCard,
  ProfitTug,
  ReadOnlyPickDetailModal,
  WeekUnavailableCard,
  matchupSideName,
  useMatchupLiveRefresh,
} from '@/components/matchups';
import { LiveRefreshBadge, Skeleton, WeekNavigator } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useEquippedCosmeticsForUsers } from '@/hooks/use-cosmetics';
import { useLiveScores } from '@/hooks/use-live-scores';
import { useLocalFlag } from '@/hooks/use-local-flags';
import {
  type BetWithLegs,
  useMatchupDetail,
  useUserWeekMatchup,
} from '@/hooks/use-matchups';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { triggerAdHook } from '@/lib/ad-hooks';
import { logAnalyticsEvent } from '@/lib/analytics';
import { isLiveScoreActive } from '@/lib/live-pick-status';
import { ROUTES } from '@/lib/routes';

const REGULAR_SEASON_WEEKS = 14;

function LoadingState() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton height={34} width="45%" />
      <Skeleton height={260} radius={20} />
      <Skeleton height={150} radius={20} />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton height={320} radius={20} />
        <Skeleton height={320} radius={20} />
      </div>
    </div>
  );
}

/**
 * Desktop matchup detail.
 *
 * Behaviour follows the mobile screen (app/(app)/(tabs)/matchups/[matchupId].tsx)
 * one-for-one: the same week navigation, the same bye/future-week/no-schedule
 * branches, the same Pick of the Week showdown, and the same win celebration.
 * The layout is the part that changes — desktop puts the two players' full pick
 * cards side by side instead of stacking them.
 *
 * Pick visibility is not decided here. `get_matchup_detail` returns an empty
 * bet list for a side that is still hidden, and this screen renders exactly
 * what the flags on that response say. There is no client-side unlock path.
 */
export function MatchupDetailPage() {
  const { matchupId } = useParams<{ matchupId: string }>();
  const { user } = useAuth();
  const userId = user?.id;

  const initialMatchupQuery = useMatchupDetail(matchupId);
  const initialDetail = initialMatchupQuery.data;

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const selectedWeekNumber = selectedWeek ?? initialDetail?.matchup.week_number ?? 1;
  const isFutureWeek =
    initialDetail !== undefined && selectedWeekNumber > initialDetail.league.current_week;
  const isInitialWeek =
    initialDetail !== undefined && selectedWeekNumber === initialDetail.matchup.week_number;

  const selectedWeekMatchupQuery = useUserWeekMatchup(
    initialDetail?.league.id,
    userId,
    selectedWeekNumber,
  );
  const activeMatchupId = isInitialWeek
    ? matchupId
    : isFutureWeek
      ? undefined
      : selectedWeekMatchupQuery.data?.id;
  const activeMatchupQuery = useMatchupDetail(isInitialWeek ? undefined : activeMatchupId);
  const detail = isInitialWeek ? initialDetail : activeMatchupQuery.data;

  const liveScoreGameIds = useMemo(
    () =>
      [...(detail?.homeBets ?? []), ...(detail?.awayBets ?? [])].flatMap((bet) =>
        bet.bet_legs.map((leg) => leg.game_id),
      ),
    [detail?.awayBets, detail?.homeBets],
  );
  const liveScoresQuery = useLiveScores(liveScoreGameIds);
  const hasLiveGames = useMemo(
    () => Object.values(liveScoresQuery.scoresByGameId).some(isLiveScoreActive),
    [liveScoresQuery.scoresByGameId],
  );

  const cosmeticsQuery = useEquippedCosmeticsForUsers([
    detail?.matchup.home_user_id,
    detail?.matchup.away_user_id,
    userId,
  ]);
  const cosmeticsByUserId = cosmeticsQuery.data ?? {};

  const { lastRefreshedAt, markRefreshed } = useMatchupLiveRefresh({
    hasLiveGames,
    leagueId: detail?.league.id,
    matchupId: detail?.matchup.id,
  });

  const seasonPassQuery = useSeasonPass(userId);
  const adHookTriggered = useRef(false);

  const celebrationFlag = useLocalFlag(
    detail?.matchup.id
      ? `action-arena.win-celebration.${detail.matchup.id}`
      : 'action-arena.win-celebration.pending',
  );
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationReplayKey, setCelebrationReplayKey] = useState(0);
  const [detailBet, setDetailBet] = useState<{ bet: BetWithLegs; ownerLabel: string } | null>(null);

  const userWonMatchup = Boolean(
    userId && detail?.matchup.winner_id && detail.matchup.winner_id === userId,
  );

  const refetchActiveDetail = useCallback(async () => {
    await initialMatchupQuery.refetch();
    await selectedWeekMatchupQuery.refetch();
    if (!isInitialWeek) {
      await activeMatchupQuery.refetch();
    }
    markRefreshed();
  }, [
    activeMatchupQuery,
    initialMatchupQuery,
    isInitialWeek,
    markRefreshed,
    selectedWeekMatchupQuery,
  ]);

  useEffect(() => {
    if (!initialDetail || initialDetail.matchup.id !== matchupId) {
      return;
    }

    setSelectedWeek(initialDetail.matchup.week_number);
  }, [initialDetail, matchupId]);

  useEffect(() => {
    if (!detail) return;
    logAnalyticsEvent('matchup_viewed', {
      league_id: detail.matchup.league_id,
      matchup_id: detail.matchup.id,
      user_id: userId,
      week_number: detail.matchup.week_number,
    });
  }, [detail, userId]);

  // The reveal is a server-side clock. Schedule one refetch for the moment it
  // passes so a card that unlocks mid-session opens without a manual reload.
  useEffect(() => {
    if (!detail?.revealAt) {
      return undefined;
    }

    const delay = new Date(detail.revealAt).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      return undefined;
    }

    const timeout = window.setTimeout(
      () => {
        void refetchActiveDetail();
      },
      Math.min(delay + 1000, 2_147_483_647),
    );

    return () => window.clearTimeout(timeout);
  }, [detail?.revealAt, refetchActiveDetail]);

  // Same placement mobile fires: once, after a settled matchup is on screen.
  useEffect(() => {
    if (!detail || adHookTriggered.current || seasonPassQuery.isLoading) {
      return;
    }

    const isSettled = detail.matchup.home_profit !== null || detail.matchup.away_profit !== null;
    if (!isSettled) {
      return;
    }

    adHookTriggered.current = true;
    triggerAdHook({
      isSeasonPassHolder: Boolean(seasonPassQuery.data),
      placement: 'matchup_result_interstitial',
      userId,
    });
  }, [detail, seasonPassQuery.data, seasonPassQuery.isLoading, userId]);

  useEffect(() => {
    if (!userWonMatchup || celebrationFlag.isLoading || celebrationFlag.value) {
      return;
    }

    setCelebrationVisible(true);
  }, [celebrationFlag.isLoading, celebrationFlag.value, userWonMatchup]);

  const matchupLoading =
    initialMatchupQuery.isLoading ||
    (!isInitialWeek &&
      !isFutureWeek &&
      (selectedWeekMatchupQuery.isLoading || activeMatchupQuery.isLoading));
  const isRefreshing =
    initialMatchupQuery.isRefetching ||
    selectedWeekMatchupQuery.isRefetching ||
    activeMatchupQuery.isRefetching;

  const openPick = (bet: BetWithLegs, ownerLabel: string) => setDetailBet({ bet, ownerLabel });

  const replayWinCelebration = () => {
    if (!userWonMatchup) {
      return;
    }

    setCelebrationVisible(false);
    setCelebrationReplayKey((current) => current + 1);
    void celebrationFlag.reset();
    requestAnimationFrame(() => setCelebrationVisible(true));
  };

  const weekBar = (
    <div className="flex items-center justify-between gap-4">
      <Link
        className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-white/50 transition hover:text-white"
        to={ROUTES.matchups}>
        <ArrowLeft aria-hidden className="h-4 w-4" />
        All matchups
      </Link>
      <div className="flex items-center gap-3">
        <LiveRefreshBadge
          isLive={hasLiveGames}
          isRefreshing={isRefreshing}
          lastRefreshedAt={lastRefreshedAt}
          onRefresh={() => void refetchActiveDetail()}
        />
        {userWonMatchup ? (
          <button
            className="flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/15 px-3 py-2 transition hover:bg-gold/25"
            onClick={replayWinCelebration}
            style={{ boxShadow: `0 0 10px ${THEME_COLORS.gold}80` }}
            title="Replay win celebration"
            type="button">
            <Trophy aria-hidden className="h-3 w-3 text-gold" />
            <span className="text-[10px] font-black uppercase tracking-[1.5px] text-gold">
              You Won
            </span>
          </button>
        ) : null}
        <WeekNavigator
          maxWeek={REGULAR_SEASON_WEEKS}
          onChange={(week) => {
            setSelectedWeek(week);
            setDetailBet(null);
          }}
          week={selectedWeekNumber}
        />
      </div>
    </div>
  );

  if (matchupLoading) {
    return <LoadingState />;
  }

  if (!initialDetail) {
    return <MatchupUnavailable />;
  }

  if (isFutureWeek || !detail) {
    return (
      <div className="flex flex-col gap-6">
        {weekBar}
        {isFutureWeek ? (
          <WeekUnavailableCard weekNumber={selectedWeekNumber} />
        ) : (
          <NoMatchupScheduledCard weekNumber={selectedWeekNumber} />
        )}
      </div>
    );
  }

  const homeProfit = detail.matchup.home_profit ?? detail.homeStanding?.weekly_profit ?? 0;
  const awayProfit = detail.matchup.away_profit ?? detail.awayStanding?.weekly_profit ?? 0;
  const homeName = matchupSideName(detail, 'home');
  const awayName = matchupSideName(detail, 'away');
  const homeIsUser = detail.matchup.home_user_id === userId;
  const awayIsUser = Boolean(detail.matchup.away_user_id) && detail.matchup.away_user_id === userId;
  const isByeWeek = detail.matchup.away_user_id === null;
  const homeLockBet = detail.homeBets.find((bet) => bet.is_lock) ?? null;
  const awayLockBet = detail.awayBets.find((bet) => bet.is_lock) ?? null;
  const homeNonLockBets = detail.homeBets.filter((bet) => !bet.is_lock);
  const awayNonLockBets = detail.awayBets.filter((bet) => !bet.is_lock);
  const homeCosmetics = cosmeticsByUserId[detail.matchup.home_user_id];
  const awayCosmetics = detail.matchup.away_user_id
    ? cosmeticsByUserId[detail.matchup.away_user_id]
    : undefined;
  const homeLabel = homeIsUser ? 'Your Pick' : `${homeName}'s Pick`;
  const awayLabel = awayIsUser ? 'Your Pick' : `${awayName}'s Pick`;

  const undercardSubtitle = (count: number) =>
    `${count === 0 ? 'No' : count} undercard ${count === 1 ? 'pick' : 'picks'} besides the Pick of the Week`;

  return (
    <div className="flex flex-col gap-6">
      <WinCelebration
        cosmetics={userId ? cosmeticsByUserId[userId] : undefined}
        fireKey={`${matchupId}:${celebrationReplayKey}`}
        onComplete={() => {
          setCelebrationVisible(false);
          void celebrationFlag.markComplete();
        }}
        visible={celebrationVisible}
      />

      <ReadOnlyPickDetailModal
        bet={detailBet?.bet ?? null}
        liveScoresByGameId={liveScoresQuery.scoresByGameId}
        onClose={() => setDetailBet(null)}
        ownerLabel={detailBet?.ownerLabel ?? 'Pick'}
      />

      {weekBar}

      {isByeWeek ? (
        <>
          <ByeWeekBanner weekNumber={selectedWeekNumber} />
          <BetColumnSection
            bets={detail.homeBets}
            cosmetics={homeCosmetics}
            emptyVariant="You"
            isUser
            liveScoresByGameId={liveScoresQuery.scoresByGameId}
            onBetPress={(bet) => openPick(bet, 'Your Pick')}
            side="home"
            subtitle="Your picks this week (does not affect H2H record)"
            title={homeName}
            visibility={detail.homePickVisibility}
          />
        </>
      ) : (
        <>
          <FightCardHeader
            cosmeticsByUserId={cosmeticsByUserId}
            detail={detail}
            userId={userId}
          />

          <ProfitTug
            awayName={awayName}
            awayProfit={awayProfit}
            awayUserId={detail.matchup.away_user_id}
            homeName={homeName}
            homeProfit={homeProfit}
            homeUserId={detail.matchup.home_user_id}
            winnerId={detail.matchup.winner_id}
          />

          <LockShowdown
            awayBet={awayLockBet}
            awayCosmetics={awayCosmetics}
            awayIsUser={awayIsUser}
            awayName={awayName}
            awayVisibility={detail.awayPickVisibility}
            homeBet={homeLockBet}
            homeCosmetics={homeCosmetics}
            homeIsUser={homeIsUser}
            homeName={homeName}
            homeVisibility={detail.homePickVisibility}
            liveScoresByGameId={liveScoresQuery.scoresByGameId}
            onAwayBetPress={(bet) => openPick(bet, awayLabel)}
            onHomeBetPress={(bet) => openPick(bet, homeLabel)}
          />

          {/* The desktop payoff: both full cards, side by side, no switching. */}
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <BetColumnSection
              bets={homeNonLockBets}
              cosmetics={homeCosmetics}
              emptyVariant={homeIsUser ? 'You' : 'Opponent'}
              isUser={homeIsUser}
              liveScoresByGameId={liveScoresQuery.scoresByGameId}
              onBetPress={(bet) => openPick(bet, homeLabel)}
              side="home"
              subtitle={undercardSubtitle(homeNonLockBets.length)}
              title={homeName}
              visibility={detail.homePickVisibility}
            />
            <BetColumnSection
              bets={awayNonLockBets}
              cosmetics={awayCosmetics}
              emptyVariant={awayIsUser ? 'You' : 'Opponent'}
              isUser={awayIsUser}
              liveScoresByGameId={liveScoresQuery.scoresByGameId}
              onBetPress={(bet) => openPick(bet, awayLabel)}
              side="away"
              subtitle={undercardSubtitle(awayNonLockBets.length)}
              title={awayName}
              visibility={detail.awayPickVisibility}
            />
          </div>
        </>
      )}
    </div>
  );
}
