import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Badge,
  Card,
  PressableScale,
  SkeletonLoader,
  SlidingTabIndicator,
  type SlidingTabOption,
} from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  type LeagueChatMessage,
  type SharedBetMetadata,
  useLeagueChat,
  useSendLeagueChatMessage,
} from '@/hooks/use-league-chat';
import { type LeagueDetail, useLeagueDetail } from '@/hooks/use-leagues';
import { type WeeklyAward, type WeeklyAwards, useWeeklyAwards } from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import {
  formatAmericanOdds,
  formatCurrency,
  formatLeagueType,
  formatProfit,
  formatRecord,
  formatSport,
  getProfitTone,
} from '@/lib/format';
import type { BetType, Json, LeagueVisibility, StandingRow, WeeklyMatchupRow } from '@/types/database';

type DetailTab = 'standings' | 'schedule' | 'members' | 'chat';
type PlayoffStatus = 'clinched' | 'eliminated' | null;

const TABS: { icon: React.ComponentProps<typeof Ionicons>['name']; key: DetailTab; label: string }[] = [
  { icon: 'podium', key: 'standings', label: 'Standings' },
  { icon: 'calendar', key: 'schedule', label: 'Schedule' },
  { icon: 'people', key: 'members', label: 'Members' },
  { icon: 'chatbubbles', key: 'chat', label: 'Chat' },
];

function getParamValue(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function getDisplayName(detail: LeagueDetail, userId: string) {
  return detail.profilesById[userId]?.display_name ?? 'Unknown Player';
}

function getAwayDisplayName(detail: LeagueDetail, matchup: WeeklyMatchupRow) {
  return matchup.away_user_id ? getDisplayName(detail, matchup.away_user_id) : 'Bye Week';
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
}

function getShortTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSharedBetMetadata(value: Json): value is SharedBetMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.amount === 'number' &&
    typeof value.odds === 'number' &&
    typeof value.potentialPayout === 'number' &&
    typeof value.weekNumber === 'number' &&
    typeof value.betType === 'string' &&
    Array.isArray(value.legs)
  );
}

function betTypeAccent(type: BetType) {
  if (type === 'parlay') return THEME_COLORS.amberAccent;
  if (type === 'teaser') return THEME_COLORS.cyanAccent;
  return THEME_COLORS.electricGreen;
}

function rankAccent(rank: number): { bg: string; ring: string; text: string } {
  if (rank === 1) {
    return { bg: 'bg-gold/15', ring: 'border-gold/60', text: 'text-gold' };
  }
  if (rank === 2) {
    return { bg: 'bg-white/10', ring: 'border-white/40', text: 'text-white' };
  }
  if (rank === 3) {
    return { bg: 'bg-amber-accent/15', ring: 'border-amber-accent/50', text: 'text-amber-accent' };
  }
  return { bg: 'bg-white/[0.04]', ring: 'border-white/10', text: 'text-white/70' };
}

function visibilityIcon(visibility: LeagueVisibility) {
  return visibility === 'private' ? 'lock-closed' : 'earth';
}

function playoffStatusForStanding(
  detail: LeagueDetail,
  standing: StandingRow,
): PlayoffStatus {
  if (detail.league.type !== 'h2h' || detail.standings.length < 2) {
    return null;
  }

  const playoffSpots = Math.min(8, detail.standings.length);

  if (detail.league.current_week > 14) {
    return standing.rank <= playoffSpots ? 'clinched' : 'eliminated';
  }

  const remainingWeeks = Math.max(0, 14 - detail.league.current_week);

  if (detail.league.current_week < 8) {
    return null;
  }

  const outsideMaxWins = Math.max(
    ...detail.standings
      .filter((row) => row.rank > playoffSpots)
      .map((row) => row.wins + remainingWeeks),
    -1,
  );
  const cutoffWins = detail.standings[playoffSpots - 1]?.wins ?? 0;

  if (standing.rank <= playoffSpots && standing.wins > outsideMaxWins) {
    return 'clinched';
  }

  if (standing.rank > playoffSpots && standing.wins + remainingWeeks < cutoffWins) {
    return 'eliminated';
  }

  return null;
}

