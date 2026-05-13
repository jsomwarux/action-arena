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
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ChatStickerPreview,
  CosmeticAvatar,
  LockEffect,
  TrophySkinIcon,
} from '@/components/cosmetics';
import {
  Badge,
  Button,
  Card,
  NflTeamLogo,
  PressableScale,
  SkeletonLoader,
  WeekNavigator,
} from '@/components/ui';
import { getCosmeticItem } from '@/constants/cosmetics';
import { haptics } from '@/lib/haptics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useEquippedCosmeticsForUsers, useUserCosmetics } from '@/hooks/use-cosmetics';
import {
  type LeagueChatMessage,
  type SharedBetMetadata,
  type StickerMessageMetadata,
  useLeagueChat,
  useSendLeagueChatMessage,
  useSendLeagueChatSticker,
} from '@/hooks/use-league-chat';
import {
  type LeagueDetail,
  useGenerateScheduleMutation,
  useLeagueDetail,
} from '@/hooks/use-leagues';
import {
  type WeeklyAward,
  type WeeklyAwards,
  type WeeklyLiveStanding,
  useWeeklyAwards,
} from '@/hooks/use-profile-stats';
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
import { formatBetLegLabel, formatPickTitle, getPickLogoLabel } from '@/lib/pick-labels';
import type {
  BetMarket,
  BetType,
  EquippedCosmeticsByCategory,
  Json,
  LeagueVisibility,
  SeasonAward,
  StandingRow,
  WeeklyMatchupRow,
} from '@/types/database';

type DetailTab = 'standings' | 'schedule' | 'members' | 'chat';
type PlayoffPlaceholderWeek = 15 | 16 | 17;
type PlayoffStatus = 'clinched' | 'eliminated' | null;

const SCREEN_HORIZONTAL_PADDING = 40;
const DETAIL_TAB_HEIGHT = 48;
const DETAIL_TAB_HORIZONTAL_GAP = 10;
const DETAIL_TAB_UNDERLINE_HEIGHT = 3;
const REGULAR_SEASON_WEEKS = 14;
const PLAYOFF_PLACEHOLDER_WEEKS: PlayoffPlaceholderWeek[] = [15, 16, 17];

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'standings', label: 'Standings' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'members', label: 'Members' },
  { key: 'chat', label: 'Chat' },
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

function getStandingsForWeek(detail: LeagueDetail, weekNumber: number) {
  return detail.standings
    .filter((standing) => standing.week_number === weekNumber)
    .sort((left, right) => left.rank - right.rank);
}

function getUserMatchupForWeek(detail: LeagueDetail, userId: string, weekNumber: number) {
  return (
    detail.matchups.find(
      (matchup) =>
        matchup.week_number === weekNumber &&
        (matchup.home_user_id === userId || matchup.away_user_id === userId),
    ) ?? null
  );
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

function isBetMarket(value: string): value is BetMarket {
  return value === 'moneyline' || value === 'spread' || value === 'over_under';
}

function isSharedBetMetadata(value: Json): value is SharedBetMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.amount === 'number' &&
    typeof value.odds === 'number' &&
    typeof value.potentialReward === 'number' &&
    typeof value.weekNumber === 'number' &&
    typeof value.betType === 'string' &&
    Array.isArray(value.legs)
  );
}

function isStickerMetadata(value: Json): value is StickerMessageMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const metadata = value as Record<string, Json | undefined>;
  return typeof metadata.stickerId === 'string' && typeof metadata.stickerName === 'string';
}

function isSeasonAward(value: Json): value is SeasonAward {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.award_key === 'string' &&
    typeof value.award_label === 'string' &&
    (typeof value.user_id === 'string' || value.user_id === null) &&
    (typeof value.metric === 'number' || value.metric === null) &&
    (typeof value.value_label === 'string' || value.value_label === null)
  );
}

function seasonAwardsFromJson(value: Json): SeasonAward[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isSeasonAward);
}

function betTypeAccent(type: BetType) {
  if (type === 'parlay') return THEME_COLORS.amberAccent;
  if (type === 'teaser') return THEME_COLORS.cyanAccent;
  return THEME_COLORS.electricGreen;
}

function titleCaseBetType(type: BetType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getPickSummary(bet: WeeklyAward['bet']) {
  if (!bet) {
    return 'Pick pending';
  }

  return bet.bet_type === 'straight'
    ? `Straight · ${formatPickTitle(bet)}`
    : `${bet.bet_legs.length}-Leg ${titleCaseBetType(bet.bet_type)}`;
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

  const viewedWeek = standing.week_number;

  if (viewedWeek > 14) {
    return standing.rank <= playoffSpots ? 'clinched' : 'eliminated';
  }

  const remainingWeeks = Math.max(0, 14 - viewedWeek);

  if (viewedWeek < 8) {
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
  cosmetics,
  isUser,
  name,
  side,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  isUser?: boolean;
  name: string;
  side: 'home' | 'away';
}) {
  const accent = isUser
    ? 'border-electric-green/60 bg-electric-green/15'
    : side === 'home'
      ? 'border-cyan-accent/40 bg-cyan-accent/10'
      : 'border-coral-red/40 bg-coral-red/10';
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
      <CosmeticAvatar cosmetics={cosmetics} name={name} size="lg" />
    </View>
  );
}

