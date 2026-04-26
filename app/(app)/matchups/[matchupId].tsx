import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AnimatedNumber,
  Badge,
  Card,
  LivePulse,
  PressableScale,
  SkeletonLoader,
  StaggeredItem,
} from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  type BetWithLegs,
  type MatchupDetail,
  useMatchupDetail,
} from '@/hooks/use-matchups';
import { cn } from '@/lib/cn';
import {
  formatAmericanOdds,
  formatCurrency,
  formatLeagueType,
  formatProfit,
  formatRecord,
  getProfitTone,
} from '@/lib/format';
import type { BetLegRow, BetResult, BetType, UserRow } from '@/types/database';

type Side = 'home' | 'away';

const resultLabel: Record<BetResult, string> = {
  loss: 'Loss',
  pending: 'Pending',
  push: 'Push',
  win: 'Win',
};

function getParamValue(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
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
  return bet.bet_legs.some(
    (leg) => leg.locked || new Date(leg.game_start_time).getTime() <= Date.now(),
  );
}

function selectionLabel(leg: BetLegRow, betType: BetType) {
  if (leg.market === 'moneyline') {
    return leg.selection;
  }
  if (leg.market === 'spread') {
    if (betType === 'teaser' && leg.original_line !== null && leg.adjusted_line !== null) {
      return `${leg.selection} ${leg.original_line > 0 ? '+' : ''}${leg.original_line} → ${
        leg.adjusted_line > 0 ? '+' : ''
      }${leg.adjusted_line}`;
    }
    return `${leg.selection} ${leg.adjusted_line && leg.adjusted_line > 0 ? '+' : ''}${
      leg.adjusted_line ?? leg.original_line ?? ''
    }`;
  }
  if (betType === 'teaser' && leg.original_line !== null && leg.adjusted_line !== null) {
    return `${leg.selection} ${leg.original_line} → ${leg.adjusted_line}`;
  }
  return `${leg.selection} ${leg.adjusted_line ?? leg.original_line ?? ''}`;
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
        Lock 1.5x
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
          {side === 'You' ? 'You haven’t locked any bets yet.' : 'No bets placed for this matchup.'}
        </Text>
      </View>
    </View>
  );
}

function BetCard({ bet, isUser }: { bet: BetWithLegs; isUser: boolean }) {
  const accent = betTypeAccent(bet.bet_type);
  const inProgress = isInProgress(bet);
  const isMultiLeg = bet.bet_type !== 'straight';
  const firstLeg = bet.bet_legs[0];
  const isLock = bet.is_lock;

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
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-2">
            <View className="flex-row items-center gap-2">
              <Badge betType={bet.bet_type} />
              {isLock ? <LockPill /> : null}
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
              {isMultiLeg
                ? `${bet.bet_legs.length}-leg ${bet.bet_type}`
                : firstLeg
                  ? selectionLabel(firstLeg, bet.bet_type)
                  : 'Selection unavailable'}
            </Text>
          </View>
          <ResultPill bet={bet} />
        </View>

        <View className="flex-row justify-between rounded-xl bg-white/[0.04] px-3 py-3">
          <View>
            <Text
              className="text-[10px] font-black uppercase text-white/40"
              style={{ letterSpacing: 1.4 }}>
              Stake
            </Text>
            <Text className="mt-1 text-sm font-black text-white">
              {formatCurrency(bet.amount)}
            </Text>
          </View>
          <View className="items-center">
            <Text
              className="text-[10px] font-black uppercase text-white/40"
              style={{ letterSpacing: 1.4 }}>
              Pays
            </Text>
            <Text className="mt-1 text-sm font-black text-white" style={{ color: accent.hex }}>
              {formatCurrency(bet.potential_payout)}
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
                    <View className="flex-1">
                      <Text
                        className="text-sm font-black text-white"
                        numberOfLines={2}
                        style={{ letterSpacing: -0.2 }}>
                        {selectionLabel(leg, bet.bet_type)}
                      </Text>
                      <Text className="mt-1 text-[11px] font-semibold uppercase text-white/40">
                        {leg.market.replace('_', ' ')} · {formatAmericanOdds(leg.leg_odds)}
                      </Text>
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

  if (inProgress) {
    return (
      <LivePulse color={THEME_COLORS.gold} intensity={0.55}>
        {inner}
      </LivePulse>
    );
  }

  return inner;
}

function PlayerSide({
  isLeading,
  isUser,
  profit,
  record,
  side,
  user,
}: {
  isLeading: boolean;
  isUser: boolean;
  profit: number;
  record: string;
  side: Side;
  user: UserRow | null;
}) {
  const name = user?.display_name ?? (side === 'away' ? 'Bye Week' : 'Unknown Player');
  const accentBorder = isUser
    ? 'border-electric-green/60 bg-electric-green/15'
    : isLeading
      ? 'border-gold/55 bg-gold/15'
      : 'border-white/15 bg-white/[0.05]';
  const initialsColor = isUser
    ? 'text-electric-green'
    : isLeading
      ? 'text-gold'
      : 'text-white';

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
        <Text
          className={cn('text-2xl font-black uppercase', initialsColor)}
          style={{ letterSpacing: 0.5 }}>
          {getInitials(name) || 'BY'}
        </Text>
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
          decimals={Math.abs(profit) % 1 === 0 ? 0 : 2}
          prefix={profit < 0 ? '-$' : '+$'}
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
              {diff > 0 ? '+' : ''}
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
  detail,
  userId,
}: {
  detail: MatchupDetail;
  userId: string | undefined;
}) {
  const homeProfit = detail.matchup.home_profit ?? detail.homeStanding?.weekly_profit ?? 0;
  const awayProfit = detail.matchup.away_profit ?? detail.awayStanding?.weekly_profit ?? 0;
  const homeLeading = homeProfit > awayProfit;
  const awayLeading = awayProfit > homeProfit;

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
                Week {detail.matchup.week_number} · Main Event
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
            isLeading={homeLeading}
            isUser={detail.matchup.home_user_id === userId}
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
            user={detail.homeUser}
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
            isLeading={awayLeading}
            isUser={detail.matchup.away_user_id === userId}
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
            user={detail.awayUser}
          />
        </View>
      </View>
    </Card>
  );
}

