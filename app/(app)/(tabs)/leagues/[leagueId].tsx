import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
  ChatStickerPreview,
  CosmeticAvatar,
  LockEffect,
  TrophySkinIcon,
} from '@/components/cosmetics';
import {
  Badge,
  Button,
  Card,
  ModalShell,
  NflTeamLogo,
  PressableScale,
  SkeletonLoader,
  TextInput as AppTextInput,
  WeekNavigator,
} from '@/components/ui';
import { getCosmeticItem } from '@/constants/cosmetics';
import { haptics } from '@/lib/haptics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlockUserMutation, useReportContentMutation } from '@/hooks/use-content-moderation';
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
  useUpdateLeagueTeamNameMutation,
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
import {
  getLeagueMemberPrimaryName,
  getLeagueMemberSecondaryName,
  TEAM_NAME_MAX_LENGTH,
} from '@/lib/league-member-display';
import type {
  BetMarket,
  BetType,
  ChampionshipSummary,
  EquippedCosmeticsByCategory,
  Json,
  LeagueMemberRow,
  LeagueVisibility,
  SeasonAward,
  StandingRow,
  WeeklyMatchupRow,
} from '@/types/database';

type DetailTab = 'standings' | 'schedule' | 'members' | 'chat';
type PlayoffPlaceholderWeek = 15 | 16 | 17;
type PlayoffStatus = 'clinched' | 'eliminated' | null;
type WeekViewStatus = 'current' | 'future' | 'past';
type StandingsSnapshot = {
  standings: StandingRow[];
  weekNumber: number | null;
};

const TAB_INDICATOR_HEIGHT = 3;
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

function getMember(detail: LeagueDetail, userId: string) {
  return detail.members.find((member) => member.user_id === userId) ?? null;
}

function getDisplayName(detail: LeagueDetail, userId: string, fallback = 'Unknown Player') {
  return getLeagueMemberPrimaryName(getMember(detail, userId), detail.profilesById[userId], fallback);
}

function getSecondaryDisplayName(detail: LeagueDetail, userId: string) {
  return getLeagueMemberSecondaryName(getMember(detail, userId), detail.profilesById[userId]);
}

function getAwayDisplayName(detail: LeagueDetail, matchup: WeeklyMatchupRow) {
  return matchup.away_user_id ? getDisplayName(detail, matchup.away_user_id) : 'Bye Week';
}

function getStandingsSnapshotForWeek(detail: LeagueDetail, weekNumber: number): StandingsSnapshot {
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
    return { standings: [], weekNumber: null };
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

function isBetType(value: string): value is BetType {
  return value === 'straight' || value === 'parlay' || value === 'teaser';
}

function isSeasonAwardBetLeg(value: Json) {
  if (!isRecord(value)) {
    return false;
  }

  const leg = value as Record<string, Json | undefined>;

  return (
    typeof leg.game_id === 'string' &&
    typeof leg.market === 'string' &&
    isBetMarket(leg.market) &&
    typeof leg.selection === 'string' &&
    (typeof leg.original_line === 'number' || leg.original_line === null) &&
    (typeof leg.adjusted_line === 'number' || leg.adjusted_line === null) &&
    typeof leg.leg_odds === 'number'
  );
}

function isSeasonAwardBet(value: Json) {
  if (!isRecord(value)) {
    return false;
  }

  const bet = value as Record<string, Json | undefined>;

  return (
    typeof bet.id === 'string' &&
    typeof bet.week_number === 'number' &&
    typeof bet.bet_type === 'string' &&
    isBetType(bet.bet_type) &&
    typeof bet.amount === 'number' &&
    typeof bet.odds === 'number' &&
    typeof bet.potential_payout === 'number' &&
    (typeof bet.profit === 'number' || bet.profit === null) &&
    typeof bet.is_lock === 'boolean' &&
    Array.isArray(bet.legs) &&
    bet.legs.every(isSeasonAwardBetLeg)
  );
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

  const award = value as Record<string, Json | undefined>;

  return (
    typeof award.award_key === 'string' &&
    typeof award.award_label === 'string' &&
    (typeof award.user_id === 'string' || award.user_id === null) &&
    (typeof award.metric === 'number' || award.metric === null) &&
    (typeof award.value_label === 'string' || award.value_label === null) &&
    (award.bet_id === undefined || typeof award.bet_id === 'string') &&
    (award.is_lock === undefined || typeof award.is_lock === 'boolean') &&
    (award.bet === undefined || award.bet === null || isSeasonAwardBet(award.bet))
  );
}

function seasonAwardsFromJson(value: Json): SeasonAward[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isSeasonAward);
}

function championshipSummaryFromJson(value: Json | null): ChampionshipSummary | null {
  if (!value || !isRecord(value)) {
    return null;
  }

  const record = value as Record<string, Json | undefined>;
  if (
    typeof record.week_number !== 'number' ||
    typeof record.champion_user_id !== 'string'
  ) {
    return null;
  }

  return {
    champion_profit:
      typeof record.champion_profit === 'number' ? record.champion_profit : null,
    champion_user_id: record.champion_user_id,
    opponent_profit:
      typeof record.opponent_profit === 'number' ? record.opponent_profit : null,
    opponent_user_id:
      typeof record.opponent_user_id === 'string' ? record.opponent_user_id : null,
    week_number: record.week_number,
  };
}

type ChampionRecord = {
  losses: number;
  total_profit: number;
  ties: number;
  wins: number;
};

