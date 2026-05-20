import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { CosmeticAvatar, LockEffect, WinCelebration } from '@/components/cosmetics';
import { LiveBetStatusSummary, LiveLegScoreLine } from '@/components/picks/live-pick-status';
import { PostSubmitEditModal } from '@/components/picks/post-submit-edit-modal';
import {
  AnimatedNumber,
  Badge,
  Card,
  LivePulse,
  ModalShell,
  NflTeamLogo,
  PressableScale,
  ScreenWrapper,
  SkeletonLoader,
  StaggeredItem,
  WeekNavigator,
} from '@/components/ui';
import { LOCK_OF_THE_WEEK_MULTIPLIER } from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useEquippedCosmeticsForUsers } from '@/hooks/use-cosmetics';
import { useLocalFlag } from '@/hooks/use-local-flags';
import { useLiveScores } from '@/hooks/use-live-scores';
import {
  type BetWithLegs,
  type MatchupDetail,
  type MatchupPickVisibility,
  useMatchupDetail,
  useUserWeekMatchup,
} from '@/hooks/use-matchups';
import { useUpcomingNflOdds } from '@/hooks/use-odds';
import { useSeasonPass } from '@/hooks/use-season-pass';
import {
  type BetEditSubmission,
  type PlacedBet,
  usePlacedBets,
  useUpdatePlacedBetMutation,
} from '@/hooks/use-straight-bets';
import { logAnalyticsEvent } from '@/lib/analytics';
import { triggerAdHook } from '@/lib/ad-hooks';
import { getOutcomeRewardTone, getRealizedReward, isSettledResult } from '@/lib/bet-outcome';
import { cn } from '@/lib/cn';
import {
  formatAmericanOdds,
  formatCurrency,
  formatGameTime,
  formatLeagueType,
  formatProfit,
  formatRecord,
  getProfitTone,
} from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { evaluateLiveBetStatus } from '@/lib/live-pick-status';
import { formatBetLegLabel, formatPickTitle, getPickLogoLabel } from '@/lib/pick-labels';
import { isParentPickLocked } from '@/lib/pick-locking';
import { getLeagueMemberPrimaryName } from '@/lib/league-member-display';
import type {
  BetResult,
  BetType,
  EquippedCosmeticsByCategory,
  LiveGameStateRow,
} from '@/types/database';

type Side = 'home' | 'away';

const REGULAR_SEASON_WEEKS = 14;

const resultLabel: Record<BetResult, string> = {
  loss: 'Loss',
  pending: 'Pending',
  push: 'Push',
  win: 'Win',
};