function PlayoffStatusIcon({ status }: { status: PlayoffStatus }) {
  if (!status) {
    return null;
  }

  const isClinched = status === 'clinched';

  return (
    <View
      className={cn(
        'h-5 w-5 items-center justify-center rounded-full border',
        isClinched
          ? 'border-electric-green/45 bg-electric-green/15'
          : 'border-coral-red/45 bg-coral-red/15',
      )}>
      <Ionicons
        color={isClinched ? THEME_COLORS.electricGreen : THEME_COLORS.coralRed}
        name={isClinched ? 'checkmark' : 'close'}
        size={12}
      />
    </View>
  );
}

function DetailSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <View className="gap-5 px-5 py-6">
        <SkeletonLoader height={34} width="70%" />
        <SkeletonLoader height={18} width="50%" />
        {[0, 1, 2].map((item) => (
          <Card key={item}>
            <View className="gap-4">
              <SkeletonLoader height={22} width="54%" />
              <SkeletonLoader height={80} />
            </View>
          </Card>
        ))}
      </View>
    </SafeAreaView>
  );
}

function PlayerAvatar({
  isUser,
  name,
  side,
}: {
  isUser?: boolean;
  name: string;
  side: 'home' | 'away';
}) {
  const accent = isUser
    ? 'border-electric-green/60 bg-electric-green/15'
    : side === 'home'
      ? 'border-cyan-accent/40 bg-cyan-accent/10'
      : 'border-coral-red/40 bg-coral-red/10';
  const textColor = isUser
    ? 'text-electric-green'
    : side === 'home'
      ? 'text-cyan-accent'
      : 'text-coral-red';
  return (
    <View
      className={cn('h-16 w-16 items-center justify-center rounded-2xl border', accent)}
      style={
        isUser
          ? {
              shadowColor: THEME_COLORS.electricGreen,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 12,
            }
          : undefined
      }>
      <Text className={cn('text-xl font-black uppercase', textColor)} style={{ letterSpacing: 0.5 }}>
        {getInitials(name) || '?'}
      </Text>
    </View>
  );
}

function MatchupRow({ detail, matchup }: { detail: LeagueDetail; matchup: WeeklyMatchupRow }) {
  const isHomeWinner = matchup.winner_id && matchup.winner_id === matchup.home_user_id;
  const isAwayWinner =
    matchup.away_user_id && matchup.winner_id && matchup.winner_id === matchup.away_user_id;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          {isHomeWinner ? (
            <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={14} />
          ) : null}
          <Text className="flex-1 text-base font-black text-white" numberOfLines={1}>
            {getDisplayName(detail, matchup.home_user_id)}
          </Text>
        </View>
        <Text className={cn('text-base font-black', getProfitTone(matchup.home_profit ?? 0))}>
          {matchup.home_profit === null ? '–' : formatProfit(matchup.home_profit)}
        </Text>
      </View>
      <View className="h-px bg-white/[0.08]" />
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          {isAwayWinner ? (
            <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={14} />
          ) : null}
          <Text className="flex-1 text-base font-black text-white" numberOfLines={1}>
            {getAwayDisplayName(detail, matchup)}
          </Text>
        </View>
        <Text className={cn('text-base font-black', getProfitTone(matchup.away_profit ?? 0))}>
          {matchup.away_profit === null ? '–' : formatProfit(matchup.away_profit)}
        </Text>
      </View>
    </View>
  );
}