function findChampionRecord(
  standings: Json,
  championUserId: string | null,
): ChampionRecord | null {
  if (!championUserId || !Array.isArray(standings)) {
    return null;
  }

  for (const entry of standings) {
    if (!isRecord(entry)) continue;
    const row = entry as Record<string, Json | undefined>;
    if (row.user_id !== championUserId) continue;
    if (
      typeof row.wins !== 'number' ||
      typeof row.losses !== 'number' ||
      typeof row.ties !== 'number' ||
      typeof row.total_profit !== 'number'
    ) {
      return null;
    }
    return {
      losses: row.losses,
      total_profit: row.total_profit,
      ties: row.ties,
      wins: row.wins,
    };
  }

  return null;
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
    return { bg: 'bg-silver/20', ring: 'border-silver/60', text: 'text-silver-text' };
  }
  if (rank === 3) {
    return { bg: 'bg-bronze/20', ring: 'border-bronze/60', text: 'text-bronze-text' };
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

function DetailBackButton() {
  const router = useRouter();
  const goBack = () => {
    haptics.selection();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/leagues');
  };

  return (
    <PressableScale
      accessibilityLabel="Go back"
      accessibilityRole="button"
      onPress={goBack}
      pressedScale={0.94}>
      <View className="h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.05]">
        <Ionicons color={THEME_COLORS.electricGreen} name="chevron-back" size={20} />
      </View>
    </PressableScale>
  );
}

function DetailSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <View className="gap-5 px-5 py-6">
        <DetailBackButton />
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
  weekStatus: WeekViewStatus;
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
            <View className="w-full items-center gap-1">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Home
              </Text>
              <Text
                className="w-full text-center text-base font-black text-white"
                numberOfLines={2}
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

          <View className="shrink-0 items-center px-2">
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
            <View className="w-full items-center gap-1">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Away
              </Text>
              <Text
                className="w-full text-center text-base font-black text-white"
                numberOfLines={2}
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

function YourTeamCard({
  detail,
  onEdit,
  userId,
}: {
  detail: LeagueDetail;
  onEdit: (member: LeagueMemberRow) => void;
  userId: string;
}) {
  const member = getMember(detail, userId);

  if (!member) {
    return null;
  }

  const teamName = getDisplayName(detail, userId, 'Your Team');
  const secondaryName = getSecondaryDisplayName(detail, userId);

  return (
    <Card>
      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-electric-green/35 bg-electric-green/12">
              <Ionicons color={THEME_COLORS.electricGreen} name="shield-checkmark" size={20} />
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="text-[10px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 2 }}>
                Your Team
              </Text>
              <Text
                className="mt-1 text-lg font-black text-white"
                numberOfLines={1}
                style={{ letterSpacing: -0.3 }}>
                {teamName}
              </Text>
              {secondaryName ? (
                <Text className="mt-0.5 text-xs font-semibold text-white/45" numberOfLines={1}>
                  {secondaryName}
                </Text>
              ) : null}
            </View>
          </View>
          <View className="shrink-0">
            <Button
              fullWidth={false}
              icon="pencil"
              onPress={() => {
                haptics.selection();
                onEdit(member);
              }}
              title="Edit"
              variant="secondary"
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

function TeamNameEditorModal({
  draftName,
  error,
  isSaving,
  onCancel,
  onChange,
  onSave,
  visible,
}: {
  draftName: string;
  error?: string;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <ModalShell variant="overlay">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center bg-black/80 px-5">
          <Card>
            <View className="gap-5">
              <View className="items-center gap-2">
                <View
                  className="h-14 w-14 items-center justify-center rounded-full border border-electric-green/40 bg-electric-green/15"
                  style={{
                    shadowColor: THEME_COLORS.electricGreen,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.55,
                    shadowRadius: 16,
                  }}>
                  <Ionicons color={THEME_COLORS.electricGreen} name="shield-checkmark" size={22} />
                </View>
                <Text
                  className="text-[10px] font-black uppercase text-electric-green"
                  style={{ letterSpacing: 3 }}>
                  Team Identity
                </Text>
                <Text
                  className="text-center text-2xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.4 }}>
                  Edit Team Name
                </Text>
                <Text className="px-2 text-center text-sm font-semibold text-white/55">
                  This name is only for this league. Other leagues can use a different team name.
                </Text>
              </View>

              <View className="gap-2">
                <AppTextInput
                  autoCapitalize="words"
                  error={error}
                  label="Team name"
                  maxLength={TEAM_NAME_MAX_LENGTH}
                  onChangeText={onChange}
                  onSubmitEditing={onSave}
                  returnKeyType="done"
                  value={draftName}
                />
                <Text className="text-right text-[11px] font-semibold text-white/45">
                  {draftName.trim().length}/{TEAM_NAME_MAX_LENGTH}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button
                    disabled={isSaving}
                    onPress={onCancel}
                    title="Cancel"
                    variant="secondary"
                  />
                </View>
                <View className="flex-1">
                  <Button loading={isSaving} onPress={onSave} title="Save" />
                </View>
              </View>
            </View>
          </Card>
        </KeyboardAvoidingView>
      </ModalShell>
    </Modal>
  );
}

function AwardCard({
  award,
  variant = 'top',
}: {
  award: WeeklyAward;
  variant?: 'top' | 'cold';
}) {
  const tiedUsers = award.displayNames.length > 1;
  const displayName = tiedUsers
    ? award.displayNames.length <= 2
      ? award.displayNames.join(' + ')
      : `${award.displayNames.length} tied`
    : award.displayName;
  const isCold = variant === 'cold';

  return (
    <View
      className={cn(
        'flex-1 rounded-2xl border p-3',
        isCold ? 'border-coral-red/35 bg-coral-red/[0.07]' : 'border-gold/25 bg-gold/[0.06]',
      )}>
      <Text
        className={cn(
          'text-[10px] font-black uppercase',
          isCold ? 'text-coral-red' : 'text-gold',
        )}
        style={{ letterSpacing: 1.4 }}>
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
          {row.displayName}
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

  const noActivity = !awards.hasBets && !awards.isFullySettled && !awards.lock;
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
            {inProgress ? `Week ${weekNumber} Pick Tracker` : `Week ${weekNumber} Awards`}
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
            {awards.sharpest ? <AwardCard award={awards.sharpest} variant="top" /> : null}
            {awards.coldStreak ? <AwardCard award={awards.coldStreak} variant="cold" /> : null}
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
              {awards.lock.displayName} · {getPickSummary(awards.lock.bet)}
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

function MatchupPlaceholderCard({
  hasWeekSchedule,
  weekNumber,
  weekStatus,
}: {
  hasWeekSchedule?: boolean;
  weekNumber: number;
  weekStatus: WeekViewStatus;
}) {
  const isFutureWeek = weekStatus === 'future';
  const isPastWeek = weekStatus === 'past';
  const isByeWeek = Boolean(hasWeekSchedule) && !isFutureWeek;
  const title = isByeWeek
    ? `Week ${weekNumber} Bye`
    : isFutureWeek
    ? `Week ${weekNumber} Schedule Pending`
    : isPastWeek
      ? `Week ${weekNumber} Matchup Missing`
      : `No Week ${weekNumber} Matchup Assigned`;
  const description = isByeWeek
    ? 'No head-to-head game is assigned for your team this week. Your league schedule is still intact.'
    : isFutureWeek
    ? 'The matchup card will appear here once the league schedule is generated.'
    : isPastWeek
      ? 'No head-to-head matchup was saved for your team in this week.'
      : 'Your matchup card will appear here once this week is scheduled.';

  return (
    <Card>
      <View className="items-center gap-3 py-4">
        <View className="h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
          <Ionicons color="rgba(255,255,255,0.62)" name="git-branch" size={20} />
        </View>
        <View className="items-center gap-1">
          <Text
            className="text-center text-lg font-black uppercase text-white"
            style={{ letterSpacing: -0.2 }}>
            {title}
          </Text>
          <Text className="text-center text-sm font-semibold leading-5 text-white/55">
            {description}
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

type AwardPalette = {
  hexColor: string;
  iconRingClass: string;
  labelClass: string;
};

function getAwardPalette(key: SeasonAward['award_key']): AwardPalette {
  if (key === 'best_record') {
    return {
      hexColor: THEME_COLORS.electricGreen,
      iconRingClass: 'border-electric-green/45 bg-electric-green/12',
      labelClass: 'text-electric-green',
    };
  }
  if (key === 'parlay_king') {
    return {
      hexColor: THEME_COLORS.amberAccent,
      iconRingClass: 'border-amber-accent/45 bg-amber-accent/12',
      labelClass: 'text-amber-accent',
    };
  }
  if (key === 'most_consistent') {
    return {
      hexColor: THEME_COLORS.cyanAccent,
      iconRingClass: 'border-cyan-accent/45 bg-cyan-accent/12',
      labelClass: 'text-cyan-accent',
    };
  }
  return {
    hexColor: THEME_COLORS.gold,
    iconRingClass: 'border-gold/45 bg-gold/15',
    labelClass: 'text-gold',
  };
}

function getSeasonAwardValueLabel(award: SeasonAward) {
  if (
    (award.award_key === 'season_mvp' || award.award_key === 'biggest_single_bet') &&
    typeof award.metric === 'number'
  ) {
    return formatProfit(award.metric);
  }

  return award.value_label;
}

function getSeasonAwardDisplayLabel(award: SeasonAward) {
  if (award.award_key === 'biggest_single_bet') {
    return 'Biggest Single Pick';
  }

  return award.award_label;
}

function ChampionBanner({
  championName,
  championRecord,
  championshipResult,
  cosmetics,
  leagueType,
  seasonYear,
}: {
  championName: string;
  championRecord: ChampionRecord | null;
  championshipResult: {
    championProfit: number | null;
    opponentName: string;
    opponentProfit: number | null;
    weekNumber: number;
  } | null;
  cosmetics?: EquippedCosmeticsByCategory;
  leagueType: 'h2h' | 'cumulative';
  seasonYear: number;
}) {
  const hasScores =
    championshipResult !== null &&
    championshipResult.championProfit !== null &&
    championshipResult.opponentProfit !== null;

  return (
    <View
      className="overflow-hidden rounded-3xl border-2 border-gold bg-gold/[0.14]"
      style={{
        shadowColor: THEME_COLORS.gold,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.65,
        shadowRadius: 28,
      }}>
      <View className="items-center gap-4 px-5 pt-7 pb-6">
        <View
          className="h-16 w-16 items-center justify-center rounded-3xl border-2 border-gold/70 bg-gold/20"
          style={{
            shadowColor: THEME_COLORS.gold,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 14,
          }}>
          <TrophySkinIcon cosmetics={cosmetics} size={32} />
        </View>
        <View className="items-center gap-1">
          <Text
            className="text-[10px] font-black uppercase text-gold"
            style={{ letterSpacing: 3 }}>
            {seasonYear} Champion
          </Text>
          <Text
            className="text-center text-3xl font-black uppercase text-white"
            numberOfLines={2}
            style={{ letterSpacing: -0.4 }}>
            {championName}
          </Text>
        </View>
      </View>

      {(championshipResult || championRecord) && (
        <View className="border-t border-gold/30 bg-arena-bg/60 px-5 py-4">
          {championshipResult ? (
            <View className="items-center gap-2">
              <Text
                className="text-[10px] font-black uppercase text-gold/85"
                style={{ letterSpacing: 2.4 }}>
                Championship · Week {championshipResult.weekNumber}
              </Text>
              {hasScores ? (
                <View className="flex-row items-end justify-center gap-3">
                  <Text
                    className={cn(
                      'text-2xl font-black',
                      getProfitTone(championshipResult.championProfit ?? 0),
                    )}>
                    {formatProfit(championshipResult.championProfit ?? 0)}
                  </Text>
                  <Text className="pb-0.5 text-xs font-black uppercase tracking-widest text-white/55">
                    vs
                  </Text>
                  <Text
                    className={cn(
                      'text-2xl font-black',
                      getProfitTone(championshipResult.opponentProfit ?? 0),
                    )}>
                    {formatProfit(championshipResult.opponentProfit ?? 0)}
                  </Text>
                </View>
              ) : null}
              <Text className="text-xs font-semibold text-white/65" numberOfLines={1}>
                Defeated {championshipResult.opponentName}
              </Text>
            </View>
          ) : null}

          {championRecord ? (
            <View
              className={cn(
                'flex-row items-center justify-center gap-4',
                championshipResult ? 'mt-3 border-t border-white/10 pt-3' : null,
              )}>
              {leagueType === 'h2h' ? (
                <View className="items-center">
                  <Text
                    className="text-[9px] font-black uppercase text-white/55"
                    style={{ letterSpacing: 1.6 }}>
                    Record
                  </Text>
                  <Text className="mt-0.5 text-base font-black text-white">
                    {formatRecord(
                      championRecord.wins,
                      championRecord.losses,
                      championRecord.ties,
                    )}
                  </Text>
                </View>
              ) : null}
              <View className="items-center">
                <Text
                  className="text-[9px] font-black uppercase text-white/55"
                  style={{ letterSpacing: 1.6 }}>
                  Season Profit
                </Text>
                <Text
                  className={cn(
                    'mt-0.5 text-base font-black',
                    getProfitTone(championRecord.total_profit),
                  )}>
                  {formatProfit(championRecord.total_profit)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}
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
  const valueLabel = getSeasonAwardValueLabel(award);

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
            {getSeasonAwardDisplayLabel(award)}
          </Text>
          <Text
            className="text-xl font-black uppercase text-white"
            numberOfLines={1}
            style={{ letterSpacing: -0.4 }}>
            {winnerName}
          </Text>
          {valueLabel ? (
            <Text className="text-xs font-semibold text-white/65">{valueLabel}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function SeasonAwardCard({
  award,
  winnerName,
}: {
  award: SeasonAward;
  winnerName: string;
}) {
  const valueLabel = getSeasonAwardValueLabel(award);
  const palette = getAwardPalette(award.award_key);

  return (
    <View className="flex-1 rounded-2xl border border-white/12 bg-white/[0.04] p-3">
      <View
        className={cn(
          'h-9 w-9 items-center justify-center rounded-2xl border',
          palette.iconRingClass,
        )}>
        <Ionicons color={palette.hexColor} name={seasonAwardIcon(award.award_key)} size={16} />
      </View>
      <Text
        className={cn('mt-2 text-[10px] font-black uppercase', palette.labelClass)}
        style={{ letterSpacing: 1.5 }}
        numberOfLines={2}>
        {getSeasonAwardDisplayLabel(award)}
      </Text>
      <Text
        className="mt-1 text-sm font-black text-white"
        numberOfLines={1}
        style={{ letterSpacing: -0.2 }}>
        {winnerName}
      </Text>
      {valueLabel ? (
        <Text className="mt-0.5 text-[11px] font-semibold text-white/55" numberOfLines={1}>
          {valueLabel}
        </Text>
      ) : null}
    </View>
  );
}

function BiggestSingleBetAwardCard({
  award,
  winnerName,
}: {
  award: SeasonAward;
  winnerName: string;
}) {
  const bet = award.bet ?? null;
  const valueLabel = getSeasonAwardValueLabel(award);
  const betLabel = bet
    ? bet.bet_type === 'straight'
      ? titleCaseBetType(bet.bet_type)
      : `${bet.legs.length}-Leg ${titleCaseBetType(bet.bet_type)}`
    : 'Pick details unavailable';

  return (
    <View className="rounded-2xl border border-white/12 bg-white/[0.04] p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl border border-amber-accent/45 bg-amber-accent/12">
          <Ionicons color={THEME_COLORS.amberAccent} name="flash" size={18} />
        </View>
        <View className="flex-1 gap-1">
          <Text
            className="text-[10px] font-black uppercase text-amber-accent"
            style={{ letterSpacing: 1.6 }}>
            {getSeasonAwardDisplayLabel(award)}
          </Text>
          <Text
            className="text-base font-black text-white"
            numberOfLines={1}
            style={{ letterSpacing: -0.2 }}>
            {winnerName}
          </Text>
          {valueLabel ? (
            <Text className="text-xs font-semibold text-white/60">{valueLabel}</Text>
          ) : null}
        </View>
      </View>

      {bet ? (
        <View className="mt-4 gap-3">
          <View className="flex-row flex-wrap gap-2">
            <Badge label={`Week ${bet.week_number}`} tone="cyan" />
            <Badge betType={bet.bet_type} label={betLabel} />
            <Badge betType={bet.bet_type} label={formatAmericanOdds(bet.odds)} />
            {bet.is_lock ? <Badge label="Lock of the Week" tone="gold" /> : null}
          </View>
          {bet.is_lock ? (
            <Text className="text-[11px] font-semibold text-gold/85">
              Lock of the Week — pays 1.5× on win, costs 1.5× on loss.
            </Text>
          ) : null}
          <Text className="text-xs font-semibold text-white/55">
            {formatCurrency(bet.amount)} played · Reward {formatCurrency(bet.potential_payout)}
          </Text>
          {bet.legs.length > 0 ? (
            <View className="gap-1.5">
              {bet.legs.map((leg, index) => (
                <Text
                  className="text-xs font-semibold leading-4 text-white/72"
                  key={`${bet.id}-${leg.game_id}-${index}`}>
                  {index + 1}. {formatBetLegLabel(leg, { betType: bet.bet_type })}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
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
  const championUserId = detail.seasonSnapshot.champion_user_id;
  const championName = championUserId
    ? getDisplayName(detail, championUserId)
    : 'Champion pending';

  if (awards.length === 0 && !championUserId) {
    return null;
  }

  const championRecord = findChampionRecord(
    detail.seasonSnapshot.final_standings,
    championUserId,
  );
  const championshipSummary = championshipSummaryFromJson(
    detail.seasonSnapshot.championship_summary,
  );
  const championshipResult =
    championshipSummary && championshipSummary.opponent_user_id
      ? {
          championProfit: championshipSummary.champion_profit,
          opponentName: getDisplayName(detail, championshipSummary.opponent_user_id),
          opponentProfit: championshipSummary.opponent_profit,
          weekNumber: championshipSummary.week_number,
        }
      : null;

  const mvpAward = awards.find((award) => award.award_key === 'season_mvp');
  const biggestBetAward = awards.find((award) => award.award_key === 'biggest_single_bet');
  const midTierAwards = awards.filter(
    (award) => award.award_key !== 'season_mvp' && award.award_key !== 'biggest_single_bet',
  );

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
        championRecord={championRecord}
        championshipResult={championshipResult}
        cosmetics={championUserId ? cosmeticsByUserId[championUserId] : undefined}
        leagueType={detail.league.type}
        seasonYear={detail.league.season_year}
      />

      {mvpAward ? (
        <MvpAwardCard
          award={mvpAward}
          cosmetics={mvpAward.user_id ? cosmeticsByUserId[mvpAward.user_id] : undefined}
          winnerName={mvpAward.user_id ? getDisplayName(detail, mvpAward.user_id) : 'No winner'}
        />
      ) : null}

      {midTierAwards.length > 0 ? (
        <View className="flex-row gap-2">
          {midTierAwards.map((award) => (
            <SeasonAwardCard
              award={award}
              key={award.award_key}
              winnerName={
                award.user_id ? getDisplayName(detail, award.user_id) : 'No winner'
              }
            />
          ))}
        </View>
      ) : null}

      {biggestBetAward ? (
        <BiggestSingleBetAwardCard
          award={biggestBetAward}
          winnerName={biggestBetAward.user_id ? getDisplayName(detail, biggestBetAward.user_id) : 'No winner'}
        />
      ) : null}
    </View>
  );
}

function StandingsBoard({
  cosmeticsByUserId,
  detail,
  hasSeasonStandings,
  selectedWeekSettled,
  selectedWeekNumber,
  standingsWeekNumber,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  hasSeasonStandings: boolean;
  selectedWeekSettled: boolean;
  selectedWeekNumber: number;
  standingsWeekNumber: number | null;
  userId: string;
}) {
  const router = useRouter();
  const isH2H = detail.league.type === 'h2h';

  if (detail.standings.length === 0) {
    const isFutureWeek = selectedWeekNumber > detail.league.current_week;
    const isPastWeek = selectedWeekNumber < detail.league.current_week;
    const title = hasSeasonStandings
      ? isFutureWeek
        ? `Week ${selectedWeekNumber} Standings Pending`
        : `No Week ${selectedWeekNumber} Snapshot`
      : 'Standings Coming Soon';
    const description = hasSeasonStandings
      ? isPastWeek
        ? 'This league does not have a saved standings row for that completed week yet.'
        : 'Cumulative standings will update here once this week is played.'
      : 'Season standings will appear once the first week is settled.';

    return (
      <Card>
        <View className="items-center gap-3 py-4">
          <View className="h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
            <Ionicons color="rgba(255,255,255,0.62)" name="podium" size={20} />
          </View>
          <Text
            className="text-center text-lg font-black uppercase text-white"
            style={{ letterSpacing: -0.2 }}>
            {title}
          </Text>
          <Text className="text-center text-sm font-semibold leading-5 text-white/55">
            {description}
          </Text>
        </View>
      </Card>
    );
  }

  const resolvedStandingsWeekNumber = standingsWeekNumber ?? selectedWeekNumber;
  const badgeLabel =
    detail.league.status === 'complete' && resolvedStandingsWeekNumber === detail.league.current_week
      ? 'Final'
      : selectedWeekSettled && resolvedStandingsWeekNumber === selectedWeekNumber
      ? 'Final'
      : resolvedStandingsWeekNumber === selectedWeekNumber
      ? selectedWeekNumber === detail.league.current_week
        ? 'Live'
        : 'Snapshot'
      : 'Latest';
  const badgeTone = badgeLabel === 'Live' ? 'green' : 'gold';

  return (
    <Card padded={false}>
      <View>
        <View className="flex-row items-center justify-between gap-3 px-5 pt-5">
          <Text
            className="text-[10px] font-black uppercase text-electric-green"
            style={{ letterSpacing: 2 }}>
            Standings Through Week {resolvedStandingsWeekNumber}
          </Text>
          <Badge label={badgeLabel} tone={badgeTone} />
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
            Team
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
          const primaryName = getDisplayName(detail, standing.user_id);
          const secondaryName = getSecondaryDisplayName(detail, standing.user_id);
          const standingSummary = isH2H
            ? `Season ${formatProfit(standing.total_profit)} · Week ${
                standing.week_number
              } ${formatProfit(standing.weekly_profit)}`
            : `Week ${standing.week_number} ${formatProfit(standing.weekly_profit)}`;
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
                      name={primaryName}
                      size="sm"
                    />
                    <Text className="text-base font-black text-white" numberOfLines={1}>
                      {primaryName}
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
                    {secondaryName ? `${secondaryName} · ${standingSummary}` : standingSummary}
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

          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center gap-2">
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
                  numberOfLines={2}
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

            <View className="flex-1 flex-row items-center justify-end gap-2">
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
                  numberOfLines={2}
                  style={{ letterSpacing: -0.3, textAlign: 'right' }}>
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
  onMemberActions,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  onMemberActions: (member: LeagueMemberRow) => void;
  userId: string;
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
          const secondaryName = getSecondaryDisplayName(detail, member.user_id);
          const canModerateMember = member.user_id !== userId;
          return (
            <PressableScale
              key={member.id}
              onLongPress={() => {
                if (canModerateMember) {
                  onMemberActions(member);
                }
              }}
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
                    {memberName}
                  </Text>
                  {secondaryName ? (
                    <Text className="mt-1 text-[11px] font-semibold text-white/50" numberOfLines={1}>
                      {secondaryName}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end gap-1">
                  {isCommissioner ? <Badge label="Commish" tone="gold" /> : null}
                  <Text
                    className={cn('text-sm font-black', getProfitTone(totalProfit))}
                    style={{ letterSpacing: -0.2 }}>
                    {formatProfit(totalProfit)}
                  </Text>
                  {canModerateMember ? (
                    <Pressable
                      accessibilityLabel={`Report or block ${memberName}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => onMemberActions(member)}>
                      <View className="h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                        <Ionicons color="rgba(255,255,255,0.55)" name="flag" size={12} />
                      </View>
                    </Pressable>
                  ) : null}
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
  const hasSettledProfit = metadata.result !== 'pending' && typeof metadata.profit === 'number';

  return (
    <PressableScale>
      <LockEffect cosmetics={cosmetics} compact>
        {/* `w-full` keeps the card pinned to the chat bubble's content width.
            Every inner row below is built to wrap or truncate within that
            width, so nothing can extend past the card's border. */}
        <View
          className={cn(
            'mt-2 w-full rounded-2xl border bg-arena-bg/50 p-3',
            isLock ? 'bg-gold/[0.07]' : null,
          )}
          style={{
            borderColor: isLock ? THEME_COLORS.gold : `${accent}55`,
            shadowColor: isLock ? THEME_COLORS.gold : accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isLock ? 0.3 : 0,
            shadowRadius: isLock ? 10 : 0,
          }}>
          {/* Header: badges/pills on the left share the row with the odds on
              the right. The left group is `flex-1` + `flex-wrap`, so when the
              TEASER pill, POTW pill and week label can't sit side by side they
              wrap onto new lines instead of pushing past the card edge.
              `items-start` keeps the odds aligned to the first line. */}
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 flex-row flex-wrap items-center gap-2">
              <Badge betType={metadata.betType} />
              {isLock ? (
                <View className="max-w-full shrink flex-row items-center gap-1 rounded-full border border-gold/55 bg-gold/15 px-2 py-0.5">
                  <Ionicons color={THEME_COLORS.gold} name="star" size={10} />
                  <Text
                    className="shrink text-[9px] font-black uppercase text-gold"
                    numberOfLines={1}
                    style={{ letterSpacing: 1 }}>
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
            <Text className="shrink-0 text-xs font-black" style={{ color: accent }}>
              {formatAmericanOdds(metadata.odds)}
            </Text>
          </View>

          {/* Legs: each row reserves a fixed slot for the odds on the right and
              gives the team logo + label the remaining `flex-1` space. The
              label wraps onto a second line when needed (e.g. teaser line
              shifts like "Dallas Cowboys +2.5 → +8.5") so both the original
              and adjusted value stay visible instead of truncating. The logo
              and odds anchor to the first line via `items-start`. */}
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
                <View
                  key={`${leg.selection}-${index}`}
                  className="flex-row items-start justify-between gap-2">
                  <View className="min-w-0 flex-1 flex-row items-start gap-2">
                    {leg.market !== 'over_under' ? (
                      <NflTeamLogo size={20} teamName={getPickLogoLabel(labelLeg)} />
                    ) : null}
                    <Text
                      className="min-w-0 flex-1 text-xs font-semibold leading-tight text-white/75"
                      numberOfLines={2}>
                      {formatBetLegLabel(labelLeg, { betType: metadata.betType })}
                    </Text>
                  </View>
                  <Text className="shrink-0 text-[10px] font-black uppercase text-white/45">
                    {formatAmericanOdds(leg.odds)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Footer: the coins-played label wraps onto a second line when it
              can't sit beside the reward total, so the full "X COINS PLAYED"
              label always reads while the reward stays inside the card.
              `items-start` keeps the reward anchored to the first line. */}
          <View className="mt-3 flex-row items-start justify-between gap-2 border-t border-white/[0.08] pt-3">
            <Text
              className="min-w-0 shrink text-[10px] font-black uppercase leading-tight text-white/45"
              numberOfLines={2}
              style={{ letterSpacing: 1.4 }}>
              {formatCurrency(metadata.amount)} played
            </Text>
            <Text
              className={cn(
                'shrink-0 text-xs font-black',
                hasSettledProfit ? getProfitTone(metadata.profit ?? 0) : 'text-electric-green',
              )}>
              {hasSettledProfit
                ? `Profit ${formatProfit(metadata.profit ?? 0)}`
                : `Reward ${formatCurrency(metadata.potentialReward)}`}
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
  member,
  message,
  onOpenActions,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  isMine: boolean;
  member?: LeagueMemberRow;
  message: LeagueChatMessage;
  onOpenActions: (message: LeagueChatMessage, displayName: string) => void;
}) {
  const isSystem = message.message_type === 'system';
  const isBetShare = message.message_type === 'bet_share';
  const isSticker = message.message_type === 'sticker';
  const displayName = isSystem
    ? 'Action Arena'
    : getLeagueMemberPrimaryName(member, message.user, 'Player');
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
    <Pressable
      delayLongPress={350}
      onLongPress={() => {
        if (!isMine) {
          onOpenActions(message, displayName);
        }
      }}>
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
        <View
          className={cn(
            'mt-1.5 flex-row items-center gap-2',
            isMine ? 'justify-end' : 'justify-between',
          )}>
          {!isMine ? (
            <Pressable
              accessibilityLabel={`Report or block ${displayName}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onOpenActions(message, displayName)}>
              <View className="h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <Ionicons color="rgba(255,255,255,0.5)" name="flag" size={11} />
              </View>
            </Pressable>
          ) : null}
          <Text
            className={cn(
              'text-[10px] font-semibold',
              isMine ? 'text-electric-green/60 self-end' : 'text-white/40',
            )}>
            {getShortTime(message.created_at)}
          </Text>
        </View>
      </View>
      {isMine ? (
        <CosmeticAvatar cosmetics={cosmetics} name={displayName} size="sm" />
      ) : null}
      </View>
    </Pressable>
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
  const reportContent = useReportContentMutation(userId);
  const blockUser = useBlockUserMutation(userId);
  const sendMessage = useSendLeagueChatMessage(detail.league.id, userId);
  const sendSticker = useSendLeagueChatSticker(detail.league.id, userId);
  const userCosmetics = useUserCosmetics(userId);
  const messages = chatQuery.data ?? [];
  const memberByUserId = useMemo(
    () =>
      detail.members.reduce<Record<string, LeagueMemberRow>>((accumulator, member) => {
        accumulator[member.user_id] = member;
        return accumulator;
      }, {}),
    [detail.members],
  );
  const canSend = draft.trim().length > 0 && !sendMessage.isPending;
  const stickerRows = (userCosmetics.data?.rows ?? []).filter(
    (row) => row.category === 'chat_sticker_pack',
  );

  const reportChatMessage = async (message: LeagueChatMessage, displayName: string) => {
    if (!message.user_id) {
      return;
    }

    try {
      await reportContent.mutateAsync({
        contentSnapshot: {
          body: message.body,
          created_at: message.created_at,
          message_type: message.message_type,
          metadata: message.metadata,
          user_display_name: displayName,
          user_id: message.user_id,
        },
        leagueId: detail.league.id,
        reportedUserId: message.user_id,
        targetId: message.id,
        targetType: 'chat_message',
      });
      haptics.success();
      Alert.alert('Report sent', 'This message was flagged for moderation review.');
    } catch (error) {
      haptics.error();
      Alert.alert('Could not report message', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const confirmBlockUser = (blockedUserId: string, displayName: string) => {
    Alert.alert(
      `Block ${displayName}?`,
      "You won't see their chat messages anymore. Other league members can still see them.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          onPress: () => {
            void (async () => {
              try {
                await blockUser.mutateAsync(blockedUserId);
                haptics.success();
                Alert.alert('User blocked', `${displayName}'s messages are hidden for you.`);
              } catch (error) {
                haptics.error();
                Alert.alert(
                  'Could not block user',
                  error instanceof Error ? error.message : 'Try again.',
                );
              }
            })();
          },
          style: 'destructive',
          text: 'Block',
        },
      ],
    );
  };

  const openMessageActions = (message: LeagueChatMessage, displayName: string) => {
    if (!message.user_id || message.user_id === userId) {
      return;
    }

    Alert.alert(displayName, 'Choose a moderation action for this message.', [
      {
        onPress: () => {
          void reportChatMessage(message, displayName);
        },
        text: 'Report Message',
      },
      {
        onPress: () => confirmBlockUser(message.user_id as string, displayName),
        style: 'destructive',
        text: 'Block User',
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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
                member={message.user_id ? memberByUserId[message.user_id] : undefined}
                message={message}
                onOpenActions={openMessageActions}
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
  // A plain flexbox row: four equal-flex tabs, each owning exactly a quarter of
  // the width. The indicator is a real child of its tab — it stretches to the
  // label's text width and sits directly beneath it, so there is nothing to
  // measure, offset, or "chase" when the active tab changes.
  return (
    <View
      style={{
        alignSelf: 'stretch',
        borderBottomColor: 'rgba(255,255,255,0.08)',
        borderBottomWidth: 1,
        flexDirection: 'row',
        width: '100%',
      }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <View
            key={tab.key}
            style={{
              flex: 1,
              flexBasis: 0,
              minWidth: 0,
            }}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              hitSlop={8}
              onPress={() => onChange(tab.key)}
              style={({ pressed }) => ({
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0,
                opacity: pressed ? 0.68 : 1,
                // Horizontal padding reserves breathing room inside each quarter
                // so neighbouring labels always have a clear gap and never touch.
                paddingHorizontal: 6,
                paddingVertical: 12,
                width: '100%',
              })}>
              {/* This column shrinks to the label's intrinsic text width; the
                  indicator below it stretches to match that exact width. */}
              <View style={{ alignItems: 'center' }}>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  numberOfLines={1}
                  style={{
                    color: isActive ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.55)',
                    fontSize: 10,
                    fontWeight: '900',
                    letterSpacing: 0.2,
                    textTransform: 'uppercase',
                  }}>
                  {tab.label}
                </Text>
                <View
                  style={{
                    alignSelf: 'stretch',
                    backgroundColor: isActive ? THEME_COLORS.electricGreen : 'transparent',
                    borderRadius: TAB_INDICATOR_HEIGHT,
                    height: TAB_INDICATOR_HEIGHT,
                    marginTop: 8,
                    ...(isActive
                      ? {
                          shadowColor: THEME_COLORS.electricGreen,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.55,
                          shadowRadius: 8,
                        }
                      : null),
                  }}
                />
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function TabContent({
  canStartSeason,
  cosmeticsByUserId,
  detail,
  hasSeasonStandings,
  onMemberActions,
  onStartSeason,
  selectedWeekSettled,
  selectedWeekNumber,
  standingsWeekNumber,
  startSeasonError,
  startingSeason,
  tab,
  userId,
}: {
  canStartSeason: boolean;
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  hasSeasonStandings: boolean;
  onMemberActions: (member: LeagueMemberRow) => void;
  onStartSeason: () => void;
  selectedWeekSettled: boolean;
  selectedWeekNumber: number;
  standingsWeekNumber: number | null;
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
          hasSeasonStandings={hasSeasonStandings}
          selectedWeekSettled={selectedWeekSettled}
          selectedWeekNumber={selectedWeekNumber}
          standingsWeekNumber={standingsWeekNumber}
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
        <MembersList
          cosmeticsByUserId={cosmeticsByUserId}
          detail={detail}
          onMemberActions={onMemberActions}
          userId={userId}
        />
      ) : null}
      {tab === 'chat' ? (
        <LeagueChat cosmeticsByUserId={cosmeticsByUserId} detail={detail} userId={userId} />
      ) : null}
    </View>
  );
}

function HeroHeader({
  detail,
  onReportLeague,
}: {
  detail: LeagueDetail;
  onReportLeague: () => void;
}) {
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
      <View className="flex-row items-start gap-2">
        <Text
          className="min-w-0 flex-1 text-2xl font-extrabold text-white"
          style={{ letterSpacing: -0.4 }}
          numberOfLines={2}>
          {detail.league.name}
        </Text>
        <Pressable
          accessibilityLabel="Report league name"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onReportLeague}>
          <View className="h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <Ionicons color="rgba(255,255,255,0.6)" name="flag" size={15} />
          </View>
        </Pressable>
      </View>
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
  const reportContent = useReportContentMutation(user?.id);
  const blockUser = useBlockUserMutation(user?.id);
  const updateTeamName = useUpdateLeagueTeamNameMutation(user?.id);
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>();
  const [teamNameDraft, setTeamNameDraft] = useState('');
  const [teamNameError, setTeamNameError] = useState<string | undefined>();
  const [editingTeamMember, setEditingTeamMember] = useState<LeagueMemberRow | null>(null);
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
        <View className="px-5 pt-2">
          <DetailBackButton />
        </View>
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
  const selectedStandingsSnapshot = getStandingsSnapshotForWeek(detail, selectedWeekNumber);
  const selectedDetail: LeagueDetail = {
    ...detail,
    currentUserMatchup: getUserMatchupForWeek(detail, userId, selectedWeekNumber),
    standings: selectedStandingsSnapshot.standings,
  };
  const currentUserMatchup = selectedDetail.currentUserMatchup;
  const cosmeticsByUserId = cosmeticsQuery.data ?? {};
  const isCurrentWeek = selectedWeekNumber === detail.league.current_week;
  const isPastWeek = selectedWeekNumber < detail.league.current_week;
  const isFutureWeek = selectedWeekNumber > detail.league.current_week;
  const selectedWeekStatus: WeekViewStatus = isCurrentWeek ? 'current' : isPastWeek ? 'past' : 'future';
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
  const canStartSeason =
    detail.league.type === 'h2h' &&
    detail.league.commissioner_id === userId &&
    detail.members.length >= 2 &&
    ['drafting', 'active'].includes(detail.league.status) &&
    detail.matchups.length === 0;
  const handleStartSeason = () => {
    generateSchedule.mutate(detail.league.id);
  };
  const reportLeagueName = () => {
    Alert.alert('Report league name?', 'This flags the public league identity for review.', [
      { text: 'Cancel', style: 'cancel' },
      {
        onPress: () => {
          void (async () => {
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
              haptics.success();
              Alert.alert('Report sent', 'This league name was flagged for moderation review.');
            } catch (error) {
              haptics.error();
              Alert.alert('Could not report league', error instanceof Error ? error.message : 'Try again.');
            }
          })();
        },
        style: 'destructive',
        text: 'Report',
      },
    ]);
  };
  const confirmBlockMember = (member: LeagueMemberRow, displayName: string) => {
    Alert.alert(
      `Block ${displayName}?`,
      "You won't see their chat messages anymore. Other league members can still see them.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          onPress: () => {
            void (async () => {
              try {
                await blockUser.mutateAsync(member.user_id);
                haptics.success();
                Alert.alert('User blocked', `${displayName}'s messages are hidden for you.`);
              } catch (error) {
                haptics.error();
                Alert.alert(
                  'Could not block user',
                  error instanceof Error ? error.message : 'Try again.',
                );
              }
            })();
          },
          style: 'destructive',
          text: 'Block',
        },
      ],
    );
  };
  const reportMemberDisplayName = async (member: LeagueMemberRow, displayName: string) => {
    const profile = detail.profilesById[member.user_id];

    try {
      await reportContent.mutateAsync({
        contentSnapshot: {
          display_name: profile?.display_name ?? null,
          team_name: member.team_name,
          user_display_name: displayName,
          user_id: member.user_id,
        },
        leagueId: detail.league.id,
        reportedUserId: member.user_id,
        targetId: member.id,
        targetType: 'league_member',
      });
      haptics.success();
      Alert.alert('Report sent', 'This display name was flagged for moderation review.');
    } catch (error) {
      haptics.error();
      Alert.alert('Could not report member', error instanceof Error ? error.message : 'Try again.');
    }
  };
  const openMemberActions = (member: LeagueMemberRow) => {
    if (member.user_id === userId) {
      return;
    }

    const displayName = getDisplayName(detail, member.user_id);

    Alert.alert(displayName, 'Choose a moderation action for this member.', [
      {
        onPress: () => {
          void reportMemberDisplayName(member, displayName);
        },
        text: 'Report Display Name',
      },
      {
        onPress: () => confirmBlockMember(member, displayName),
        style: 'destructive',
        text: 'Block User',
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const openTeamNameEditor = (member: LeagueMemberRow) => {
    setTeamNameDraft(member.team_name);
    setTeamNameError(undefined);
    setEditingTeamMember(member);
  };
  const closeTeamNameEditor = () => {
    if (updateTeamName.isPending) {
      return;
    }

    setEditingTeamMember(null);
    setTeamNameError(undefined);
  };
  const saveTeamName = async () => {
    if (!editingTeamMember) {
      return;
    }

    const trimmedTeamName = teamNameDraft.trim();

    if (!trimmedTeamName) {
      setTeamNameError('Team name is required.');
      haptics.warning();
      return;
    }

    if (trimmedTeamName.length > TEAM_NAME_MAX_LENGTH) {
      setTeamNameError(`Keep it to ${TEAM_NAME_MAX_LENGTH} characters or fewer.`);
      haptics.warning();
      return;
    }

    if (trimmedTeamName === editingTeamMember.team_name.trim()) {
      closeTeamNameEditor();
      return;
    }

    try {
      await updateTeamName.mutateAsync({
        leagueId: detail.league.id,
        teamName: trimmedTeamName,
        userId,
      });
      haptics.success();
      setEditingTeamMember(null);
      setTeamNameError(undefined);
    } catch (error) {
      haptics.error();
      setTeamNameError(error instanceof Error ? error.message : 'Could not save team name.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <TeamNameEditorModal
        draftName={teamNameDraft}
        error={teamNameError}
        isSaving={updateTeamName.isPending}
        onCancel={closeTeamNameEditor}
        onChange={(value) => {
          setTeamNameDraft(value);
          if (teamNameError) {
            setTeamNameError(undefined);
          }
        }}
        onSave={saveTeamName}
        visible={Boolean(editingTeamMember)}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 16, padding: 20, paddingBottom: 36 }}
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
        <View className="flex-row">
          <DetailBackButton />
        </View>

        {/* Identity: who/what this league is, plus the week being viewed. */}
        <View className="gap-3">
          <HeroHeader detail={detail} onReportLeague={reportLeagueName} />
          <YourTeamCard detail={detail} onEdit={openTeamNameEditor} userId={userId} />
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
        </View>

        <InviteCodeCard detail={detail} seasonInProgress={seasonInProgress} />
        <SeasonAwardsCard cosmeticsByUserId={cosmeticsByUserId} detail={detail} />

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
              weekStatus={selectedWeekStatus}
              userId={userId}
            />
          </PressableScale>
        ) : detail.league.type === 'h2h' ? (
          <MatchupPlaceholderCard
            hasWeekSchedule={detail.matchups.some(
              (matchup) => matchup.week_number === selectedWeekNumber,
            )}
            weekNumber={selectedWeekNumber}
            weekStatus={selectedWeekStatus}
          />
        ) : null}

        {/* Standings hub: the current-week snapshot, the section tabs, and the
            season standings sit in one tightly-spaced group so they read as a
            single standings experience rather than disconnected cards. */}
        <View className="gap-3" style={{ alignSelf: 'stretch', width: '100%' }}>
          {isFutureWeek ? (
            <FutureWeekAwardsCard weekNumber={selectedWeekNumber} />
          ) : awardsQuery.data ? (
            <WeeklyAwardsCard awards={awardsQuery.data} weekNumber={selectedWeekNumber} />
          ) : null}
          <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />
          <TabContent
            canStartSeason={canStartSeason}
            cosmeticsByUserId={cosmeticsByUserId}
            detail={selectedDetail}
            hasSeasonStandings={detail.standings.length > 0}
            onMemberActions={openMemberActions}
            onStartSeason={handleStartSeason}
            selectedWeekSettled={selectedWeekSettled}
            selectedWeekNumber={selectedWeekNumber}
            standingsWeekNumber={selectedStandingsSnapshot.weekNumber}
            startSeasonError={generateSchedule.error?.message}
            startingSeason={generateSchedule.isPending}
            tab={activeTab}
            userId={userId}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