function getParamValue(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function resultTone(result: BetResult, inProgress = false) {
  if (inProgress) {
    return {
      bg: 'bg-gold/15',
      border: 'border-gold/40',
      text: 'text-gold',
    };
  }
  if (result === 'win') {
    return {
      bg: 'bg-electric-green/15',
      border: 'border-electric-green/40',
      text: 'text-electric-green',
    };
  }
  if (result === 'loss') {
    return {
      bg: 'bg-coral-red/15',
      border: 'border-coral-red/40',
      text: 'text-coral-red',
    };
  }
  return {
    bg: 'bg-white/[0.05]',
    border: 'border-white/15',
    text: 'text-white/60',
  };
}

function betTypeAccent(betType: BetType) {
  if (betType === 'parlay') {
    return {
      border: 'border-amber-accent/35',
      bg: 'bg-amber-accent/[0.05]',
      hex: THEME_COLORS.amberAccent,
    };
  }
  if (betType === 'teaser') {
    return {
      border: 'border-cyan-accent/35',
      bg: 'bg-cyan-accent/[0.05]',
      hex: THEME_COLORS.cyanAccent,
    };
  }
  return {
    border: 'border-white/[0.08]',
    bg: 'bg-white/[0.03]',
    hex: THEME_COLORS.electricGreen,
  };
}

function isInProgress(bet: BetWithLegs) {
  if (bet.result !== 'pending') {
    return false;
  }
  return isParentPickLocked(bet);
}

function marketCopy(market: string) {
  if (market === 'moneyline') return 'Winner';
  if (market === 'spread') return 'Spread';
  return 'Over/Under';
}

function formatRevealTime(revealAt: string | null) {
  if (!revealAt) {
    return 'Reveals at first game kickoff';
  }

  const revealDate = new Date(revealAt);
  if (Number.isNaN(revealDate.getTime())) {
    return 'Reveals at first game kickoff';
  }

  const day = revealDate.toLocaleDateString(undefined, { weekday: 'long' });
  const time = revealDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Reveals ${day} at ${time}`;
}

function revealMessage(revealAt: string | null) {
  return {
    body: 'Cards reveal at first game kickoff',
    time: formatRevealTime(revealAt),
  };
}

function ResultPill({ bet }: { bet: BetWithLegs }) {
  const inProgress = isInProgress(bet);
  const tone = resultTone(bet.result, inProgress);
  const label = inProgress ? 'Live' : resultLabel[bet.result];

  return (
    <View className={cn('flex-row items-center gap-1 rounded-full border px-2.5 py-1', tone.bg, tone.border)}>
      {inProgress ? (
        <View className="h-1.5 w-1.5 rounded-full bg-gold" />
      ) : bet.result === 'win' ? (
        <Ionicons color={THEME_COLORS.electricGreen} name="checkmark" size={11} />
      ) : bet.result === 'loss' ? (
        <Ionicons color={THEME_COLORS.coralRed} name="close" size={11} />
      ) : null}
      <Text className={cn('text-[10px] font-black uppercase', tone.text)} style={{ letterSpacing: 1.4 }}>
        {label}
      </Text>
    </View>
  );
}

function LockPill() {
  return (
    <View
      className="flex-row items-center gap-1 rounded-full border border-gold/55 bg-gold/15 px-2.5 py-1"
      style={{
        shadowColor: THEME_COLORS.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      }}>
      <Ionicons color={THEME_COLORS.gold} name="star" size={11} />
      <Text className="text-[10px] font-black uppercase text-gold" style={{ letterSpacing: 1.2 }}>
        Pick of the Week 1.5x
      </Text>
    </View>
  );
}

function LegResultPill({ result }: { result: BetResult }) {
  const tone = resultTone(result);
  return (
    <View className={cn('rounded-full border px-2 py-[2px]', tone.bg, tone.border)}>
      <Text className={cn('text-[9px] font-black uppercase', tone.text)} style={{ letterSpacing: 1 }}>
        {resultLabel[result]}
      </Text>
    </View>
  );
}

function EmptyBets({ side }: { side: 'You' | 'Opponent' | 'Player' }) {
  return (
    <View className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6">
      <View className="items-center gap-2">
        <Ionicons color="rgba(255,255,255,0.35)" name="receipt-outline" size={22} />
        <Text className="text-center text-sm font-semibold text-white/45">
          {side === 'You' ? 'You haven’t submitted any picks yet.' : 'No picks placed for this matchup.'}
        </Text>
      </View>
    </View>
  );
}

function HiddenPicksPlaceholder({
  revealAt,
  submitted,
}: {
  revealAt: string | null;
  submitted: boolean;
}) {
  const message = revealMessage(revealAt);

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06]">
        <Ionicons
          color="rgba(255,255,255,0.62)"
          name={submitted ? 'lock-closed' : 'hourglass'}
          size={16}
        />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-semibold text-white/55">{message.body}</Text>
        <Text
          className="mt-0.5 text-[10px] font-black uppercase text-electric-green"
          style={{ letterSpacing: 1.2 }}>
          {message.time}
        </Text>
      </View>
    </View>
  );
}

function BetCard({
  bet,
  cosmetics,
  isUser,
  liveScoresByGameId = {},
  onPress,
}: {
  bet: BetWithLegs;
  cosmetics?: EquippedCosmeticsByCategory;
  isUser: boolean;
  liveScoresByGameId?: Record<string, LiveGameStateRow | undefined>;
  onPress?: () => void;
}) {
  const accent = betTypeAccent(bet.bet_type);
  const inProgress = isInProgress(bet);
  const isMultiLeg = bet.bet_type !== 'straight';
  const firstLeg = bet.bet_legs[0];
  const isLock = bet.is_lock;
  const isTappable = Boolean(onPress);
  const liveStatus = evaluateLiveBetStatus(bet, liveScoresByGameId);
  const isSettled = isSettledResult(bet.result);
  const displayedReward = isSettled ? getRealizedReward(bet) : bet.potential_payout;
  const rewardLabel = isSettled ? 'Outcome' : 'Reward';
  const rewardTone = isSettled ? getOutcomeRewardTone(bet.result) : '';

  const inner = (
    <View
      className={cn(
        'rounded-2xl border p-4',
        isLock ? 'border-gold/70 bg-gold/[0.07]' : cn(accent.border, accent.bg),
      )}
      style={
        isLock
          ? {
              shadowColor: THEME_COLORS.gold,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.42,
              shadowRadius: 14,
            }
          : isUser
          ? {
              shadowColor: accent.hex,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.18,
              shadowRadius: 10,
            }
          : undefined
      }>
      <View className="gap-3">
        {isLock ? (
          <View className="self-start">
            <LockPill />
          </View>
        ) : null}
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-2">
            <View className="flex-row items-center gap-2">
              <Badge betType={bet.bet_type} />
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.4 }}>
                {formatAmericanOdds(bet.odds)}
              </Text>
            </View>
            <Text
              className="text-base font-black text-white"
              style={{ letterSpacing: -0.3 }}
              numberOfLines={2}>
              {isMultiLeg ? `${bet.bet_legs.length}-leg ${bet.bet_type}` : null}
            </Text>
            {!isMultiLeg && firstLeg ? (
              <View className="flex-row items-center gap-2">
                {firstLeg.market !== 'over_under' ? (
                  <NflTeamLogo size={28} teamName={getPickLogoLabel(firstLeg)} />
                ) : null}
                <Text
                  className="flex-1 text-base font-black text-white"
                  numberOfLines={2}
                  style={{ letterSpacing: -0.3 }}>
                  {formatBetLegLabel(firstLeg, { betType: bet.bet_type })}
                </Text>
              </View>
            ) : !isMultiLeg ? (
              <Text
                className="text-base font-black text-white"
                style={{ letterSpacing: -0.3 }}>
                Selection unavailable
              </Text>
            ) : null}
            <LiveBetStatusSummary status={liveStatus} />
            {!isMultiLeg && firstLeg ? (
              <LiveLegScoreLine leg={firstLeg} score={liveScoresByGameId[firstLeg.game_id]} />
            ) : null}
          </View>
          <View className="flex-row items-center gap-1.5">
            <ResultPill bet={bet} />
            {isTappable ? (
              <Ionicons color="rgba(255,255,255,0.34)" name="chevron-forward" size={17} />
            ) : null}
          </View>
        </View>

        <View className="flex-row justify-between rounded-xl bg-white/[0.04] px-3 py-3">
          <View>
            <Text
              className="text-[10px] font-black uppercase text-white/40"
              style={{ letterSpacing: 1.4 }}>
              Played
            </Text>
            <Text className="mt-1 text-sm font-black text-white">
              {formatCurrency(bet.amount)}
            </Text>
          </View>
          <View className="items-center">
            <Text
              className="text-[10px] font-black uppercase text-white/40"
              style={{ letterSpacing: 1.4 }}>
              {rewardLabel}
            </Text>
            <Text
              className={cn('mt-1 text-sm font-black text-white', rewardTone)}
              style={isSettled ? undefined : { color: accent.hex }}>
              {formatCurrency(displayedReward)}
            </Text>
          </View>
          <View className="items-end">
            <Text
              className="text-[10px] font-black uppercase text-white/40"
              style={{ letterSpacing: 1.4 }}>
              Profit
            </Text>
            <Text className={cn('mt-1 text-sm font-black', getProfitTone(bet.profit ?? 0))}>
              {bet.profit === null ? '–' : formatProfit(bet.profit)}
            </Text>
          </View>
        </View>

        {isMultiLeg ? (
          <View className="ml-1 mt-1 flex-row gap-3">
            <View className="items-center pt-2">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: `${accent.hex}cc` }}
              />
              <View
                className="mt-0.5 w-[2px] flex-1 rounded-full"
                style={{ backgroundColor: `${accent.hex}55` }}
              />
            </View>
            <View className="flex-1 gap-2">
              {bet.bet_legs.map((leg, index) => (
                <View
                  key={leg.id}
                  className="flex-row items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-3">
                  <View className="flex-1 flex-row items-center gap-3">
                    {leg.market !== 'over_under' ? (
                      <NflTeamLogo size={24} teamName={getPickLogoLabel(leg)} />
                    ) : (
                      <View
                        className="h-6 w-6 items-center justify-center rounded-full border"
                        style={{
                          backgroundColor: `${accent.hex}1a`,
                          borderColor: `${accent.hex}66`,
                        }}>
                        <Text
                          className="text-[10px] font-black"
                          style={{ color: accent.hex, letterSpacing: -0.2 }}>
                          {index + 1}
                        </Text>
                      </View>
                    )}
                <View className="flex-1">
                  <Text
                    className="text-sm font-black text-white"
                        numberOfLines={2}
                        style={{ letterSpacing: -0.2 }}>
                        {formatBetLegLabel(leg, { betType: bet.bet_type })}
                      </Text>
                  <Text className="mt-1 text-[11px] font-semibold uppercase text-white/40">
                    {marketCopy(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
                  </Text>
                  <LiveLegScoreLine leg={leg} score={liveScoresByGameId[leg.game_id]} />
                </View>
              </View>
                  <LegResultPill result={leg.result} />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );

  const decorated = isLock ? <LockEffect cosmetics={cosmetics}>{inner}</LockEffect> : inner;
  const tappable = onPress ? (
    <PressableScale
      accessibilityLabel="Open pick"
      accessibilityRole="button"
      onPress={onPress}
      pressedScale={0.985}>
      {decorated}
    </PressableScale>
  ) : (
    decorated
  );

  if (inProgress) {
    return (
      <LivePulse color={THEME_COLORS.gold} intensity={0.55}>
        {tappable}
      </LivePulse>
    );
  }

  return tappable;
}

function PlayerSide({
  cosmetics,
  isLeading,
  isUser,
  name,
  profit,
  record,
  side,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  isLeading: boolean;
  isUser: boolean;
  name: string;
  profit: number;
  record: string;
  side: Side;
}) {
  const accentBorder = isUser
    ? 'border-electric-green/60 bg-electric-green/15'
    : isLeading
      ? 'border-gold/55 bg-gold/15'
      : 'border-white/15 bg-white/[0.05]';

  return (
    <View
      className="flex-1 items-center gap-3"
      style={{ transform: [{ scale: isLeading ? 1.06 : 1 }] }}>
      <View
        className={cn('h-20 w-20 items-center justify-center rounded-2xl border', accentBorder)}
        style={
          isLeading || isUser
            ? {
                shadowColor: isUser ? THEME_COLORS.electricGreen : THEME_COLORS.gold,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 14,
              }
            : undefined
        }>
        <CosmeticAvatar cosmetics={cosmetics} name={name} size="lg" />
      </View>

      <View className="items-center gap-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="text-[10px] font-black uppercase text-white/45"
            style={{ letterSpacing: 1.5 }}>
            {isUser ? 'You' : side === 'home' ? 'Home' : 'Opponent'}
          </Text>
          {isLeading ? (
            <View className="rounded-full border border-gold/50 bg-gold/15 px-2 py-[1px]">
              <Text
                className="text-[9px] font-black uppercase text-gold"
                style={{ letterSpacing: 1.2 }}>
                Leading
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          className="text-center text-base font-black text-white"
          numberOfLines={1}
          style={{ letterSpacing: -0.3 }}>
          {name}
        </Text>
        <Text className="text-[11px] font-semibold text-white/45">{record}</Text>
        <AnimatedNumber
          className={cn('text-3xl font-black', getProfitTone(profit))}
          decimals={0}
          prefix={profit < 0 ? '-' : '+'}
          suffix=" coins"
          style={{ letterSpacing: -0.6 }}
          value={Math.abs(profit)}
        />
      </View>
    </View>
  );
}

function ProfitTug({
  awayName,
  awayProfit,
  homeName,
  homeProfit,
}: {
  awayName: string;
  awayProfit: number;
  homeName: string;
  homeProfit: number;
}) {
  const range = Math.max(Math.abs(homeProfit) + Math.abs(awayProfit), 1);
  const homeWidth = Math.max(8, Math.min(92, ((homeProfit + range) / (range * 2)) * 100));

  const diff = homeProfit - awayProfit;
  const leader = diff > 0 ? homeName : diff < 0 ? awayName : null;

  return (
    <Card>
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text
              className="text-[10px] font-black uppercase text-white/45"
              style={{ letterSpacing: 1.8 }}>
              Profit Swing
            </Text>
            <Text
              className="mt-1 text-base font-black text-white"
              style={{ letterSpacing: -0.3 }}
              numberOfLines={1}>
              {leader ? `${leader} leads by ${formatCurrency(Math.abs(diff))}` : 'Dead even'}
            </Text>
          </View>
          <View
            className={cn(
              'rounded-full border px-3 py-1',
              diff > 0
                ? 'border-electric-green/40 bg-electric-green/15'
                : diff < 0
                  ? 'border-coral-red/40 bg-coral-red/15'
                  : 'border-white/15 bg-white/[0.04]',
            )}>
            <Text
              className={cn(
                'text-[10px] font-black uppercase',
                diff > 0 ? 'text-electric-green' : diff < 0 ? 'text-coral-red' : 'text-white/55',
              )}
              style={{ letterSpacing: 1.5 }}>
              {formatProfit(diff)}
            </Text>
          </View>
        </View>

        <View className="h-3 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
          <View className="h-full flex-row">
            <View className="h-full bg-electric-green" style={{ width: `${homeWidth}%` }} />
            <View className="h-full flex-1 bg-coral-red" />
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-electric-green" />
            <Text className="text-[11px] font-black uppercase text-white/55" style={{ letterSpacing: 1.2 }}>
              {homeName} {formatProfit(homeProfit)}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-[11px] font-black uppercase text-white/55" style={{ letterSpacing: 1.2 }}>
              {awayName} {formatProfit(awayProfit)}
            </Text>
            <View className="h-2 w-2 rounded-full bg-coral-red" />
          </View>
        </View>
      </View>
    </Card>
  );
}

function FightCardHeader({
  cosmeticsByUserId,
  detail,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory | undefined>;
  detail: MatchupDetail;
  userId: string | undefined;
}) {
  const homeProfit = detail.matchup.home_profit ?? detail.homeStanding?.weekly_profit ?? 0;
  const awayProfit = detail.matchup.away_profit ?? detail.awayStanding?.weekly_profit ?? 0;
  const homeLeading = homeProfit > awayProfit;
  const awayLeading = awayProfit > homeProfit;
  const homeName = getLeagueMemberPrimaryName(detail.homeMember, detail.homeUser, 'Home');
  const awayName = detail.matchup.away_user_id
    ? getLeagueMemberPrimaryName(detail.awayMember, detail.awayUser, 'Opponent')
    : 'Bye Week';

  return (
    <Card tone="highlight">
      <View className="gap-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-electric-green" />
              <Text
                className="text-[10px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 2.5 }}>
                Week {detail.matchup.week_number} · Matchup
              </Text>
            </View>
            <Text
              className="mt-2 text-3xl font-black uppercase text-white"
              style={{ letterSpacing: -0.6 }}>
              Head to Head
            </Text>
            <Text className="mt-1 text-sm font-semibold text-white/55" numberOfLines={1}>
              {detail.league.name} · {formatLeagueType(detail.league.type)}
            </Text>
          </View>
          {detail.matchup.is_championship ? (
            <Badge label="Championship" tone="gold" />
          ) : detail.matchup.is_playoff ? (
            <Badge label="Playoff" tone="cyan" />
          ) : null}
        </View>

        <View className="flex-row items-center">
          <PlayerSide
            cosmetics={cosmeticsByUserId[detail.matchup.home_user_id]}
            isLeading={homeLeading}
            isUser={detail.matchup.home_user_id === userId}
            name={homeName}
            profit={homeProfit}
            record={
              detail.homeStanding
                ? formatRecord(
                    detail.homeStanding.wins,
                    detail.homeStanding.losses,
                    detail.homeStanding.ties,
                  )
                : '0-0'
            }
            side="home"
          />
          <View className="px-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-full border border-gold/50 bg-gold/15"
              style={{
                shadowColor: THEME_COLORS.gold,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 12,
              }}>
              <Text className="text-base font-black text-gold" style={{ letterSpacing: 0.5 }}>
                VS
              </Text>
            </View>
          </View>
          <PlayerSide
            cosmetics={
              detail.matchup.away_user_id
                ? cosmeticsByUserId[detail.matchup.away_user_id]
                : undefined
            }
            isLeading={awayLeading}
            isUser={detail.matchup.away_user_id === userId}
            name={awayName}
            profit={awayProfit}
            record={
              detail.awayStanding
                ? formatRecord(
                    detail.awayStanding.wins,
                    detail.awayStanding.losses,
                    detail.awayStanding.ties,
                  )
                : detail.matchup.away_user_id
                  ? '0-0'
                  : 'Bye'
            }
            side="away"
          />
        </View>
      </View>
    </Card>
  );
}

function LockShowdownSide({
  bet,
  cosmetics,
  isUser,
  liveScoresByGameId,
  name,
  onBetPress,
  sideLabel,
  visibility,
}: {
  bet: BetWithLegs | null;
  cosmetics?: EquippedCosmeticsByCategory;
  isUser: boolean;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  name: string;
  onBetPress?: (bet: BetWithLegs) => void;
  sideLabel: string;
  visibility: MatchupPickVisibility;
}) {
  const hidden = !isUser && !visibility.isVisible;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-3">
        <Text
          className="text-[10px] font-black uppercase text-gold/85"
          style={{ letterSpacing: 1.5 }}>
          {sideLabel}
        </Text>
        <Text
          className="flex-1 text-right text-base font-black text-white"
          numberOfLines={1}
          style={{ letterSpacing: -0.2 }}>
          {name}
        </Text>
      </View>
      {hidden ? (
        <HiddenPicksPlaceholder revealAt={visibility.revealAt} submitted={visibility.isSubmitted} />
      ) : bet ? (
        <BetCard
          bet={bet}
          cosmetics={cosmetics}
          isUser={isUser}
          liveScoresByGameId={liveScoresByGameId}
          onPress={onBetPress ? () => onBetPress(bet) : undefined}
        />
      ) : !visibility.isSubmitted && visibility.isVisible ? (
        <View className="items-center justify-center rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-3 py-8">
          <Ionicons color="rgba(255,215,0,0.55)" name="remove-circle-outline" size={26} />
          <Text className="mt-2 text-center text-xs font-semibold text-white/45">
            Did not submit
          </Text>
        </View>
      ) : (
        <View className="items-center justify-center rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-3 py-8">
          <Ionicons color="rgba(255,215,0,0.55)" name="star-outline" size={26} />
          <Text className="mt-2 text-center text-xs font-semibold text-white/45">
            No Pick of the Week filed
          </Text>
        </View>
      )}
    </View>
  );
}

function LockShowdown({
  awayBet,
  awayCosmetics,
  awayVisibility,
  awayName,
  liveScoresByGameId,
  onAwayBetPress,
  onHomeBetPress,
  homeBet,
  homeCosmetics,
  homeIsUser,
  homeName,
  awayIsUser,
  homeVisibility,
}: {
  awayBet: BetWithLegs | null;
  awayCosmetics?: EquippedCosmeticsByCategory;
  awayVisibility: MatchupPickVisibility;
  awayName: string;
  awayIsUser: boolean;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  onAwayBetPress?: (bet: BetWithLegs) => void;
  onHomeBetPress?: (bet: BetWithLegs) => void;
  homeBet: BetWithLegs | null;
  homeCosmetics?: EquippedCosmeticsByCategory;
  homeIsUser: boolean;
  homeName: string;
  homeVisibility: MatchupPickVisibility;
}) {
  const showHomeHidden = !homeIsUser && !homeVisibility.isVisible && homeVisibility.isSubmitted;
  const showAwayHidden = !awayIsUser && !awayVisibility.isVisible && awayVisibility.isSubmitted;
  const showHomeDidNotSubmit = homeVisibility.isVisible && !homeVisibility.isSubmitted;
  const showAwayDidNotSubmit = awayVisibility.isVisible && !awayVisibility.isSubmitted;

  if (!homeBet && !awayBet && !showHomeHidden && !showAwayHidden && !showHomeDidNotSubmit && !showAwayDidNotSubmit) {
    return null;
  }

  return (
    <Card>
      <View className="gap-5">
        <View className="items-center gap-2">
          <View className="flex-row items-center gap-2">
            <Ionicons color={THEME_COLORS.gold} name="star" size={12} />
            <Text
              className="text-[10px] font-black uppercase text-gold"
              style={{ letterSpacing: 2 }}>
              Headline Fight
            </Text>
            <Ionicons color={THEME_COLORS.gold} name="star" size={12} />
          </View>
          <Text
            className="text-center text-lg font-black text-white"
            style={{ letterSpacing: -0.3 }}>
            Pick of the Week Showdown
          </Text>
          <Text className="text-center text-[11px] font-medium text-white/55">
            Each Pick of the Week rewards or costs {LOCK_OF_THE_WEEK_MULTIPLIER}x. The biggest swing of the week.
          </Text>
        </View>

        <View className="gap-4">
          <LockShowdownSide
            bet={homeBet}
            cosmetics={homeCosmetics}
            isUser={homeIsUser}
            liveScoresByGameId={liveScoresByGameId}
            name={homeName}
            onBetPress={onHomeBetPress}
            sideLabel="Home"
            visibility={homeVisibility}
          />
          <View className="flex-row items-center gap-3">
            <View className="h-[1px] flex-1 bg-gold/30" />
            <View
              className="h-9 w-9 items-center justify-center rounded-full border border-gold/55 bg-gold/15"
              style={{
                shadowColor: THEME_COLORS.gold,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 10,
              }}>
              <Text
                className="text-xs font-black text-gold"
                style={{ letterSpacing: 0.5 }}>
                VS
              </Text>
            </View>
            <View className="h-[1px] flex-1 bg-gold/30" />
          </View>
          <LockShowdownSide
            bet={awayBet}
            cosmetics={awayCosmetics}
            isUser={awayIsUser}
            liveScoresByGameId={liveScoresByGameId}
            name={awayName}
            onBetPress={onAwayBetPress}
            sideLabel="Away"
            visibility={awayVisibility}
          />
        </View>
      </View>
    </Card>
  );
}

function BetColumnSection({
  bets,
  cosmetics,
  emptyVariant,
  isUser,
  liveScoresByGameId,
  onBetPress,
  side,
  subtitle,
  title,
  visibility,
}: {
  bets: BetWithLegs[];
  cosmetics?: EquippedCosmeticsByCategory;
  emptyVariant: 'You' | 'Opponent' | 'Player';
  isUser: boolean;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  onBetPress?: (bet: BetWithLegs) => void;
  side: Side;
  subtitle?: string;
  title: string;
  visibility: MatchupPickVisibility;
}) {
  const accentColor = isUser
    ? THEME_COLORS.electricGreen
    : side === 'home'
      ? THEME_COLORS.cyanAccent
      : THEME_COLORS.coralRed;
  const hidden = !isUser && !visibility.isVisible;
  const notSubmittedRevealed = !isUser && visibility.isVisible && !visibility.isSubmitted;
  const statusLabel = hidden
    ? visibility.isSubmitted
      ? 'Submitted'
      : 'Not submitted'
    : notSubmittedRevealed
      ? 'Not submitted'
      : `${bets.length} ${bets.length === 1 ? 'pick' : 'picks'}`;
  const hiddenMessage = hidden ? revealMessage(visibility.revealAt) : null;
  const resolvedSubtitle = hidden || notSubmittedRevealed ? null : subtitle;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className="h-7 w-7 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `${accentColor}1a`,
              borderColor: `${accentColor}55`,
            }}>
            <Ionicons
              color={accentColor}
              name={isUser ? 'person' : 'person-outline'}
              size={14}
            />
          </View>
          <View>
            <Text
              className="text-[10px] font-black uppercase"
              style={{ color: accentColor, letterSpacing: 2 }}>
              {isUser ? 'Your Card' : 'Opponent Card'}
            </Text>
            <Text
              className="text-base font-black text-white"
              style={{ letterSpacing: -0.3 }}
              numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">
            <Text
              className="text-[10px] font-black uppercase text-white/65"
              style={{ letterSpacing: 1.2 }}>
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>

      {resolvedSubtitle ? (
        <Text className="text-xs font-semibold text-white/45">{resolvedSubtitle}</Text>
      ) : null}

      {hiddenMessage ? (
        <View className="gap-0.5">
          <Text className="text-xs font-semibold text-white/55">{hiddenMessage.body}</Text>
          <Text
            className="text-[10px] font-black uppercase text-electric-green"
            style={{ letterSpacing: 1.2 }}>
            {hiddenMessage.time}
          </Text>
        </View>
      ) : null}

      {hidden ? null : !visibility.isSubmitted && visibility.isVisible && !isUser ? (
        <View className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6">
          <View className="items-center gap-2">
            <Ionicons color="rgba(255,255,255,0.35)" name="remove-circle-outline" size={22} />
            <Text className="text-center text-sm font-semibold text-white/45">
              Did not submit
            </Text>
          </View>
        </View>
      ) : bets.length === 0 ? (
        <EmptyBets side={emptyVariant} />
      ) : (
        <View className="gap-3">
          {bets.map((bet, index) => (
            <StaggeredItem index={index} key={bet.id} perItemDelay={60}>
              <BetCard
                bet={bet}
                cosmetics={cosmetics}
                isUser={isUser}
                liveScoresByGameId={liveScoresByGameId}
                onPress={onBetPress ? () => onBetPress(bet) : undefined}
              />
            </StaggeredItem>
          ))}
        </View>
      )}
    </View>
  );
}

function ReadOnlyPickDetailModal({
  bet,
  liveScoresByGameId,
  onClose,
  ownerLabel,
}: {
  bet: BetWithLegs | null;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  onClose: () => void;
  ownerLabel: string;
}) {
  if (!bet) {
    return null;
  }

  const accent = betTypeAccent(bet.bet_type);
  const isMultiLeg = bet.bet_type !== 'straight';
  const inProgress = isInProgress(bet);
  const outcomeLabel = inProgress ? 'Live' : resultLabel[bet.result];
  const liveStatus = evaluateLiveBetStatus(bet, liveScoresByGameId);
  const isSettled = isSettledResult(bet.result);
  const displayedReward = isSettled ? getRealizedReward(bet) : bet.potential_payout;
  const rewardLabel = isSettled ? 'Outcome' : 'Reward';
  const rewardTone = isSettled ? getOutcomeRewardTone(bet.result) : '';

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={Boolean(bet)}>
      <ModalShell>
        <ScrollView
          contentContainerStyle={{
            gap: 16,
            paddingBottom: 28,
            paddingHorizontal: 20,
            paddingTop: 12,
          }}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text
                className="text-[10px] font-black uppercase"
                style={{ color: accent.hex, letterSpacing: 2.5 }}>
                Pick Details
              </Text>
              <Text className="mt-2 text-2xl font-black uppercase text-white">
                {ownerLabel}
              </Text>
              <Text className="mt-1 text-sm font-semibold text-white/50">
                Read-only view
              </Text>
            </View>
            <Pressable accessibilityLabel="Close pick details" accessibilityRole="button" hitSlop={8} onPress={onClose}>
              <View className="h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                <Ionicons color="rgba(255,255,255,0.72)" name="close" size={18} />
              </View>
            </Pressable>
          </View>

          <Card>
            <View className="gap-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-2">
                  <View className="flex-row items-center gap-2">
                    <Badge betType={bet.bet_type} />
                    {bet.is_lock ? <LockPill /> : null}
                  </View>
                  <Text className="text-xl font-black text-white">
                    {formatPickTitle(bet)}
                  </Text>
                  <LiveBetStatusSummary status={liveStatus} />
                </View>
                <ResultPill bet={bet} />
              </View>

              <View className="flex-row justify-between rounded-xl bg-white/[0.04] px-3 py-3">
                <View>
                  <Text className="text-[10px] font-black uppercase text-white/40" style={{ letterSpacing: 1.4 }}>
                    Played
                  </Text>
                  <Text className="mt-1 text-sm font-black text-white">{formatCurrency(bet.amount)}</Text>
                </View>
                <View className="items-center">
                  <Text className="text-[10px] font-black uppercase text-white/40" style={{ letterSpacing: 1.4 }}>
                    {rewardLabel}
                  </Text>
                  <Text
                    className={cn('mt-1 text-sm font-black', rewardTone)}
                    style={isSettled ? undefined : { color: accent.hex }}>
                    {formatCurrency(displayedReward)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] font-black uppercase text-white/40" style={{ letterSpacing: 1.4 }}>
                    Profit
                  </Text>
                  <Text className={cn('mt-1 text-sm font-black', getProfitTone(bet.profit ?? 0))}>
                    {bet.profit === null ? outcomeLabel : formatProfit(bet.profit)}
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          <View className="gap-2">
            <Text className="text-[10px] font-black uppercase text-white/50" style={{ letterSpacing: 2 }}>
              {isMultiLeg ? 'Legs' : 'Selection'}
            </Text>
            {bet.bet_legs.map((leg, index) => {
              const legLocked = leg.locked || new Date(leg.game_start_time).getTime() <= Date.now();
              return (
                <View
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"
                  key={leg.id}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 flex-row items-center gap-3">
                      {leg.market !== 'over_under' ? (
                        <NflTeamLogo size={28} teamName={getPickLogoLabel(leg)} />
                      ) : (
                        <View
                          className="h-7 w-7 items-center justify-center rounded-full border"
                          style={{
                            backgroundColor: `${accent.hex}1a`,
                            borderColor: `${accent.hex}66`,
                          }}>
                          <Text className="text-[10px] font-black" style={{ color: accent.hex }}>
                            {index + 1}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-base font-black text-white" numberOfLines={2}>
                          {formatBetLegLabel(leg, { betType: bet.bet_type })}
                        </Text>
                        <Text className="mt-1 text-[11px] font-semibold uppercase text-white/42">
                          {marketCopy(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
                        </Text>
                        <Text className="mt-1 text-[11px] font-semibold text-white/42">
                          {formatGameTime(leg.game_start_time)}
                        </Text>
                        <LiveLegScoreLine leg={leg} score={liveScoresByGameId[leg.game_id]} />
                      </View>
                    </View>
                    <View className="items-end gap-2">
                      <LegResultPill result={leg.result} />
                      {legLocked ? (
                        <View className="flex-row items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2 py-[2px]">
                          <Ionicons color="rgba(255,255,255,0.55)" name="lock-closed" size={9} />
                          <Text className="text-[9px] font-black uppercase text-white/55" style={{ letterSpacing: 1 }}>
                            Locked
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ModalShell>
    </Modal>
  );
}

function LoadingState() {
  return (
    <ScreenWrapper className="gap-5 py-6">
      <SkeletonLoader height={34} width="65%" />
      <SkeletonLoader height={210} radius={20} />
      <SkeletonLoader height={120} radius={20} />
      <SkeletonLoader height={160} radius={20} />
    </ScreenWrapper>
  );
}

function WeekUnavailableCard({ weekNumber }: { weekNumber: number }) {
  return (
    <Card>
      <View className="items-center gap-3 py-5">
        <View className="h-14 w-14 items-center justify-center rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10">
          <Ionicons color={THEME_COLORS.cyanAccent} name="calendar-outline" size={24} />
        </View>
        <Text
          className="text-center text-xl font-black uppercase text-white"
          style={{ letterSpacing: -0.3 }}>
          Odds Release Monday
        </Text>
        <Text className="text-center text-sm font-semibold leading-5 text-white/55">
          Week {weekNumber} will unlock when the slate is posted. No matchup details
          or picks are interactive yet.
        </Text>
      </View>
    </Card>
  );
}

function NoMatchupScheduledCard({ weekNumber }: { weekNumber: number }) {
  return (
    <Card>
      <View className="items-center gap-3 py-5">
        <Ionicons color="rgba(255,255,255,0.5)" name="calendar-clear-outline" size={26} />
        <Text className="text-center text-lg font-black text-white">
          No matchup scheduled for Week {weekNumber}
        </Text>
        <Text className="text-center text-sm font-semibold text-white/50">
          This week is not available in the league schedule yet.
        </Text>
      </View>
    </Card>
  );
}

function ByeWeekBanner({ weekNumber }: { weekNumber: number }) {
  return (
    <View className="rounded-2xl border border-cyan-accent/20 bg-cyan-accent/[0.07] p-5">
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl border border-cyan-accent/25 bg-white/[0.04]">
          <Ionicons color={THEME_COLORS.cyanAccent} name="pause-circle-outline" size={22} />
        </View>
        <View className="flex-1">
          <Text
            className="text-[10px] font-black uppercase text-cyan-accent"
            style={{ letterSpacing: 2 }}>
            Week {weekNumber} · Bye
          </Text>
          <Text
            className="mt-2 text-2xl font-black uppercase text-white"
            style={{ letterSpacing: -0.4 }}>
            You're on bye this week.
          </Text>
          <Text className="mt-2 text-sm font-semibold leading-5 text-white/58">
            No matchup, no record impact.
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function MatchupDetailScreen() {
  const { matchupId } = useLocalSearchParams();
  const resolvedMatchupId = getParamValue(matchupId);
  const { user } = useAuth();
  const initialMatchupQuery = useMatchupDetail(resolvedMatchupId);
  const initialDetail = initialMatchupQuery.data;
  const userId = user?.id;
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
    ? resolvedMatchupId
    : isFutureWeek
      ? undefined
      : selectedWeekMatchupQuery.data?.id;
  const activeMatchupQuery = useMatchupDetail(isInitialWeek ? undefined : activeMatchupId);
  const detail = isInitialWeek ? initialDetail : activeMatchupQuery.data;
  const leagueId = initialDetail?.league.id ?? detail?.matchup.league_id;
  const weekNumber = selectedWeekNumber;
  const isCurrentWeek =
    initialDetail !== undefined && selectedWeekNumber === initialDetail.league.current_week;
  const seasonPassQuery = useSeasonPass(userId);
  const placedBetsQuery = usePlacedBets(leagueId, userId, weekNumber);
  const oddsQuery = useUpcomingNflOdds();
  const updatePlacedBet = useUpdatePlacedBetMutation(leagueId, userId, weekNumber);
  const liveScoreGameIds = useMemo(
    () =>
      [...(detail?.homeBets ?? []), ...(detail?.awayBets ?? [])].flatMap((bet) =>
        bet.bet_legs.map((leg) => leg.game_id),
      ),
    [detail?.awayBets, detail?.homeBets],
  );
  const liveScoresQuery = useLiveScores(liveScoreGameIds);
  const cosmeticsQuery = useEquippedCosmeticsForUsers([
    detail?.matchup.home_user_id,
    detail?.matchup.away_user_id,
    userId,
  ]);
  const celebrationFlag = useLocalFlag(
    detail?.matchup.id
      ? `action-arena.win-celebration.${detail.matchup.id}`
      : 'action-arena.win-celebration.pending',
  );
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [editingBet, setEditingBet] = useState<PlacedBet | null>(null);
  const [detailBet, setDetailBet] = useState<{
    bet: BetWithLegs;
    ownerLabel: string;
  } | null>(null);
  const adHookTriggered = useRef(false);
  const userWonMatchupForEffect = Boolean(
    userId && detail?.matchup.winner_id && detail.matchup.winner_id === userId,
  );

  const refetchActiveDetail = useCallback(async () => {
    await initialMatchupQuery.refetch();
    await selectedWeekMatchupQuery.refetch();
    if (!isInitialWeek) {
      await activeMatchupQuery.refetch();
    }
  }, [
    activeMatchupQuery.refetch,
    initialMatchupQuery.refetch,
    isInitialWeek,
    selectedWeekMatchupQuery.refetch,
  ]);

  useEffect(() => {
    if (!initialDetail || initialDetail.matchup.id !== resolvedMatchupId) {
      return;
    }

    setSelectedWeek(initialDetail.matchup.week_number);
  }, [initialDetail?.matchup.id, initialDetail?.matchup.week_number, resolvedMatchupId]);

  useEffect(() => {
    if (!detail) return;
    logAnalyticsEvent('matchup_viewed', {
      league_id: detail.matchup.league_id,
      matchup_id: detail.matchup.id,
      user_id: userId,
      week_number: detail.matchup.week_number,
    });
  }, [detail, userId]);

  useEffect(() => {
    if (!detail?.revealAt) {
      return undefined;
    }

    const delay = new Date(detail.revealAt).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      void refetchActiveDetail();
    }, Math.min(delay + 1000, 2_147_483_647));

    return () => clearTimeout(timeout);
  }, [detail?.revealAt, refetchActiveDetail]);

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
    if (!userWonMatchupForEffect || celebrationFlag.isLoading || celebrationFlag.value) {
      return;
    }

    setCelebrationVisible(true);
  }, [celebrationFlag.isLoading, celebrationFlag.value, userWonMatchupForEffect]);

  const matchupLoading =
    initialMatchupQuery.isLoading ||
    (!isInitialWeek &&
      !isFutureWeek &&
      (selectedWeekMatchupQuery.isLoading || activeMatchupQuery.isLoading));

  if (matchupLoading) {
    return <LoadingState />;
  }

  if (!initialDetail) {
    return (
      <ScreenWrapper centered className="gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-full border border-coral-red/40 bg-coral-red/10">
          <Ionicons color={THEME_COLORS.coralRed} name="alert" size={28} />
        </View>
        <Text
          className="text-center text-2xl font-black uppercase text-white"
          style={{ letterSpacing: -0.4 }}>
          Matchup Unavailable
        </Text>
        <Text className="text-center text-base font-semibold text-white/55">
          This matchup could not be loaded.
        </Text>
      </ScreenWrapper>
    );
  }

  if (isFutureWeek || !detail) {
    return (
      <ScreenWrapper className="px-0 pb-0 pt-0">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ gap: 18, padding: 20, paddingBottom: 36 }}
          refreshControl={
            <RefreshControl
              tintColor={THEME_COLORS.electricGreen}
              refreshing={
                initialMatchupQuery.isRefetching ||
                selectedWeekMatchupQuery.isRefetching ||
                activeMatchupQuery.isRefetching
              }
              onRefresh={refetchActiveDetail}
            />
          }
          showsVerticalScrollIndicator={false}>
          <View className="items-end">
            <WeekNavigator
              maxWeek={REGULAR_SEASON_WEEKS}
              onChange={(week) => {
                haptics.selection();
                setSelectedWeek(week);
                setEditingBet(null);
                setDetailBet(null);
              }}
              week={selectedWeekNumber}
            />
          </View>
          {isFutureWeek ? (
            <WeekUnavailableCard weekNumber={selectedWeekNumber} />
          ) : (
            <NoMatchupScheduledCard weekNumber={selectedWeekNumber} />
          )}
        </ScrollView>
      </ScreenWrapper>
    );
  }

  const homeProfit = detail.matchup.home_profit ?? detail.homeStanding?.weekly_profit ?? 0;
  const awayProfit = detail.matchup.away_profit ?? detail.awayStanding?.weekly_profit ?? 0;
  const homeName = getLeagueMemberPrimaryName(detail.homeMember, detail.homeUser, 'Home');
  const awayName = detail.matchup.away_user_id
    ? getLeagueMemberPrimaryName(detail.awayMember, detail.awayUser, 'Opponent')
    : 'Bye Week';
  const cosmeticsByUserId = cosmeticsQuery.data ?? {};

  const userWonMatchup = Boolean(
    userId && detail.matchup.winner_id && detail.matchup.winner_id === userId,
  );

  const homeLockBet = detail.homeBets.find((bet) => bet.is_lock) ?? null;
  const awayLockBet = detail.awayBets.find((bet) => bet.is_lock) ?? null;
  const homeNonLockBets = detail.homeBets.filter((bet) => !bet.is_lock);
  const awayNonLockBets = detail.awayBets.filter((bet) => !bet.is_lock);
  const homeIsUser = detail.matchup.home_user_id === userId;
  const awayIsUser = Boolean(detail.matchup.away_user_id) && detail.matchup.away_user_id === userId;
  const isByeWeek = detail.matchup.away_user_id === null;
  const placedBets = placedBetsQuery.data ?? [];
  const activeEditingBet = isCurrentWeek && editingBet
    ? placedBets.find((bet) => bet.id === editingBet.id) ?? editingBet
    : null;

  const handleBetPress = (bet: BetWithLegs, isOwnPick: boolean, ownerLabel: string) => {
    if (isOwnPick && isCurrentWeek && bet.result === 'pending' && !isParentPickLocked(bet)) {
      haptics.selection();
      setDetailBet(null);
      setEditingBet(bet as PlacedBet);
      void oddsQuery.refetch();
      return;
    }

    haptics.selection();
    setEditingBet(null);
    setDetailBet({ bet, ownerLabel });
  };

  const handleSavePlacedBetEdit = async (edit: BetEditSubmission) => {
    try {
      await updatePlacedBet.mutateAsync(edit);
      setEditingBet(null);
      haptics.success();
      await refetchActiveDetail();
      Alert.alert('Pick updated', 'Your submitted pick has been updated.');
    } catch (error) {
      haptics.error();
      Alert.alert('Could not update pick', error instanceof Error ? error.message : 'Try again.');
    }
  };

  return (
    <ScreenWrapper className="px-0 pb-0 pt-0">
      <WinCelebration
        cosmetics={userId ? cosmeticsByUserId[userId] : undefined}
        fireKey={resolvedMatchupId}
        onComplete={() => {
          setCelebrationVisible(false);
          void celebrationFlag.markComplete();
        }}
        visible={celebrationVisible}
      />
      <PostSubmitEditModal
        bet={activeEditingBet}
        isSaving={updatePlacedBet.isPending}
        oddsGames={oddsQuery.data ?? []}
        placedBets={placedBets}
        replacementLinesError={oddsQuery.error}
        replacementLinesLoading={oddsQuery.isLoading || oddsQuery.isRefetching}
        onCancel={() => setEditingBet(null)}
        onRetryReplacementLines={() => {
          haptics.selection();
          void oddsQuery.refetch();
        }}
        onSave={handleSavePlacedBetEdit}
      />
      <ReadOnlyPickDetailModal
        bet={detailBet?.bet ?? null}
        liveScoresByGameId={liveScoresQuery.scoresByGameId}
        ownerLabel={detailBet?.ownerLabel ?? 'Pick'}
        onClose={() => setDetailBet(null)}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 18, padding: 20, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={
              initialMatchupQuery.isRefetching ||
              selectedWeekMatchupQuery.isRefetching ||
              activeMatchupQuery.isRefetching
            }
            onRefresh={refetchActiveDetail}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-end">
          <View className="flex-row items-center gap-2">
            {userWonMatchup ? (
              <View
                className="flex-row items-center gap-1.5 rounded-full border border-gold/50 bg-gold/15 px-3 py-2"
                style={{
                  shadowColor: THEME_COLORS.gold,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                }}>
                <Ionicons color={THEME_COLORS.gold} name="trophy" size={12} />
                <Text
                  className="text-[10px] font-black uppercase text-gold"
                  style={{ letterSpacing: 1.5 }}>
                  You Won
                </Text>
              </View>
            ) : null}
            <WeekNavigator
              maxWeek={REGULAR_SEASON_WEEKS}
              onChange={(week) => {
                haptics.selection();
                setSelectedWeek(week);
                setEditingBet(null);
                setDetailBet(null);
              }}
              week={selectedWeekNumber}
            />
          </View>
        </View>

        {isByeWeek ? (
          <>
            <ByeWeekBanner weekNumber={selectedWeekNumber} />
            <View className="gap-5">
              <BetColumnSection
                bets={detail.homeBets}
                cosmetics={cosmeticsByUserId[detail.matchup.home_user_id]}
                emptyVariant="You"
                isUser
                liveScoresByGameId={liveScoresQuery.scoresByGameId}
                onBetPress={(bet) => handleBetPress(bet, true, 'Your Pick')}
                side="home"
                subtitle="Your picks this week (does not affect H2H record)"
                title={homeName}
                visibility={detail.homePickVisibility}
              />
            </View>
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
              homeName={homeName}
              homeProfit={homeProfit}
            />
            <LockShowdown
              awayBet={awayLockBet}
              awayCosmetics={
                detail.matchup.away_user_id
                  ? cosmeticsByUserId[detail.matchup.away_user_id]
                  : undefined
              }
              awayIsUser={awayIsUser}
              awayName={awayName}
              awayVisibility={detail.awayPickVisibility}
              homeBet={homeLockBet}
              homeCosmetics={cosmeticsByUserId[detail.matchup.home_user_id]}
              homeIsUser={homeIsUser}
              homeName={homeName}
              homeVisibility={detail.homePickVisibility}
              liveScoresByGameId={liveScoresQuery.scoresByGameId}
              onAwayBetPress={(bet) => handleBetPress(bet, awayIsUser, awayIsUser ? 'Your Pick' : `${awayName}'s Pick`)}
              onHomeBetPress={(bet) => handleBetPress(bet, homeIsUser, homeIsUser ? 'Your Pick' : `${homeName}'s Pick`)}
            />
            <View className="gap-5">
              <BetColumnSection
                bets={homeNonLockBets}
                cosmetics={cosmeticsByUserId[detail.matchup.home_user_id]}
                emptyVariant={homeIsUser ? 'You' : 'Opponent'}
                isUser={homeIsUser}
                liveScoresByGameId={liveScoresQuery.scoresByGameId}
                onBetPress={(bet) => handleBetPress(bet, homeIsUser, homeIsUser ? 'Your Pick' : `${homeName}'s Pick`)}
                side="home"
                subtitle={`${homeNonLockBets.length === 0 ? 'No' : homeNonLockBets.length} undercard ${
                  homeNonLockBets.length === 1 ? 'pick' : 'picks'
                } besides the Pick of the Week`}
                title={homeName}
                visibility={detail.homePickVisibility}
              />
              <BetColumnSection
                bets={awayNonLockBets}
                cosmetics={
                  detail.matchup.away_user_id
                    ? cosmeticsByUserId[detail.matchup.away_user_id]
                    : undefined
                }
                emptyVariant={awayIsUser ? 'You' : 'Opponent'}
                isUser={awayIsUser}
                liveScoresByGameId={liveScoresQuery.scoresByGameId}
                onBetPress={(bet) => handleBetPress(bet, awayIsUser, awayIsUser ? 'Your Pick' : `${awayName}'s Pick`)}
                side="away"
                subtitle={`${awayNonLockBets.length === 0 ? 'No' : awayNonLockBets.length} undercard ${
                  awayNonLockBets.length === 1 ? 'pick' : 'picks'
                } besides the Pick of the Week`}
                title={awayName}
                visibility={detail.awayPickVisibility}
              />
            </View>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