function FightCard({
  detail,
  matchup,
  userId,
}: {
  detail: LeagueDetail;
  matchup: WeeklyMatchupRow;
  userId: string;
}) {
  const homeName = getDisplayName(detail, matchup.home_user_id);
  const awayName = getAwayDisplayName(detail, matchup);
  const homeProfit = matchup.home_profit;
  const awayProfit = matchup.away_profit;
  const homeIsUser = matchup.home_user_id === userId;
  const awayIsUser = matchup.away_user_id === userId;

  return (
    <Card tone="highlight">
      <View className="gap-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text
              className="text-[10px] font-black uppercase text-electric-green"
              style={{ letterSpacing: 2.5 }}>
              This Week
            </Text>
            <Text
              className="mt-1 text-2xl font-black uppercase text-white"
              style={{ letterSpacing: -0.4 }}>
              Main Event
            </Text>
          </View>
          <Badge label={`Week ${detail.league.current_week}`} tone="green" />
        </View>

        <View className="flex-row items-center">
          <View className="flex-1 items-center gap-3">
            <PlayerAvatar isUser={homeIsUser} name={homeName} side="home" />
            <View className="items-center gap-1">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Home
              </Text>
              <Text
                className="text-center text-base font-black text-white"
                numberOfLines={1}
                style={{ letterSpacing: -0.3 }}>
                {homeName}
              </Text>
              <Text
                className={cn(
                  'text-2xl font-black',
                  homeProfit === null ? 'text-white/50' : getProfitTone(homeProfit ?? 0),
                )}
                style={{ letterSpacing: -0.5 }}>
                {homeProfit === null ? '–' : formatProfit(homeProfit)}
              </Text>
            </View>
          </View>

          <View className="items-center px-3">
            <View className="h-12 w-12 items-center justify-center rounded-full border border-gold/50 bg-gold/15">
              <Text className="text-base font-black text-gold" style={{ letterSpacing: 0.5 }}>
                VS
              </Text>
            </View>
          </View>

          <View className="flex-1 items-center gap-3">
            <PlayerAvatar isUser={awayIsUser} name={awayName} side="away" />
            <View className="items-center gap-1">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Away
              </Text>
              <Text
                className="text-center text-base font-black text-white"
                numberOfLines={1}
                style={{ letterSpacing: -0.3 }}>
                {awayName}
              </Text>
              <Text
                className={cn(
                  'text-2xl font-black',
                  awayProfit === null ? 'text-white/50' : getProfitTone(awayProfit ?? 0),
                )}
                style={{ letterSpacing: -0.5 }}>
                {awayProfit === null ? '–' : formatProfit(awayProfit)}
              </Text>
            </View>
          </View>
        </View>

        {matchup.is_championship ? (
          <View className="items-center">
            <Badge label="Championship" tone="gold" />
          </View>
        ) : matchup.is_playoff ? (
          <View className="items-center">
            <Badge label="Playoff" tone="cyan" />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function InviteCodeCard({ detail }: { detail: LeagueDetail }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyInviteCode = async () => {
    await Clipboard.setStringAsync(detail.league.invite_code);
    setCopied(true);
  };

  return (
    <Card>
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text
              className="text-[10px] font-black uppercase text-white/45"
              style={{ letterSpacing: 2 }}>
              Invite Code
            </Text>
            <Text
              className="mt-1 text-3xl font-black text-electric-green"
              style={{ letterSpacing: 4 }}>
              {detail.league.invite_code}
            </Text>
          </View>
          <Badge label={`${detail.members.length}/${detail.league.max_members}`} tone="gold" />
        </View>

        <PressableScale onPress={copyInviteCode} accessibilityRole="button">
          <View
            className={cn(
              'flex-row items-center justify-center gap-2 rounded-2xl border py-3',
              copied
                ? 'border-electric-green bg-electric-green/15'
                : 'border-white/15 bg-white/[0.05]',
            )}
            style={
              copied
                ? {
                    shadowColor: THEME_COLORS.electricGreen,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.45,
                    shadowRadius: 12,
                  }
                : undefined
            }>
            {copied ? (
              <View className="flex-row items-center gap-2">
                <Ionicons color={THEME_COLORS.electricGreen} name="checkmark-circle" size={18} />
                <Text
                  className="text-sm font-black uppercase text-electric-green"
                  style={{ letterSpacing: 1.5 }}>
                  Copied to Clipboard
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <Ionicons color={THEME_COLORS.textPrimary} name="copy-outline" size={18} />
                <Text
                  className="text-sm font-black uppercase text-white"
                  style={{ letterSpacing: 1.5 }}>
                  Tap to Copy
                </Text>
              </View>
            )}
          </View>
        </PressableScale>
      </View>
    </Card>
  );
}

function AwardCard({ award }: { award: WeeklyAward }) {
  return (
    <View className="flex-1 rounded-2xl border border-gold/25 bg-gold/[0.06] p-3">
      <Text className="text-[10px] font-black uppercase text-gold" style={{ letterSpacing: 1.4 }}>
        {award.label}
      </Text>
      <Text className="mt-2 text-sm font-black text-white" numberOfLines={1}>
        {award.user?.display_name ?? 'No winner yet'}
      </Text>
      <Text className={cn('mt-1 text-sm font-black', getProfitTone(award.profit))}>
        {formatProfit(award.profit)}
      </Text>
    </View>
  );
}

function WeeklyAwardsCard({ awards }: { awards: WeeklyAwards | undefined }) {
  if (!awards || (!awards.sharpest && !awards.degen && !awards.lock)) {
    return null;
  }

  return (
    <Card>
      <View className="gap-4">
        <Text className="text-[10px] font-black uppercase text-gold" style={{ letterSpacing: 2 }}>
          Weekly Awards
        </Text>
        <View className="flex-row gap-2">
          {awards.sharpest ? <AwardCard award={awards.sharpest} /> : null}
          {awards.degen ? <AwardCard award={awards.degen} /> : null}
        </View>
        {awards.lock ? (
          <View className="rounded-2xl border border-electric-green/25 bg-electric-green/[0.06] p-3">
            <Text className="text-[10px] font-black uppercase text-electric-green" style={{ letterSpacing: 1.4 }}>
              {awards.lock.label}
            </Text>
            <Text className="mt-2 text-sm font-black text-white">
              {awards.lock.user?.display_name ?? 'No winner yet'} ·{' '}
              {awards.lock.bet?.bet_legs[0]?.selection ?? 'Bet'}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function StandingsBoard({
  detail,
  userId,
}: {
  detail: LeagueDetail;
  userId: string;
}) {
  const isH2H = detail.league.type === 'h2h';

  if (detail.standings.length === 0) {
    return (
      <Card>
        <Text className="text-base font-semibold text-white/55">
          Standings will appear once members are seeded.
        </Text>
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <View>
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-5">
          <Text
            className="w-9 text-[10px] font-black uppercase text-white/40"
            style={{ letterSpacing: 1.5 }}>
            Rank
          </Text>
          <Text
            className="flex-1 text-[10px] font-black uppercase text-white/40"
            style={{ letterSpacing: 1.5 }}>
            Player
          </Text>
          <Text
            className="text-[10px] font-black uppercase text-white/40"
            style={{ letterSpacing: 1.5 }}>
            {isH2H ? 'Record' : 'Profit'}
          </Text>
        </View>
        <View className="h-px bg-white/[0.08]" />
        {detail.standings.map((standing: StandingRow, index) => {
          const accent = rankAccent(standing.rank);
          const isCurrentUser = standing.user_id === userId;
          const lastRow = index === detail.standings.length - 1;
          const playoffStatus = playoffStatusForStanding(detail, standing);
          return (
            <View
              key={standing.id}
              className={cn(
                'flex-row items-center gap-3 px-5 py-4',
                isCurrentUser ? 'bg-electric-green/[0.06]' : null,
                !lastRow && 'border-b border-white/[0.05]',
              )}
              style={
                isCurrentUser
                  ? {
                      borderLeftColor: THEME_COLORS.electricGreen,
                      borderLeftWidth: 3,
                    }
                  : undefined
              }>
              <View
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-full border',
                  accent.bg,
                  accent.ring,
                )}>
                <Text className={cn('text-sm font-black', accent.text)}>{standing.rank}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-black text-white" numberOfLines={1}>
                    {getDisplayName(detail, standing.user_id)}
                  </Text>
                  {isCurrentUser ? (
                    <View className="rounded-full border border-electric-green/40 bg-electric-green/15 px-2 py-[2px]">
                      <Text
                        className="text-[9px] font-black uppercase text-electric-green"
                        style={{ letterSpacing: 1 }}>
                        You
                      </Text>
                    </View>
                  ) : null}
                  <PlayoffStatusIcon status={playoffStatus} />
                </View>
                <Text className="mt-1 text-[11px] font-semibold text-white/45">
                  Weekly {formatProfit(standing.weekly_profit)}
                </Text>
              </View>
              <Text
                className={cn(
                  'text-base font-black',
                  isH2H ? 'text-white' : getProfitTone(standing.total_profit),
                )}
                style={{ letterSpacing: -0.3 }}>
                {isH2H
                  ? formatRecord(standing.wins, standing.losses, standing.ties)
                  : formatProfit(standing.total_profit)}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function ScheduleList({ detail, userId }: { detail: LeagueDetail; userId: string }) {
  const router = useRouter();

  if (detail.matchups.length === 0) {
    return (
      <Card>
        <Text className="text-base font-semibold text-white/55">
          No matchups have been generated yet.
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-3">
      {detail.matchups.map((matchup) => {
        const involvesUser =
          matchup.home_user_id === userId || matchup.away_user_id === userId;
        return (
          <PressableScale
            key={matchup.id}
            onPress={() =>
              router.push({
                pathname: '/matchups/[matchupId]',
                params: { matchupId: matchup.id },
              })
            }>
            <Card tone={involvesUser ? 'highlight' : 'default'}>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-[10px] font-black uppercase text-white/55"
                    style={{ letterSpacing: 2 }}>
                    Week {matchup.week_number}
                  </Text>
                  {matchup.is_championship ? (
                    <Badge label="Championship" tone="gold" />
                  ) : matchup.is_playoff ? (
                    <Badge label="Playoff" tone="cyan" />
                  ) : involvesUser ? (
                    <Badge label="Your Game" tone="green" />
                  ) : null}
                </View>
                <MatchupRow detail={detail} matchup={matchup} />
              </View>
            </Card>
          </PressableScale>
        );
      })}
    </View>
  );
}

function MembersList({ detail }: { detail: LeagueDetail }) {
  const router = useRouter();
  const standingByUserId = useMemo(
    () =>
      detail.standings.reduce<Record<string, number>>((accumulator, standing) => {
        accumulator[standing.user_id] = standing.total_profit;
        return accumulator;
      }, {}),
    [detail.standings],
  );

  return (
    <Card padded={false}>
      <View>
        {detail.members.map((member, index) => {
          const isCommissioner = member.user_id === detail.league.commissioner_id;
          const totalProfit = standingByUserId[member.user_id] ?? 0;
          const lastRow = index === detail.members.length - 1;
          const memberName = getDisplayName(detail, member.user_id);
          return (
            <PressableScale
              key={member.id}
              onPress={() =>
                router.push({
                  pathname: '/members/[memberId]',
                  params: { leagueId: detail.league.id, memberId: member.user_id },
                })
              }>
              <View
                className={cn(
                  'flex-row items-center gap-3 px-5 py-4',
                  !lastRow && 'border-b border-white/[0.05]',
                )}>
                <View className="h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Text className="text-sm font-black uppercase text-white/80">
                    {getInitials(memberName) || '?'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-black text-white" numberOfLines={1}>
                    {member.team_name}
                  </Text>
                  <Text className="mt-1 text-[11px] font-semibold text-white/50">
                    {memberName}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  {isCommissioner ? <Badge label="Commish" tone="gold" /> : null}
                  <Text
                    className={cn('text-sm font-black', getProfitTone(totalProfit))}
                    style={{ letterSpacing: -0.2 }}>
                    {formatProfit(totalProfit)}
                  </Text>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Card>
  );
}

function SharedBetCard({ metadata }: { metadata: SharedBetMetadata }) {
  const accent = betTypeAccent(metadata.betType);

  return (
    <PressableScale>
      <View className="mt-2 rounded-2xl border bg-arena-bg/50 p-3" style={{ borderColor: `${accent}55` }}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <Badge betType={metadata.betType} />
            <Text
              className="text-[10px] font-black uppercase text-white/45"
              style={{ letterSpacing: 1.4 }}>
              Week {metadata.weekNumber}
            </Text>
          </View>
          <Text className="text-xs font-black" style={{ color: accent }}>
            {formatAmericanOdds(metadata.odds)}
          </Text>
        </View>

        <View className="mt-3 gap-1.5">
          {metadata.legs.map((leg, index) => (
            <View key={`${leg.selection}-${index}`} className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-xs font-semibold text-white/75" numberOfLines={1}>
                {metadata.betType === 'teaser' && leg.originalLine !== null && leg.adjustedLine !== null
                  ? `${leg.selection} ${leg.originalLine} → ${leg.adjustedLine}`
                  : leg.selection}
              </Text>
              <Text className="text-[10px] font-black uppercase text-white/45">
                {formatAmericanOdds(leg.odds)}
              </Text>
            </View>
          ))}
        </View>

        <View className="mt-3 flex-row items-center justify-between border-t border-white/[0.08] pt-3">
          <Text
            className="text-[10px] font-black uppercase text-white/45"
            style={{ letterSpacing: 1.4 }}>
            {formatCurrency(metadata.amount)} stake
          </Text>
          <Text className="text-xs font-black text-electric-green">
            Pays {formatCurrency(metadata.potentialPayout)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

function ChatBubble({
  isMine,
  message,
}: {
  isMine: boolean;
  message: LeagueChatMessage;
}) {
  const isSystem = message.message_type === 'system';
  const isBetShare = message.message_type === 'bet_share';
  const displayName = message.user?.display_name ?? (isSystem ? 'Action Arena' : 'Player');
  const metadata = isSharedBetMetadata(message.metadata) ? message.metadata : null;

  if (isSystem) {
    return (
      <View className="items-center px-2">
        <View className="max-w-[80%] rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
          <Text
            className="text-center text-[10px] font-black uppercase text-white/55"
            style={{ letterSpacing: 1.4 }}>
            {message.body}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className={cn('flex-row items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
      {!isMine ? (
        <View className="h-8 w-8 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Text
            className="text-[10px] font-black uppercase text-white/75"
            style={{ letterSpacing: 0.4 }}>
            {getInitials(displayName) || '?'}
          </Text>
        </View>
      ) : null}
      <View
        className={cn(
          'max-w-[78%] rounded-2xl border p-3',
          isMine
            ? 'border-electric-green/40 bg-electric-green/[0.10]'
            : 'border-white/[0.07] bg-white/[0.04]',
        )}
        style={
          isMine
            ? {
                borderBottomRightRadius: 6,
                shadowColor: THEME_COLORS.electricGreen,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }
            : { borderBottomLeftRadius: 6 }
        }>
        {!isMine ? (
          <Text
            className="text-[11px] font-black uppercase text-white/55"
            style={{ letterSpacing: 1.2 }}
            numberOfLines={1}>
            {displayName}
          </Text>
        ) : null}
        <Text
          className={cn(
            'text-sm font-semibold leading-5',
            isMine ? 'text-white' : 'text-white/85',
          )}
          style={{ letterSpacing: -0.1 }}>
          {message.body}
        </Text>
        {isBetShare && metadata ? <SharedBetCard metadata={metadata} /> : null}
        <Text
          className={cn(
            'mt-1.5 text-[10px] font-semibold',
            isMine ? 'text-electric-green/60 self-end' : 'text-white/40',
          )}>
          {getShortTime(message.created_at)}
        </Text>
      </View>
      {isMine ? (
        <View className="h-8 w-8 items-center justify-center rounded-2xl border border-electric-green/45 bg-electric-green/15">
          <Text
            className="text-[10px] font-black uppercase text-electric-green"
            style={{ letterSpacing: 0.4 }}>
            {getInitials(displayName) || '?'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function LeagueChat({
  detail,
  userId,
}: {
  detail: LeagueDetail;
  userId: string;
}) {
  const [limit, setLimit] = useState(30);
  const [draft, setDraft] = useState('');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const previousMessageCount = useRef(0);
  const chatQuery = useLeagueChat(detail.league.id, limit);
  const sendMessage = useSendLeagueChatMessage(detail.league.id, userId);
  const messages = chatQuery.data ?? [];
  const canSend = draft.trim().length > 0 && !sendMessage.isPending;

  const submitMessage = async () => {
    if (!canSend) {
      return;
    }

    const nextMessage = draft.trim();
    setDraft('');
    haptics.light();
    try {
      await sendMessage.mutateAsync(nextMessage);
    } catch {
      haptics.warning();
    }
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const bottomDistance = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const nearBottom = bottomDistance < 80;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setHasNewMessages(false);
    }
  };

  useEffect(() => {
    const previousCount = previousMessageCount.current;
    previousMessageCount.current = messages.length;

    if (messages.length === 0 || messages.length <= previousCount) {
      return;
    }

    if (previousCount === 0 || isNearBottom) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } else {
      setHasNewMessages(true);
    }
  }, [isNearBottom, messages.length]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Card padded={false}>
        <View className="max-h-[560px] min-h-[420px]">
          <View className="flex-row items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Ionicons color={THEME_COLORS.electricGreen} name="chatbubbles" size={16} />
              <Text
                className="text-[10px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 2 }}>
                League Chat
              </Text>
            </View>
            <Badge label={`${messages.length} shown`} tone="green" />
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ gap: 12, padding: 14 }}
            onScroll={handleScroll}
            scrollEventThrottle={80}
            showsVerticalScrollIndicator={false}>
            {messages.length >= limit ? (
              <PressableScale onPress={() => setLimit((current) => current + 30)}>
                <View className="items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <Text className="text-xs font-black uppercase text-white/60">
                    Load Older Messages
                  </Text>
                </View>
              </PressableScale>
            ) : null}

            {chatQuery.isLoading ? (
              <View className="gap-3">
                {[0, 1, 2].map((item) => (
                  <SkeletonLoader height={70} key={item} radius={16} />
                ))}
              </View>
            ) : null}

            {!chatQuery.isLoading && messages.length === 0 ? (
              <View className="items-center gap-3 py-14">
                <View className="h-14 w-14 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
                  <Ionicons color={THEME_COLORS.electricGreen} name="chatbubble-ellipses" size={24} />
                </View>
                <Text className="text-center text-base font-semibold text-white/55">
                  No league chatter yet. First message sets the tone.
                </Text>
              </View>
            ) : null}

            {messages.map((message) => (
              <ChatBubble
                isMine={message.user_id === userId}
                key={message.id}
                message={message}
              />
            ))}
          </ScrollView>

          {hasNewMessages ? (
            <View className="absolute bottom-20 left-0 right-0 items-center">
              <PressableScale
                onPress={() => {
                  setHasNewMessages(false);
                  scrollRef.current?.scrollToEnd({ animated: true });
                }}>
                <View className="flex-row items-center gap-2 rounded-full border border-electric-green/45 bg-arena-bg px-4 py-2">
                  <Ionicons color={THEME_COLORS.electricGreen} name="arrow-down" size={13} />
                  <Text className="text-[10px] font-black uppercase text-electric-green">
                    New messages
                  </Text>
                </View>
              </PressableScale>
            </View>
          ) : null}

          <View className="border-t border-white/[0.08] p-3">
            <View className="flex-row items-end gap-2 rounded-2xl border border-white/10 bg-arena-bg/70 p-2">
              <NativeTextInput
                className="max-h-28 flex-1 px-2 py-2 text-base font-semibold text-white"
                multiline
                onChangeText={setDraft}
                placeholder="Talk your talk..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={draft}
              />
              <Pressable
                disabled={!canSend}
                onPress={() => {
                  void submitMessage();
                }}>
                <View
                  className={cn(
                    'h-11 w-11 items-center justify-center rounded-2xl border',
                    canSend
                      ? 'border-electric-green/45 bg-electric-green/20'
                      : 'border-white/10 bg-white/[0.04]',
                  )}>
                  <Ionicons
                    color={canSend ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.35)'}
                    name="send"
                    size={18}
                  />
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Card>
    </KeyboardAvoidingView>
  );
}

const TAB_OPTIONS: SlidingTabOption<DetailTab>[] = TABS.map((tab) => ({
  icon: tab.icon,
  label: tab.label,
  value: tab.key,
}));

function TabSwitcher({
  activeTab,
  onChange,
}: {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
}) {
  return <SlidingTabIndicator onChange={onChange} options={TAB_OPTIONS} value={activeTab} />;
}

function TabContent({
  detail,
  tab,
  userId,
}: {
  detail: LeagueDetail;
  tab: DetailTab;
  userId: string;
}) {
  return (
    <View key={tab}>
      {tab === 'standings' ? <StandingsBoard detail={detail} userId={userId} /> : null}
      {tab === 'schedule' ? <ScheduleList detail={detail} userId={userId} /> : null}
      {tab === 'members' ? <MembersList detail={detail} /> : null}
      {tab === 'chat' ? <LeagueChat detail={detail} userId={userId} /> : null}
    </View>
  );
}

function HeroHeader({ detail }: { detail: LeagueDetail }) {
  const isPrivate = detail.league.visibility === 'private';
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
        <Text
          className="text-[11px] font-semibold uppercase text-electric-green"
          style={{ letterSpacing: 1.2 }}>
          League HQ
        </Text>
      </View>
      <Text
        className="text-2xl font-extrabold text-white"
        style={{ letterSpacing: -0.4 }}
        numberOfLines={2}>
        {detail.league.name}
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <Badge
          label={formatLeagueType(detail.league.type)}
          tone={detail.league.type === 'h2h' ? 'cyan' : 'gold'}
        />
        <View
          className={cn(
            'flex-row items-center gap-1 self-start rounded-full border px-3 py-1',
            isPrivate
              ? 'border-coral-red/40 bg-coral-red/15'
              : 'border-electric-green/40 bg-electric-green/15',
          )}>
          <Ionicons
            color={isPrivate ? THEME_COLORS.coralRed : THEME_COLORS.electricGreen}
            name={visibilityIcon(detail.league.visibility)}
            size={11}
          />
          <Text
            className={cn(
              'text-[10px] font-black uppercase',
              isPrivate ? 'text-coral-red' : 'text-electric-green',
            )}
            style={{ letterSpacing: 1.5 }}>
            {detail.league.visibility}
          </Text>
        </View>
        <Badge label={formatSport(detail.league.sport)} tone="green" />
      </View>
    </View>
  );
}

export default function LeagueDetailScreen() {
  const router = useRouter();
  const { initialTab, leagueId } = useLocalSearchParams();
  const resolvedLeagueId = getParamValue(leagueId);
  const resolvedInitialTab = getParamValue(initialTab);
  const { user } = useAuth();
  const detailQuery = useLeagueDetail(resolvedLeagueId, user?.id);
  const awardsQuery = useWeeklyAwards(resolvedLeagueId, detailQuery.data?.league.current_week);
  const detailRefetchRef = useRef(detailQuery.refetch);
  const awardsRefetchRef = useRef(awardsQuery.refetch);
  const [activeTab, setActiveTab] = useState<DetailTab>('standings');

  useEffect(() => {
    if (resolvedInitialTab === 'chat') {
      setActiveTab('chat');
    }
  }, [resolvedInitialTab]);

  useEffect(() => {
    detailRefetchRef.current = detailQuery.refetch;
    awardsRefetchRef.current = awardsQuery.refetch;
  }, [awardsQuery.refetch, detailQuery.refetch]);

  useFocusEffect(
    useCallback(() => {
      if (resolvedLeagueId && user?.id) {
        void detailRefetchRef.current();
        void awardsRefetchRef.current();
      }
    }, [resolvedLeagueId, user?.id]),
  );

  if (detailQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (!detailQuery.data || !user) {
    return (
      <SafeAreaView className="flex-1 bg-arena-bg">
        <View className="flex-1 items-center justify-center px-5">
          <View className="h-16 w-16 items-center justify-center rounded-full border border-coral-red/40 bg-coral-red/10">
            <Ionicons color={THEME_COLORS.coralRed} name="alert" size={28} />
          </View>
          <Text
            className="mt-4 text-center text-2xl font-black uppercase text-white"
            style={{ letterSpacing: -0.4 }}>
            League Unavailable
          </Text>
          <Text className="mt-3 text-center text-base font-semibold text-white/55">
            You may need to join this league before viewing it.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const detail = detailQuery.data;
  const userId = user.id;
  const currentUserMatchup = detail.currentUserMatchup;

  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 18, padding: 20, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={detailQuery.isRefetching}
            onRefresh={detailQuery.refetch}
          />
        }
        showsVerticalScrollIndicator={false}>
        <HeroHeader detail={detail} />
        <InviteCodeCard detail={detail} />

        {awardsQuery.data ? <WeeklyAwardsCard awards={awardsQuery.data} /> : null}

        {detail.league.type === 'h2h' && currentUserMatchup ? (
          <PressableScale
            onPress={() =>
              router.push({
                pathname: '/matchups/[matchupId]',
                params: { matchupId: currentUserMatchup.id },
              })
            }>
            <FightCard detail={detail} matchup={currentUserMatchup} userId={userId} />
          </PressableScale>
        ) : null}

        <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />
        <TabContent detail={detail} tab={activeTab} userId={userId} />
      </ScrollView>
    </SafeAreaView>
  );
}