function FightCard({
  cosmeticsByUserId,
  detail,
  matchup,
  weekNumber,
  weekStatus,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  matchup: WeeklyMatchupRow;
  weekNumber: number;
  weekStatus: 'current' | 'future' | 'past';
  userId: string;
}) {
  const homeName = getDisplayName(detail, matchup.home_user_id);
  const awayName = getAwayDisplayName(detail, matchup);
  const homeProfit = matchup.home_profit;
  const awayProfit = matchup.away_profit;
  const homeIsUser = matchup.home_user_id === userId;
  const awayIsUser = matchup.away_user_id === userId;
  const eyebrow =
    weekStatus === 'current' ? 'This Week' : weekStatus === 'future' ? 'Upcoming' : 'Completed';
  const title =
    weekStatus === 'current'
      ? 'Your Matchup'
      : weekStatus === 'future'
        ? 'Week Preview'
        : 'Week Recap';
  const badgeTone = weekStatus === 'future' ? 'cyan' : weekStatus === 'past' ? 'gold' : 'green';

  return (
    <Card tone="highlight">
      <View className="gap-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text
              className="text-[10px] font-black uppercase text-electric-green"
              style={{ letterSpacing: 2.5 }}>
              {eyebrow}
            </Text>
            <Text
              className="mt-1 text-2xl font-black uppercase text-white"
              style={{ letterSpacing: -0.4 }}>
              {title}
            </Text>
          </View>
          <Badge label={`Week ${weekNumber}`} tone={badgeTone} />
        </View>

        <View className="flex-row items-center">
          <View className="flex-1 items-center gap-3">
            <PlayerAvatar
              cosmetics={cosmeticsByUserId[matchup.home_user_id]}
              isUser={homeIsUser}
              name={homeName}
              side="home"
            />
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
            <PlayerAvatar
              cosmetics={matchup.away_user_id ? cosmeticsByUserId[matchup.away_user_id] : undefined}
              isUser={awayIsUser}
              name={awayName}
              side="away"
            />
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

function InviteCodeCard({
  detail,
  seasonInProgress,
}: {
  detail: LeagueDetail;
  seasonInProgress: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isLeagueFull = detail.members.length >= detail.league.max_members;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyInviteCode = async () => {
    await Clipboard.setStringAsync(detail.league.invite_code);
    setCopied(true);
  };

  if (seasonInProgress) {
    return null;
  }

  if (isLeagueFull) {
    return null;
  }

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
  const tiedUsers = award.users.length > 1;
  const displayName = tiedUsers
    ? award.users.length <= 2
      ? award.users.map((user) => user.display_name).join(' + ')
      : `${award.users.length} tied`
    : award.user?.display_name ?? 'No winner yet';

  return (
    <View className="flex-1 rounded-2xl border border-gold/25 bg-gold/[0.06] p-3">
      <Text className="text-[10px] font-black uppercase text-gold" style={{ letterSpacing: 1.4 }}>
        {award.label}
      </Text>
      <Text className="mt-2 text-sm font-black text-white" numberOfLines={1}>
        {displayName}
      </Text>
      <Text className={cn('mt-1 text-sm font-black', getProfitTone(award.profit))}>
        {formatProfit(award.profit)}
      </Text>
    </View>
  );
}

function LiveStandingRow({ row }: { row: WeeklyLiveStanding }) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5">
      <View className="flex-1">
        <Text className="text-sm font-black text-white" numberOfLines={1}>
          {row.user?.display_name ?? 'Unknown Player'}
        </Text>
        <Text className="mt-0.5 text-[11px] font-semibold text-white/45">
          {row.settledPicks}/{row.pickCount} picks settled
          {row.pendingPicks > 0 ? ` · ${row.pendingPicks} pending` : ''}
        </Text>
      </View>
      <Text className={cn('text-sm font-black', getProfitTone(row.profit))}>
        {formatProfit(row.profit)}
      </Text>
    </View>
  );
}

function WeeklyAwardsCard({
  awards,
  weekNumber,
}: {
  awards: WeeklyAwards | undefined;
  weekNumber: number;
}) {
  if (!awards) {
    return null;
  }

  const noActivity = !awards.hasBets && awards.liveStandings.length === 0 && !awards.lock;
  const inProgress = !awards.isFullySettled;
  const hasFinalAwards = Boolean(awards.sharpest || awards.coldStreak);

  return (
    <Card>
      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className={cn(
              'text-[10px] font-black uppercase',
              inProgress ? 'text-electric-green' : 'text-gold',
            )}
            style={{ letterSpacing: 2 }}>
            {inProgress ? `Week ${weekNumber} Standings` : 'Weekly Awards'}
          </Text>
          <Badge label={inProgress ? 'In Progress' : 'Final'} tone={inProgress ? 'green' : 'gold'} />
        </View>
        {noActivity ? (
          <View className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
            <Text className="text-sm font-semibold text-white/55">
              No picks have been recorded for Week {weekNumber} yet.
            </Text>
          </View>
        ) : inProgress ? (
          <View className="gap-2">
            {awards.liveStandings.map((row) => (
              <LiveStandingRow key={row.userId} row={row} />
            ))}
          </View>
        ) : hasFinalAwards ? (
          <View className="flex-row gap-2">
            {awards.sharpest ? <AwardCard award={awards.sharpest} /> : null}
            {awards.coldStreak ? <AwardCard award={awards.coldStreak} /> : null}
          </View>
        ) : (
          <View className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
            <Text className="text-sm font-semibold text-white/55">
              No weekly awards were assigned for an even week.
            </Text>
          </View>
        )}
        {awards.lock ? (
          <View className="rounded-2xl border border-electric-green/25 bg-electric-green/[0.06] p-3">
            <Text className="text-[10px] font-black uppercase text-electric-green" style={{ letterSpacing: 1.4 }}>
              {awards.lock.label}
            </Text>
            <Text className="mt-2 text-sm font-black text-white">
              {awards.lock.user?.display_name ?? 'No winner yet'} ·{' '}
              {getPickSummary(awards.lock.bet)}
            </Text>
            {awards.lock.bet && awards.lock.bet.bet_legs.length > 1 ? (
              <View className="mt-3 gap-1.5">
                {awards.lock.bet.bet_legs.map((leg, index) => (
                  <View
                    className="flex-row items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-arena-bg/35 px-2.5 py-2"
                    key={leg.id}>
                    <Text className="flex-1 text-[11px] font-semibold text-white/70" numberOfLines={1}>
                      {index + 1}. {formatBetLegLabel(leg, { betType: awards.lock?.bet?.bet_type })}
                    </Text>
                    <Text className={cn('text-[10px] font-black uppercase', getProfitTone(leg.result === 'win' ? 1 : leg.result === 'loss' ? -1 : 0))}>
                      {leg.result}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function FutureWeekAwardsCard({ weekNumber }: { weekNumber: number }) {
  return (
    <Card>
      <View className="items-center gap-3 py-4">
        <View className="h-12 w-12 items-center justify-center rounded-full border border-cyan-accent/35 bg-cyan-accent/10">
          <Ionicons color={THEME_COLORS.cyanAccent} name="time" size={20} />
        </View>
        <View className="items-center gap-1">
          <Text
            className="text-center text-lg font-black uppercase text-white"
            style={{ letterSpacing: -0.2 }}>
            Week {weekNumber} Awards Pending
          </Text>
          <Text className="text-center text-sm font-semibold leading-5 text-white/55">
            Top Performer, Cold Streak, and Pick of the Week will unlock after the week settles.
          </Text>
        </View>
      </View>
    </Card>
  );
}

function FutureWeekPreviewCard({
  hasMatchup,
  weekNumber,
}: {
  hasMatchup: boolean;
  weekNumber: number;
}) {
  return (
    <Card>
      <View className="items-center gap-3 py-4">
        <View className="h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
          <Ionicons color="rgba(255,255,255,0.62)" name={hasMatchup ? 'calendar' : 'git-branch'} size={20} />
        </View>
        <View className="items-center gap-1">
          <Text
            className="text-center text-lg font-black uppercase text-white"
            style={{ letterSpacing: -0.2 }}>
            {hasMatchup ? `Week ${weekNumber} Preview` : `Week ${weekNumber} Schedule Pending`}
          </Text>
          <Text className="text-center text-sm font-semibold leading-5 text-white/55">
            {hasMatchup
              ? 'This matchup is scheduled. Picks, scores, and awards will appear once the week opens.'
              : 'The matchup card will appear here once the league schedule is generated.'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function seasonAwardIcon(key: SeasonAward['award_key']): React.ComponentProps<typeof Ionicons>['name'] {
  if (key === 'season_mvp') return 'trophy';
  if (key === 'best_record') return 'medal';
  if (key === 'parlay_king') return 'link';
  if (key === 'most_consistent') return 'analytics';
  return 'flash';
}

function ChampionBanner({
  championName,
  cosmetics,
  seasonYear,
}: {
  championName: string;
  cosmetics?: EquippedCosmeticsByCategory;
  seasonYear: number;
}) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-gold bg-gold/[0.12]"
      style={{
        borderWidth: 2,
        shadowColor: THEME_COLORS.gold,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.55,
        shadowRadius: 22,
      }}>
      <View className="items-center gap-3 px-5 py-6">
        <TrophySkinIcon cosmetics={cosmetics} size={30} />
        <View className="items-center gap-1">
          <Text
            className="text-[10px] font-black uppercase text-gold"
            style={{ letterSpacing: 3 }}>
            {seasonYear} Champion
          </Text>
          <Text
            className="text-3xl font-black uppercase text-white"
            numberOfLines={1}
            style={{ letterSpacing: -0.4 }}>
            {championName}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MvpAwardCard({
  award,
  cosmetics,
  winnerName,
}: {
  award: SeasonAward;
  cosmetics?: EquippedCosmeticsByCategory;
  winnerName: string;
}) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-gold/65 bg-gold/[0.10]"
      style={{
        borderWidth: 2,
        shadowColor: THEME_COLORS.gold,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
      }}>
      <View className="flex-row items-center justify-center gap-1.5 border-b border-gold/40 bg-gold/15 px-3 py-1.5">
        <Ionicons color={THEME_COLORS.gold} name="ribbon" size={11} />
        <Text
          className="text-[10px] font-black uppercase text-gold"
          style={{ letterSpacing: 2 }}>
          Headline Honor
        </Text>
      </View>
      <View className="flex-row items-center gap-4 p-4">
        <TrophySkinIcon cosmetics={cosmetics} size={26} />
        <View className="flex-1 gap-1">
          <Text
            className="text-[11px] font-black uppercase text-gold"
            style={{ letterSpacing: 1.8 }}>
            {award.award_label}
          </Text>
          <Text
            className="text-xl font-black uppercase text-white"
            numberOfLines={1}
            style={{ letterSpacing: -0.4 }}>
            {winnerName}
          </Text>
          {award.value_label ? (
            <Text className="text-xs font-semibold text-white/65">{award.value_label}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function SeasonAwardCard({
  award,
  cosmetics,
  winnerName,
}: {
  award: SeasonAward;
  cosmetics?: EquippedCosmeticsByCategory;
  winnerName: string;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-gold/30 bg-gold/[0.06] p-3">
      {award.award_key === 'season_mvp' || award.award_key === 'best_record' ? (
        <TrophySkinIcon cosmetics={cosmetics} size={16} />
      ) : (
        <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gold/45 bg-gold/15">
          <Ionicons color={THEME_COLORS.gold} name={seasonAwardIcon(award.award_key)} size={16} />
        </View>
      )}
      <Text
        className="mt-2 text-[10px] font-black uppercase text-gold"
        style={{ letterSpacing: 1.5 }}
        numberOfLines={2}>
        {award.award_label}
      </Text>
      <Text
        className="mt-1 text-sm font-black text-white"
        numberOfLines={1}
        style={{ letterSpacing: -0.2 }}>
        {winnerName}
      </Text>
      {award.value_label ? (
        <Text className="mt-0.5 text-[11px] font-semibold text-white/55" numberOfLines={1}>
          {award.value_label}
        </Text>
      ) : null}
    </View>
  );
}

function SeasonAwardsCard({
  cosmeticsByUserId,
  detail,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
}) {
  if (detail.league.status !== 'complete' || !detail.seasonSnapshot) {
    return null;
  }

  const awards = seasonAwardsFromJson(detail.seasonSnapshot.awards);
  const championName = detail.seasonSnapshot.champion_user_id
    ? getDisplayName(detail, detail.seasonSnapshot.champion_user_id)
    : 'Champion pending';

  if (awards.length === 0 && !detail.seasonSnapshot.champion_user_id) {
    return null;
  }

  const mvpAward = awards.find((award) => award.award_key === 'season_mvp');
  const otherAwards = awards.filter((award) => award.award_key !== 'season_mvp');
  // Group remaining awards into pairs for a 2-up grid that scales nicely.
  const grid: SeasonAward[][] = [];
  for (let i = 0; i < otherAwards.length; i += 2) {
    grid.push(otherAwards.slice(i, i + 2));
  }

  return (
    <View className="gap-4">
      <View className="items-center gap-1">
        <View className="flex-row items-center gap-2">
          <Ionicons color={THEME_COLORS.gold} name="ribbon" size={13} />
          <Text
            className="text-[10px] font-black uppercase text-gold"
            style={{ letterSpacing: 2.5 }}>
            Season Trophy Case
          </Text>
          <Ionicons color={THEME_COLORS.gold} name="ribbon" size={13} />
        </View>
        <Text className="text-[11px] font-medium text-white/55">
          Final standings and awards for the {detail.league.season_year} season.
        </Text>
      </View>

      <ChampionBanner
        championName={championName}
        cosmetics={
          detail.seasonSnapshot.champion_user_id
            ? cosmeticsByUserId[detail.seasonSnapshot.champion_user_id]
            : undefined
        }
        seasonYear={detail.league.season_year}
      />

      {mvpAward ? (
        <MvpAwardCard
          award={mvpAward}
          cosmetics={mvpAward.user_id ? cosmeticsByUserId[mvpAward.user_id] : undefined}
          winnerName={mvpAward.user_id ? getDisplayName(detail, mvpAward.user_id) : 'No winner'}
        />
      ) : null}

      {grid.length > 0 ? (
        <View className="gap-2">
          {grid.map((row, rowIndex) => (
            <View className="flex-row gap-2" key={`row-${rowIndex}`}>
              {row.map((award) => (
                <SeasonAwardCard
                  award={award}
                  cosmetics={award.user_id ? cosmeticsByUserId[award.user_id] : undefined}
                  key={award.award_key}
                  winnerName={
                    award.user_id ? getDisplayName(detail, award.user_id) : 'No winner'
                  }
                />
              ))}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StandingsBoard({
  cosmeticsByUserId,
  detail,
  selectedWeekNumber,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  selectedWeekNumber: number;
  userId: string;
}) {
  const router = useRouter();
  const isH2H = detail.league.type === 'h2h';

  if (detail.standings.length === 0) {
    const isFutureWeek = selectedWeekNumber > detail.league.current_week;
    const isPastWeek = selectedWeekNumber < detail.league.current_week;

    return (
      <Card>
        <View className="items-center gap-3 py-4">
          <View className="h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
            <Ionicons color="rgba(255,255,255,0.62)" name="podium" size={20} />
          </View>
          <Text
            className="text-center text-lg font-black uppercase text-white"
            style={{ letterSpacing: -0.2 }}>
            {isFutureWeek
              ? `Week ${selectedWeekNumber} Standings Pending`
              : isPastWeek
                ? `No Week ${selectedWeekNumber} Snapshot`
                : 'Standings Coming Soon'}
          </Text>
          <Text className="text-center text-sm font-semibold leading-5 text-white/55">
            {isFutureWeek
              ? 'Cumulative standings will update here once that week is played.'
              : isPastWeek
                ? 'This league does not have a saved standings row for that completed week yet.'
                : 'Standings will appear once members are seeded.'}
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <View>
        <View className="flex-row items-center justify-between gap-3 px-5 pt-5">
          <Text
            className="text-[10px] font-black uppercase text-electric-green"
            style={{ letterSpacing: 2 }}>
            Standings Through Week {selectedWeekNumber}
          </Text>
          {selectedWeekNumber === detail.league.current_week ? (
            <Badge label="Live" tone="green" />
          ) : (
            <Badge label="Snapshot" tone="gold" />
          )}
        </View>
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-5">
          <Text
            className="w-12 text-[10px] font-black uppercase text-white/40"
            numberOfLines={1}
            style={{ letterSpacing: 1.2 }}>
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
            <PressableScale
              key={standing.id}
              accessibilityRole="button"
              onPress={() => {
                haptics.selection();
                router.push({
                  pathname: '/members/[memberId]',
                  params: { leagueId: detail.league.id, memberId: standing.user_id },
                });
              }}
              pressedScale={0.99}>
              <View
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
                  {standing.rank === 1 ? (
                    <TrophySkinIcon cosmetics={cosmeticsByUserId[standing.user_id]} size={15} />
                  ) : (
                    <Text className={cn('text-sm font-black', accent.text)}>{standing.rank}</Text>
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <CosmeticAvatar
                      cosmetics={cosmeticsByUserId[standing.user_id]}
                      name={getDisplayName(detail, standing.user_id)}
                      size="sm"
                    />
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
                <View className="flex-row items-center gap-2">
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
                  <Ionicons color="rgba(255,255,255,0.35)" name="chevron-forward" size={16} />
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Card>
  );
}

function ScheduleEmptyState({
  canStartSeason,
  detail,
  onStartSeason,
  startSeasonError,
  startingSeason,
  userId,
}: {
  canStartSeason: boolean;
  detail: LeagueDetail;
  onStartSeason: () => void;
  startSeasonError?: string;
  startingSeason: boolean;
  userId: string;
}) {
  const isCommissioner = detail.league.commissioner_id === userId;
  const memberCount = detail.members.length;
  const maxMembers = detail.league.max_members;
  const hasEnoughPlayers = memberCount >= 2;
  const isFull = memberCount >= maxMembers;

  if (canStartSeason) {
    return (
      <View className="gap-4">
        <View
          className="overflow-hidden rounded-3xl border border-electric-green/30 bg-electric-green/[0.06]"
          style={{
            shadowColor: THEME_COLORS.electricGreen,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
          }}>
          <View className="items-center gap-4 px-6 py-8">
            <View
              className="h-16 w-16 items-center justify-center rounded-full border border-electric-green/50 bg-electric-green/15"
              style={{
                shadowColor: THEME_COLORS.electricGreen,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 16,
              }}>
              <Ionicons color={THEME_COLORS.electricGreen} name="flag" size={28} />
            </View>
            <View className="items-center gap-2">
              <Text
                className="text-[10px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 2.5 }}>
                Commissioner
              </Text>
              <Text
                className="text-center text-2xl font-black uppercase text-white"
                style={{ letterSpacing: -0.4 }}>
                Ready to Kick Off?
              </Text>
              <Text className="px-2 text-center text-sm font-semibold leading-5 text-white/65">
                Drop the green flag with {memberCount} player{memberCount === 1 ? '' : 's'}, or wait until the
                roster fills to {maxMembers} for an automatic start.
              </Text>
            </View>
            <View className="w-full pt-2">
              <Button
                loading={startingSeason}
                title={startingSeason ? 'Building Schedule…' : 'Start Season'}
                onPress={onStartSeason}
              />
            </View>
            {startSeasonError ? (
              <View className="flex-row items-center gap-2 rounded-2xl border border-coral-red/40 bg-coral-red/10 px-3 py-2">
                <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={14} />
                <Text className="flex-1 text-xs font-semibold text-coral-red">
                  {startSeasonError}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <View className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-[10px] font-black uppercase text-white/55"
              style={{ letterSpacing: 1.8 }}>
              Roster
            </Text>
            <Text className="text-xs font-black text-white">
              {memberCount} / {maxMembers} joined
            </Text>
          </View>
          <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <View
              className="h-full rounded-full bg-electric-green"
              style={{ width: `${Math.min(100, (memberCount / maxMembers) * 100)}%` }}
            />
          </View>
        </View>
      </View>
    );
  }

  let title = 'Season Starts Soon';
  let body = 'Hang tight — the schedule will drop here as soon as it’s set.';
  let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'hourglass';

  if (startingSeason) {
    title = 'Building the Schedule…';
    body = 'Generating matchups for every week of the season.';
    iconName = 'cog';
  } else if (!hasEnoughPlayers) {
    title = 'Waiting on Players';
    body = isCommissioner
      ? 'You need at least 2 players to start. Share the invite code to bring more friends in.'
      : 'The league needs at least one more player before the season can begin.';
    iconName = 'people';
  } else if (isCommissioner) {
    title = 'Ready When You Are';
    body = 'Reload to refresh — your Start Season button will appear once the league is set.';
    iconName = 'flag';
  } else if (isFull) {
    title = 'Schedule Inbound';
    body = 'The roster is full. Building the season schedule now.';
    iconName = 'time';
  } else {
    title = 'Waiting on the Commissioner';
    body =
      'More players are joining, or the commissioner is getting ready to start the season. Sit tight.';
    iconName = 'hourglass';
  }

  return (
    <Card>
      <View className="items-center gap-4 py-4">
        <View className="h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
          <Ionicons color={THEME_COLORS.textPrimary} name={iconName} size={24} />
        </View>
        <View className="items-center gap-2">
          <Text
            className="text-center text-xl font-black uppercase text-white"
            style={{ letterSpacing: -0.3 }}>
            {title}
          </Text>
          <Text className="px-2 text-center text-sm font-semibold leading-5 text-white/60">
            {body}
          </Text>
        </View>
        <View className="mt-1 flex-row items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
          <Ionicons color="rgba(255,255,255,0.55)" name="people" size={11} />
          <Text
            className="text-[10px] font-black uppercase text-white/65"
            style={{ letterSpacing: 1.5 }}>
            {memberCount} / {maxMembers} players
          </Text>
        </View>
        {startSeasonError ? (
          <View className="mt-1 flex-row items-center gap-2 rounded-2xl border border-coral-red/40 bg-coral-red/10 px-3 py-2">
            <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={14} />
            <Text className="flex-1 text-xs font-semibold text-coral-red">
              {startSeasonError}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function ScheduleMatchupCard({
  cosmeticsByUserId,
  detail,
  isCurrentWeek,
  matchup,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  isCurrentWeek: boolean;
  matchup: WeeklyMatchupRow;
  userId: string;
}) {
  const router = useRouter();
  const involvesUser = matchup.home_user_id === userId || matchup.away_user_id === userId;
  const homeName = getDisplayName(detail, matchup.home_user_id);
  const awayName = getAwayDisplayName(detail, matchup);
  const homeIsUser = matchup.home_user_id === userId;
  const awayIsUser = matchup.away_user_id === userId;
  const homeIsWinner = !!matchup.winner_id && matchup.winner_id === matchup.home_user_id;
  const awayIsWinner = !!matchup.winner_id && matchup.winner_id === matchup.away_user_id;
  const isPlayed = matchup.home_profit !== null || matchup.away_profit !== null;
  const isBye = !matchup.away_user_id;

  return (
    <PressableScale
      onPress={() =>
        router.push({
          pathname: '/matchups/[matchupId]',
          params: { matchupId: matchup.id },
        })
      }>
      <Card tone={involvesUser ? 'highlight' : 'default'}>
        <View className="gap-3">
          {(involvesUser || isCurrentWeek) && !isBye ? (
            <View className="flex-row items-center justify-between">
              {involvesUser ? (
                <View className="flex-row items-center gap-1.5 rounded-full border border-electric-green/40 bg-electric-green/15 px-2 py-0.5">
                  <Ionicons color={THEME_COLORS.electricGreen} name="flash" size={10} />
                  <Text
                    className="text-[9px] font-black uppercase text-electric-green"
                    style={{ letterSpacing: 1.4 }}>
                    Your Matchup
                  </Text>
                </View>
              ) : (
                <View />
              )}
              {isCurrentWeek ? (
                <View className="flex-row items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-gold" />
                  <Text
                    className="text-[9px] font-black uppercase text-gold"
                    style={{ letterSpacing: 1.4 }}>
                    Live
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="flex-row items-center gap-3">
            <View className="flex-1 flex-row items-center gap-2.5">
              <CosmeticAvatar
                cosmetics={cosmeticsByUserId[matchup.home_user_id]}
                name={homeName}
                size="sm"
              />
              <View className="flex-1">
                <Text
                  className={cn(
                    'text-base font-black',
                    homeIsUser ? 'text-electric-green' : 'text-white',
                  )}
                  numberOfLines={1}
                  style={{ letterSpacing: -0.3 }}>
                  {homeName}
                </Text>
                {isPlayed ? (
                  <Text className={cn('text-xs font-black', getProfitTone(matchup.home_profit ?? 0))}>
                    {matchup.home_profit === null ? '–' : formatProfit(matchup.home_profit)}
                  </Text>
                ) : (
                  <Text className="text-[10px] font-semibold uppercase text-white/40" style={{ letterSpacing: 1.2 }}>
                    Home
                  </Text>
                )}
              </View>
              {homeIsWinner ? (
                <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={14} />
              ) : null}
            </View>

            <View className="h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
              <Text
                className="text-[10px] font-black uppercase text-white/65"
                style={{ letterSpacing: 1 }}>
                VS
              </Text>
            </View>

            <View className="flex-1 flex-row items-center justify-end gap-2.5">
              {awayIsWinner ? (
                <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={14} />
              ) : null}
              <View className="flex-1 items-end">
                <Text
                  className={cn(
                    'text-base font-black',
                    isBye
                      ? 'text-white/45'
                      : awayIsUser
                        ? 'text-electric-green'
                        : 'text-white',
                  )}
                  numberOfLines={1}
                  style={{ letterSpacing: -0.3 }}>
                  {awayName}
                </Text>
                {isBye ? (
                  <Text className="text-[10px] font-semibold uppercase text-white/40" style={{ letterSpacing: 1.2 }}>
                    Rest week
                  </Text>
                ) : isPlayed ? (
                  <Text className={cn('text-xs font-black', getProfitTone(matchup.away_profit ?? 0))}>
                    {matchup.away_profit === null ? '–' : formatProfit(matchup.away_profit)}
                  </Text>
                ) : (
                  <Text className="text-[10px] font-semibold uppercase text-white/40" style={{ letterSpacing: 1.2 }}>
                    Away
                  </Text>
                )}
              </View>
              {!isBye ? (
                <CosmeticAvatar
                  cosmetics={
                    matchup.away_user_id ? cosmeticsByUserId[matchup.away_user_id] : undefined
                  }
                  name={awayName}
                  size="sm"
                />
              ) : (
                <View className="h-9 w-9 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02]">
                  <Ionicons color="rgba(255,255,255,0.35)" name="moon" size={14} />
                </View>
              )}
            </View>
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

function getScheduleWeekMeta(weekNumber: number) {
  const isPlayoff = weekNumber > 14;
  const isChampionship = weekNumber === 17;
  const sectionLabel = isChampionship
    ? 'Championship'
    : isPlayoff
      ? `Playoff Round ${weekNumber - 14}`
      : 'Regular Season';

  const accentColor = isChampionship
    ? THEME_COLORS.gold
    : isPlayoff
      ? THEME_COLORS.cyanAccent
      : THEME_COLORS.electricGreen;

  return {
    accentColor,
    isChampionship,
    isPlayoff,
    sectionLabel,
  };
}

function ScheduleWeekHeader({
  isCurrentWeek,
  weekNumber,
}: {
  isCurrentWeek: boolean;
  weekNumber: number;
}) {
  const { accentColor, isChampionship, isPlayoff, sectionLabel } =
    getScheduleWeekMeta(weekNumber);

  return (
    <View
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: isCurrentWeek ? `${accentColor}14` : 'rgba(255,255,255,0.03)',
        borderColor: isCurrentWeek ? `${accentColor}66` : 'rgba(255,255,255,0.08)',
        shadowColor: isCurrentWeek ? accentColor : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isCurrentWeek ? 0.4 : 0,
        shadowRadius: isCurrentWeek ? 14 : 0,
      }}>
      <View
        className="flex-row items-center justify-between px-4 py-3"
        style={{
          borderLeftColor: accentColor,
          borderLeftWidth: 3,
        }}>
        <View className="flex-row items-center gap-3">
          <View
            className="h-8 w-8 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${accentColor}26`,
              borderColor: `${accentColor}66`,
              borderWidth: 1,
            }}>
            <Text
              className="text-[11px] font-black"
              style={{ color: accentColor, letterSpacing: -0.2 }}>
              {weekNumber}
            </Text>
          </View>
          <View>
            <Text
              className="text-[9px] font-black uppercase"
              style={{ color: accentColor, letterSpacing: 2 }}>
              {sectionLabel}
            </Text>
            <Text
              className="text-base font-black uppercase text-white"
              style={{ letterSpacing: -0.3 }}>
              Week {weekNumber}
            </Text>
          </View>
        </View>
        {isCurrentWeek ? (
          <View
            className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{
              backgroundColor: `${accentColor}26`,
              borderColor: `${accentColor}66`,
              borderWidth: 1,
            }}>
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <Text
              className="text-[9px] font-black uppercase"
              style={{ color: accentColor, letterSpacing: 1.4 }}>
              This Week
            </Text>
          </View>
        ) : isChampionship ? (
          <Badge label="Title Game" tone="gold" />
        ) : isPlayoff ? (
          <Badge label="Playoffs" tone="cyan" />
        ) : null}
      </View>
    </View>
  );
}

function PlayoffPlaceholderCard({ weekNumber }: { weekNumber: PlayoffPlaceholderWeek }) {
  const description =
    weekNumber === 17
      ? 'TBD - Based on Week 16 results'
      : 'TBD - Based on regular season standings';

  return (
    <Card>
      <View className="items-center gap-3 py-3">
        <View className="h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
          <Ionicons color="rgba(255,255,255,0.65)" name="git-branch" size={18} />
        </View>
        <View className="items-center gap-1">
          <Text
            className="text-lg font-black uppercase text-white"
            style={{ letterSpacing: -0.3 }}>
            Matchup TBD
          </Text>
          <Text className="text-center text-sm font-semibold text-white/55">
            {description}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function ScheduleList({
  canStartSeason,
  cosmeticsByUserId,
  detail,
  onStartSeason,
  startSeasonError,
  startingSeason,
  userId,
}: {
  canStartSeason: boolean;
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  onStartSeason: () => void;
  startSeasonError?: string;
  startingSeason: boolean;
  userId: string;
}) {
  const matchupsByWeek = useMemo(() => {
    const grouped = detail.matchups.reduce<Record<number, WeeklyMatchupRow[]>>(
      (accumulator, matchup) => {
        accumulator[matchup.week_number] = accumulator[matchup.week_number] ?? [];
        accumulator[matchup.week_number].push(matchup);
        return accumulator;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([weekNumber, matchups]) => ({
        matchups,
        weekNumber: Number(weekNumber),
      }))
      .sort((left, right) => left.weekNumber - right.weekNumber);
  }, [detail.matchups]);

  if (detail.matchups.length === 0) {
    return (
      <ScheduleEmptyState
        canStartSeason={canStartSeason}
        detail={detail}
        onStartSeason={onStartSeason}
        startSeasonError={startSeasonError}
        startingSeason={startingSeason}
        userId={userId}
      />
    );
  }

  const currentWeek = detail.league.current_week;
  const placeholderWeeks = PLAYOFF_PLACEHOLDER_WEEKS.filter(
    (weekNumber) => !matchupsByWeek.some((week) => week.weekNumber === weekNumber),
  );

  return (
    <View className="gap-5">
      {matchupsByWeek.map(({ matchups, weekNumber }) => {
        const isCurrentWeek = weekNumber === currentWeek;

        return (
          <View className="gap-3" key={weekNumber}>
            <ScheduleWeekHeader isCurrentWeek={isCurrentWeek} weekNumber={weekNumber} />

            <View className="gap-2.5">
              {matchups.map((matchup) => (
                <ScheduleMatchupCard
                  cosmeticsByUserId={cosmeticsByUserId}
                  detail={detail}
                  isCurrentWeek={isCurrentWeek}
                  key={matchup.id}
                  matchup={matchup}
                  userId={userId}
                />
              ))}
            </View>
          </View>
        );
      })}
      {placeholderWeeks.map((weekNumber) => (
        <View className="gap-3" key={`playoff-placeholder-${weekNumber}`}>
          <ScheduleWeekHeader
            isCurrentWeek={weekNumber === currentWeek}
            weekNumber={weekNumber}
          />
          <PlayoffPlaceholderCard weekNumber={weekNumber} />
        </View>
      ))}
    </View>
  );
}

function MembersList({
  cosmeticsByUserId,
  detail,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
}) {
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
                <CosmeticAvatar
                  cosmetics={cosmeticsByUserId[member.user_id]}
                  name={memberName}
                  size="md"
                />
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

function SharedBetCard({
  cosmetics,
  metadata,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  metadata: SharedBetMetadata;
}) {
  const accent = betTypeAccent(metadata.betType);
  const isLock = metadata.isLock === true;

  return (
    <PressableScale>
      <LockEffect cosmetics={cosmetics} compact>
        <View
          className={cn(
            'mt-2 rounded-2xl border bg-arena-bg/50 p-3',
            isLock ? 'bg-gold/[0.07]' : null,
          )}
          style={{
            borderColor: isLock ? THEME_COLORS.gold : `${accent}55`,
            shadowColor: isLock ? THEME_COLORS.gold : accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isLock ? 0.3 : 0,
            shadowRadius: isLock ? 10 : 0,
          }}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <Badge betType={metadata.betType} />
            {isLock ? (
              <View className="flex-row items-center gap-1 rounded-full border border-gold/55 bg-gold/15 px-2 py-0.5">
                <Ionicons color={THEME_COLORS.gold} name="star" size={10} />
                <Text className="text-[9px] font-black uppercase text-gold" style={{ letterSpacing: 1 }}>
                  Pick of the Week 1.5x
                </Text>
              </View>
            ) : null}
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
          {metadata.legs.map((leg, index) => {
            if (!isBetMarket(leg.market)) {
              return null;
            }

            const labelLeg = {
              adjusted_line: leg.adjustedLine,
              market: leg.market,
              original_line: leg.originalLine,
              selection: leg.selection,
            } as const;

            return (
              <View key={`${leg.selection}-${index}`} className="flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-2">
                  {leg.market !== 'over_under' ? (
                    <NflTeamLogo size={20} teamName={getPickLogoLabel(labelLeg)} />
                  ) : null}
                  <Text className="flex-1 text-xs font-semibold text-white/75" numberOfLines={1}>
                    {formatBetLegLabel(labelLeg, { betType: metadata.betType })}
                  </Text>
                </View>
                <Text className="text-[10px] font-black uppercase text-white/45">
                  {formatAmericanOdds(leg.odds)}
                </Text>
              </View>
            );
          })}
        </View>

        <View className="mt-3 flex-row items-center justify-between border-t border-white/[0.08] pt-3">
          <Text
            className="text-[10px] font-black uppercase text-white/45"
            style={{ letterSpacing: 1.4 }}>
            {formatCurrency(metadata.amount)} played
          </Text>
          <Text className="text-xs font-black text-electric-green">
            Reward {formatCurrency(metadata.potentialReward)}
          </Text>
        </View>
        </View>
      </LockEffect>
    </PressableScale>
  );
}

function ChatBubble({
  cosmetics,
  isMine,
  message,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  isMine: boolean;
  message: LeagueChatMessage;
}) {
  const isSystem = message.message_type === 'system';
  const isBetShare = message.message_type === 'bet_share';
  const isSticker = message.message_type === 'sticker';
  const displayName = message.user?.display_name ?? (isSystem ? 'Action Arena' : 'Player');
  const metadata = isSharedBetMetadata(message.metadata) ? message.metadata : null;
  const stickerMetadata = isStickerMetadata(message.metadata) ? message.metadata : null;

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
        <CosmeticAvatar cosmetics={cosmetics} name={displayName} size="sm" />
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
        {isSticker && stickerMetadata ? (
          <View className="items-center gap-2 py-1">
            <ChatStickerPreview itemId={stickerMetadata.stickerId} />
            <Text className="text-xs font-black uppercase text-white/70">
              {stickerMetadata.stickerName}
            </Text>
          </View>
        ) : (
          <Text
            className={cn(
              'text-sm font-semibold leading-5',
              isMine ? 'text-white' : 'text-white/85',
            )}
            style={{ letterSpacing: -0.1 }}>
            {message.body}
          </Text>
        )}
        {isBetShare && metadata ? <SharedBetCard cosmetics={cosmetics} metadata={metadata} /> : null}
        <Text
          className={cn(
            'mt-1.5 text-[10px] font-semibold',
            isMine ? 'text-electric-green/60 self-end' : 'text-white/40',
          )}>
          {getShortTime(message.created_at)}
        </Text>
      </View>
      {isMine ? (
        <CosmeticAvatar cosmetics={cosmetics} name={displayName} size="sm" />
      ) : null}
    </View>
  );
}

function LeagueChat({
  cosmeticsByUserId,
  detail,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
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
  const sendSticker = useSendLeagueChatSticker(detail.league.id, userId);
  const userCosmetics = useUserCosmetics(userId);
  const messages = chatQuery.data ?? [];
  const canSend = draft.trim().length > 0 && !sendMessage.isPending;
  const stickerRows = (userCosmetics.data?.rows ?? []).filter(
    (row) => row.category === 'chat_sticker_pack',
  );

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

  const submitSticker = async (itemId: string) => {
    const item = getCosmeticItem(itemId);
    if (!item) return;

    haptics.light();
    try {
      await sendSticker.mutateAsync({
        stickerId: item.id,
        stickerName: item.name,
      });
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
                cosmetics={message.user_id ? cosmeticsByUserId[message.user_id] : undefined}
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
            {stickerRows.length > 0 ? (
              <ScrollView
                className="mb-2"
                contentContainerStyle={{ gap: 8 }}
                horizontal
                showsHorizontalScrollIndicator={false}>
                {stickerRows.map((row) => {
                  const item = getCosmeticItem(row.item_id);
                  if (!item) return null;
                  return (
                    <PressableScale
                      accessibilityRole="button"
                      key={row.id}
                      onPress={() => {
                        void submitSticker(row.item_id);
                      }}>
                      <View className="items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        <ChatStickerPreview itemId={row.item_id} size="sm" />
                        <Text className="max-w-[72px] text-center text-[9px] font-black uppercase text-white/55" numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            ) : null}
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

function TabSwitcher({
  activeTab,
  onChange,
}: {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
}) {
  const { width } = useWindowDimensions();
  const tabBarWidth = Math.max(0, width - SCREEN_HORIZONTAL_PADDING);
  const tabWidth = tabBarWidth / TABS.length;
  const labelWidth = Math.max(0, tabWidth - DETAIL_TAB_HORIZONTAL_GAP * 2);

  return (
    <View
      style={{
        alignSelf: 'center',
        borderBottomColor: 'rgba(255,255,255,0.08)',
        borderBottomWidth: 1,
        width: tabBarWidth,
      }}>
      <View
        style={{
          flexDirection: 'row',
          height: DETAIL_TAB_HEIGHT,
          width: tabBarWidth,
        }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isLastTab = tab.key === TABS[TABS.length - 1]?.key;
          const underlineWidth = Math.min(
            labelWidth,
            Math.max(28, tab.label.length * 6.4),
          );
          const underlineLeft = (tabWidth - underlineWidth) / 2;

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              hitSlop={8}
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={({ pressed }) => ({
                alignItems: 'center',
                height: DETAIL_TAB_HEIGHT,
                justifyContent: 'center',
                opacity: pressed ? 0.68 : 1,
                overflow: 'hidden',
                paddingHorizontal: DETAIL_TAB_HORIZONTAL_GAP,
                position: 'relative',
                width: tabWidth,
              })}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.68}
                style={{
                  color: isActive ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.55)',
                  fontSize: 9,
                  fontWeight: '900',
                  letterSpacing: 0,
                  maxWidth: labelWidth,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  width: labelWidth,
                }}>
                {tab.label}
              </Text>
              <View
                style={
                  isActive
                    ? {
                        backgroundColor: THEME_COLORS.electricGreen,
                        borderRadius: DETAIL_TAB_UNDERLINE_HEIGHT,
                        bottom: 0,
                        height: DETAIL_TAB_UNDERLINE_HEIGHT,
                        left: underlineLeft,
                        position: 'absolute',
                        shadowColor: THEME_COLORS.electricGreen,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.55,
                        shadowRadius: 8,
                        width: underlineWidth,
                      }
                    : {
                        backgroundColor: 'transparent',
                        bottom: 0,
                        height: DETAIL_TAB_UNDERLINE_HEIGHT,
                        left: underlineLeft,
                        position: 'absolute',
                        width: underlineWidth,
                      }
                }
              />
              {!isLastTab ? (
                <View
                  pointerEvents="none"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    height: 18,
                    position: 'absolute',
                    right: 0,
                    width: 1,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabContent({
  canStartSeason,
  cosmeticsByUserId,
  detail,
  onStartSeason,
  selectedWeekNumber,
  startSeasonError,
  startingSeason,
  tab,
  userId,
}: {
  canStartSeason: boolean;
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  onStartSeason: () => void;
  selectedWeekNumber: number;
  startSeasonError?: string;
  startingSeason: boolean;
  tab: DetailTab;
  userId: string;
}) {
  return (
    <View key={tab}>
      {tab === 'standings' ? (
        <StandingsBoard
          cosmeticsByUserId={cosmeticsByUserId}
          detail={detail}
          selectedWeekNumber={selectedWeekNumber}
          userId={userId}
        />
      ) : null}
      {tab === 'schedule' ? (
        <ScheduleList
          canStartSeason={canStartSeason}
          cosmeticsByUserId={cosmeticsByUserId}
          detail={detail}
          onStartSeason={onStartSeason}
          startSeasonError={startSeasonError}
          startingSeason={startingSeason}
          userId={userId}
        />
      ) : null}
      {tab === 'members' ? (
        <MembersList cosmeticsByUserId={cosmeticsByUserId} detail={detail} />
      ) : null}
      {tab === 'chat' ? (
        <LeagueChat cosmeticsByUserId={cosmeticsByUserId} detail={detail} userId={userId} />
      ) : null}
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
  const generateSchedule = useGenerateScheduleMutation(user?.id);
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>();
  const selectedWeekNumber = selectedWeek ?? detailQuery.data?.league.current_week ?? 1;
  const selectedWeekAwardsNumber =
    detailQuery.data && selectedWeekNumber <= detailQuery.data.league.current_week
      ? selectedWeekNumber
      : undefined;
  const awardsQuery = useWeeklyAwards(resolvedLeagueId, selectedWeekAwardsNumber);
  const detailRefetchRef = useRef(detailQuery.refetch);
  const awardsRefetchRef = useRef(awardsQuery.refetch);
  const fullLeagueFallbackAttempts = useRef<Set<string>>(new Set());
  const selectedWeekLeagueRef = useRef<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<DetailTab>('standings');
  const cosmeticUserIds = useMemo(
    () =>
      detailQuery.data
        ? [
            detailQuery.data.league.commissioner_id,
            ...detailQuery.data.members.map((member) => member.user_id),
            ...(detailQuery.data.seasonSnapshot?.champion_user_id
              ? [detailQuery.data.seasonSnapshot.champion_user_id]
              : []),
          ]
        : [],
    [detailQuery.data],
  );
  const cosmeticsQuery = useEquippedCosmeticsForUsers(cosmeticUserIds);

  useEffect(() => {
    if (resolvedInitialTab === 'chat') {
      setActiveTab('chat');
    }
  }, [resolvedInitialTab]);

  useEffect(() => {
    const league = detailQuery.data?.league;

    if (!league) {
      return;
    }

    if (selectedWeekLeagueRef.current !== league.id) {
      selectedWeekLeagueRef.current = league.id;
      setSelectedWeek(league.current_week);
      return;
    }

    setSelectedWeek((existingWeek) => existingWeek ?? league.current_week);
  }, [detailQuery.data?.league.current_week, detailQuery.data?.league.id]);

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

  useEffect(() => {
    const detail = detailQuery.data;

    if (!detail || activeTab !== 'schedule') {
      return;
    }

    const shouldGenerateFullLeagueSchedule =
      detail.league.type === 'h2h' &&
      detail.members.length >= detail.league.max_members &&
      detail.matchups.length === 0 &&
      !generateSchedule.isPending &&
      !fullLeagueFallbackAttempts.current.has(detail.league.id);

    if (!shouldGenerateFullLeagueSchedule) {
      return;
    }

    fullLeagueFallbackAttempts.current.add(detail.league.id);
    generateSchedule.mutate(detail.league.id);
  }, [activeTab, detailQuery.data, generateSchedule]);

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
  const selectedStandings = getStandingsForWeek(detail, selectedWeekNumber);
  const selectedDetail: LeagueDetail = {
    ...detail,
    currentUserMatchup: getUserMatchupForWeek(detail, userId, selectedWeekNumber),
    standings: selectedStandings,
  };
  const currentUserMatchup = selectedDetail.currentUserMatchup;
  const cosmeticsByUserId = cosmeticsQuery.data ?? {};
  const isCurrentWeek = selectedWeekNumber === detail.league.current_week;
  const isPastWeek = selectedWeekNumber < detail.league.current_week;
  const isFutureWeek = selectedWeekNumber > detail.league.current_week;
  const seasonFirstKickoffTime = detail.seasonFirstKickoffAt
    ? new Date(detail.seasonFirstKickoffAt).getTime()
    : null;
  const seasonInProgress =
    seasonFirstKickoffTime !== null &&
    !Number.isNaN(seasonFirstKickoffTime) &&
    Date.now() >= seasonFirstKickoffTime;
  const canStartSeason =
    detail.league.type === 'h2h' &&
    detail.league.commissioner_id === userId &&
    detail.members.length >= 2 &&
    ['drafting', 'active'].includes(detail.league.status) &&
    detail.matchups.length === 0;
  const handleStartSeason = () => {
    generateSchedule.mutate(detail.league.id);
  };

  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 18, padding: 20, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={detailQuery.isRefetching || awardsQuery.isRefetching}
            onRefresh={() => {
              void detailQuery.refetch();
              void awardsQuery.refetch();
            }}
          />
        }
        showsVerticalScrollIndicator={false}>
        <HeroHeader detail={detail} />
        <View className="items-end">
          <WeekNavigator
            maxWeek={REGULAR_SEASON_WEEKS}
            onChange={(week) => {
              haptics.selection();
              setSelectedWeek(week);
            }}
            week={selectedWeekNumber}
          />
        </View>
        <InviteCodeCard detail={detail} seasonInProgress={seasonInProgress} />

        <SeasonAwardsCard cosmeticsByUserId={cosmeticsByUserId} detail={detail} />
        {isFutureWeek ? (
          <FutureWeekAwardsCard weekNumber={selectedWeekNumber} />
        ) : awardsQuery.data ? (
          <WeeklyAwardsCard
            awards={awardsQuery.data}
            weekNumber={selectedWeekNumber}
          />
        ) : null}

        {detail.league.type === 'h2h' && currentUserMatchup ? (
          <PressableScale
            onPress={() =>
              router.push({
                pathname: '/matchups/[matchupId]',
                params: { matchupId: currentUserMatchup.id },
              })
            }>
            <FightCard
              cosmeticsByUserId={cosmeticsByUserId}
              detail={selectedDetail}
              matchup={currentUserMatchup}
              weekNumber={selectedWeekNumber}
              weekStatus={isCurrentWeek ? 'current' : isPastWeek ? 'past' : 'future'}
              userId={userId}
            />
          </PressableScale>
        ) : isFutureWeek ? (
          <FutureWeekPreviewCard hasMatchup={false} weekNumber={selectedWeekNumber} />
        ) : null}

        <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />
        <TabContent
          canStartSeason={canStartSeason}
          cosmeticsByUserId={cosmeticsByUserId}
          detail={selectedDetail}
          onStartSeason={handleStartSeason}
          selectedWeekNumber={selectedWeekNumber}
          startSeasonError={generateSchedule.error?.message}
          startingSeason={generateSchedule.isPending}
          tab={activeTab}
          userId={userId}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