function BetColumnSection({
  bets,
  emptyVariant,
  isUser,
  side,
  subtitle,
  title,
}: {
  bets: BetWithLegs[];
  emptyVariant: 'You' | 'Opponent' | 'Player';
  isUser: boolean;
  side: Side;
  subtitle?: string;
  title: string;
}) {
  const accentColor = isUser
    ? THEME_COLORS.electricGreen
    : side === 'home'
      ? THEME_COLORS.cyanAccent
      : THEME_COLORS.coralRed;

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
              {bets.length} {bets.length === 1 ? 'bet' : 'bets'}
            </Text>
          </View>
        </View>
      </View>

      {subtitle ? (
        <Text className="text-xs font-semibold text-white/45">{subtitle}</Text>
      ) : null}

      {bets.length === 0 ? (
        <EmptyBets side={emptyVariant} />
      ) : (
        <View className="gap-3">
          {bets.map((bet, index) => (
            <StaggeredItem index={index} key={bet.id} perItemDelay={60}>
              <BetCard bet={bet} isUser={isUser} />
            </StaggeredItem>
          ))}
        </View>
      )}
    </View>
  );
}

function LoadingState() {
  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <View className="gap-5 px-5 py-6">
        <SkeletonLoader height={34} width="65%" />
        <SkeletonLoader height={210} radius={20} />
        <SkeletonLoader height={120} radius={20} />
        <SkeletonLoader height={160} radius={20} />
      </View>
    </SafeAreaView>
  );
}

export default function MatchupDetailScreen() {
  const router = useRouter();
  const { matchupId } = useLocalSearchParams();
  const resolvedMatchupId = getParamValue(matchupId);
  const { user } = useAuth();
  const matchupQuery = useMatchupDetail(resolvedMatchupId);
  const detail = matchupQuery.data;

  if (matchupQuery.isLoading) {
    return <LoadingState />;
  }

  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-arena-bg">
        <View className="flex-1 items-center justify-center gap-4 px-5">
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
        </View>
      </SafeAreaView>
    );
  }

  const homeProfit = detail.matchup.home_profit ?? detail.homeStanding?.weekly_profit ?? 0;
  const awayProfit = detail.matchup.away_profit ?? detail.awayStanding?.weekly_profit ?? 0;
  const homeName = detail.homeUser?.display_name ?? 'Home';
  const awayName = detail.awayUser?.display_name ?? 'Bye Week';
  const userId = user?.id;

  const userWonMatchup = Boolean(
    userId && detail.matchup.winner_id && detail.matchup.winner_id === userId,
  );

  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 18, padding: 20, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={matchupQuery.isRefetching}
            onRefresh={matchupQuery.refetch}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between">
          <PressableScale onPress={() => router.back()}>
            <View className="flex-row items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.05] px-3 py-2">
              <Ionicons color={THEME_COLORS.textPrimary} name="chevron-back" size={16} />
              <Text
                className="text-xs font-black uppercase text-white"
                style={{ letterSpacing: 1.2 }}>
                Back
              </Text>
            </View>
          </PressableScale>
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
            <View className="flex-row items-center gap-1.5 rounded-full border border-electric-green/30 bg-electric-green/10 px-3 py-2">
              <Ionicons color={THEME_COLORS.electricGreen} name="calendar" size={12} />
              <Text
                className="text-[10px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 1.5 }}>
                Week {detail.matchup.week_number} of 14
              </Text>
            </View>
          </View>
        </View>

        <FightCardHeader detail={detail} userId={userId} />
        <ProfitTug
          awayName={awayName}
          awayProfit={awayProfit}
          homeName={homeName}
          homeProfit={homeProfit}
        />
        <View className="gap-5">
          <BetColumnSection
            bets={detail.homeBets}
            emptyVariant={detail.matchup.home_user_id === userId ? 'You' : 'Opponent'}
            isUser={detail.matchup.home_user_id === userId}
            side="home"
            subtitle={`${detail.homeBets.length === 0 ? 'No' : detail.homeBets.length} ${
              detail.homeBets.length === 1 ? 'bet' : 'bets'
            } locked in for the slate`}
            title={homeName}
          />
          <BetColumnSection
            bets={detail.awayBets}
            emptyVariant={detail.matchup.away_user_id === userId ? 'You' : detail.matchup.away_user_id ? 'Opponent' : 'Player'}
            isUser={Boolean(detail.matchup.away_user_id) && detail.matchup.away_user_id === userId}
            side="away"
            subtitle={
              detail.matchup.away_user_id
                ? `${detail.awayBets.length === 0 ? 'No' : detail.awayBets.length} ${
                    detail.awayBets.length === 1 ? 'bet' : 'bets'
                  } locked in for the slate`
                : 'Opponent has a bye this week.'
            }
            title={awayName}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
