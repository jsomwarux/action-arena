import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LockEffect } from '@/components/cosmetics';
import { LiveBetStatusSummary, LiveLegScoreLine } from '@/components/picks/live-pick-status';
import {
  PickSummaryMetricGrid,
  type PickSummaryMetric,
} from '@/components/picks/pick-summary-metrics';
import {
  AnimatedBar,
  AnimatedNumber,
  Badge,
  BottomSheet,
  Button,
  Card,
  LivePulse,
  ModalShell,
  NflTeamLogo,
  PressableScale,
  ScreenWrapper,
  SegmentedToggle,
  type SegmentedOption,
  SkeletonLoader,
  type SnapIndex,
  StaggeredItem,
  SwipeableRow,
  TextInput,
  WeekNavigator,
} from '@/components/ui';
import {
  LOCK_OF_THE_WEEK_MULTIPLIER,
  MAX_SINGLE_BET,
  MINIMUM_BETS_PER_WEEK,
  PARLAY_PAYOUT_CAP,
  TEASER_MAX_LEGS,
  TEASER_MIN_LEGS,
  TEASER_ODDS_LOOKUP,
  WEEKLY_BUDGET,
} from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { useShareBetToChat } from '@/hooks/use-league-chat';
import { LOCAL_FLAG_KEYS, useLocalFlag } from '@/hooks/use-local-flags';
import { useMyLeagues } from '@/hooks/use-leagues';
import { useLiveScores } from '@/hooks/use-live-scores';
import { useLeagueWeekRevealTime, useSyncLeagueWeekSlate, useUpcomingNflOdds } from '@/hooks/use-odds';
import { useBetBoardAccess } from '@/hooks/use-season-pass';
import {
  type BetEditSubmission,
  type BetEditSubmissionLeg,
  type BetSubmissionLeg,
  type MixedBetSubmission,
  type PlacedBet,
  usePlacedBets,
  useSetPickOfWeekMutation,
  useSubmitBetsMutation,
  useUpdatePlacedBetMutation,
} from '@/hooks/use-straight-bets';
import { cn } from '@/lib/cn';
import {
  getBetSettlementState,
  getRealizedReward,
  isSettledResult,
} from '@/lib/bet-outcome';
import {
  americanOddsToDecimal,
  calculatePotentialPayout,
  decimalOddsToAmerican,
  formatAmericanOdds,
  formatCurrency,
  formatGameTime,
  formatProfit,
  getProfitTone,
} from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { getAppStoreCaptureMode, type AppStoreCaptureMode } from '@/lib/league-settings';
import { evaluateLiveBetStatus } from '@/lib/live-pick-status';
import { getNflTeamShortName } from '@/lib/nfl-teams';
import type { OddsGame, OddsSelection } from '@/lib/odds-api';
import {
  formatBetLegLabel,
  formatOddsSelectionLabel,
  formatPickTitle,
  getPickLegBaseLabel,
  getPickLogoLabel,
} from '@/lib/pick-labels';
import { isBetLegLocked, isParentPickLocked } from '@/lib/pick-locking';
import {
  areConflictingPicks,
  findConflictingPick,
  findPickConflict,
  formatPickConflictReason,
  getPickConflictKind,
  getPickConflictSide,
} from '@/lib/pick-conflicts';
import type {
  BetMarket,
  BetType,
  EquippedCosmeticsByCategory,
  LeagueRow,
  LiveGameStateRow,
  TeaserLegCount,
  TeaserPoints,
} from '@/types/database';

type BetMode = BetType;

type SlipLeg = BetSubmissionLeg & {
  awayTeam: string;
  homeTeam: string;
  id: string;
  label: string;
  selectionKey: string;
};

type SlipBet = Omit<MixedBetSubmission, 'legs'> & {
  id: string;
  label: string;
  legs: SlipLeg[];
  rawPotentialReward?: number;
};

type PendingStraightSelection = {
  game: OddsGame;
  selection: OddsSelection;
};

type EditingSlipBet = {
  bet: SlipBet;
};

type EditingPlacedLeg = SlipLeg & {
  betLegId: string;
  locked: boolean;
};

type ValidationState = {
  errors: string[];
  warnings: string[];
};

type ConflictSource =
  | {
      kind: 'builder';
      mode: Extract<BetMode, 'parlay' | 'teaser'>;
    }
  | {
      bet: SlipBet;
      kind: 'slip';
    };

type SelectionConflict = {
  actionLabel: string;
  existingLeg: SlipLeg;
  game: OddsGame;
  id: string;
  message: string;
  nextLeg: SlipLeg;
  selection: OddsSelection;
  source: ConflictSource;
  summary: string;
  targetMode: BetMode;
};

const MARKET_OPTIONS: SegmentedOption<BetMarket>[] = [
  { icon: 'trophy', label: 'Winner', value: 'moneyline' },
  { icon: 'swap-horizontal', label: 'Spread', value: 'spread' },
  { icon: 'remove-outline', label: 'Total', value: 'over_under' },
];

const BET_MODE_OPTIONS: SegmentedOption<BetMode>[] = [
  { accent: 'green', icon: 'flash', label: 'Straight', value: 'straight' },
  { accent: 'amber', icon: 'link', label: 'Parlay', value: 'parlay' },
  { accent: 'cyan', icon: 'trending-up', label: 'Teaser', value: 'teaser' },
];

const TEASER_POINT_OPTIONS: SegmentedOption<TeaserPoints>[] = [
  { accent: 'cyan', label: '6 PT', value: 6 },
  { accent: 'cyan', label: '6.5 PT', value: 6.5 },
  { accent: 'cyan', label: '7 PT', value: 7 },
];

const QUICK_AMOUNTS = [5, 10, 20, MAX_SINGLE_BET];
const LINEUP_COLLAPSED_HEIGHT = 104;
const ODDS_BUTTON_GAP = 10;
const REGULAR_SEASON_WEEKS = 14;

type TourAnchor = 'top' | 'middle' | 'bottom';

const TOUR_STEPS: {
  anchor: TourAnchor;
  body: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
}[] = [
  {
    anchor: 'top',
    body: 'Tracks your 100-coin weekly budget — what is allocated, what is left, and how close you are to the 5-pick minimum.',
    icon: 'wallet',
    title: 'Budget tracker',
  },
  {
    anchor: 'middle',
    body: 'Tap any odds value on a game. Choose how many coins to allocate. Then add it to your lineup.',
    icon: 'finger-print',
    title: 'Make a pick',
  },
  {
    anchor: 'top',
    body: 'Straight picks are single-game predictions. Parlays combine multiple picks for bigger rewards — all must hit. Teasers let you adjust the line in your favor across multiple games.',
    icon: 'swap-horizontal',
    title: 'Switch pick modes',
  },
  {
    anchor: 'bottom',
    body: 'Pull up the lineup from the bottom to review picks, rewards, and remaining budget before you submit.',
    icon: 'receipt',
    title: 'Lineup',
  },
  {
    anchor: 'middle',
    body: 'Submit unlocks once you have at least 5 picks, exactly one Pick of the Week, no pick over 35 coins, the full 100-coin budget allocated, and no conflicting picks.',
    icon: 'checkmark-done',
    title: 'Validation rules',
  },
];

function marketLabel(market: BetMarket) {
  if (market === 'moneyline') return 'Winner';
  if (market === 'spread') return 'Spread';
  return 'Over/Under';
}

function conflictMarketLabel(market: BetMarket) {
  if (market === 'moneyline') return 'moneyline';
  if (market === 'spread') return 'spread';
  return 'total';
}

function getSelectionLabel(selection: OddsSelection) {
  return formatOddsSelectionLabel(selection);
}

function getOddsButtonLabel(selection: OddsSelection) {
  if (selection.market === 'spread' && selection.line !== null) {
    return `${selection.shortName} ${formatLine(selection.line)}`;
  }

  if (selection.market === 'over_under' && selection.line !== null) {
    return `${selection.selection} ${selection.line}`;
  }

  return selection.shortName;
}

function getTeaserOddsButtonLabel(selection: OddsSelection, teaserPoints: TeaserPoints) {
  const adjustedLine = getAdjustedTeaserLine(selection, teaserPoints);

  if (selection.market === 'spread' && adjustedLine !== null) {
    return `${selection.shortName} ${formatLine(adjustedLine)}`;
  }

  if (selection.market === 'over_under' && adjustedLine !== null) {
    return `${selection.selection} ${adjustedLine}`;
  }

  return getOddsButtonLabel(selection);
}

function getSelectionKey(gameId: string, selection: OddsSelection) {
  return `${gameId}:${selection.market}:${selection.selection}:${selection.line ?? 'na'}`;
}

function getModeTone(mode: BetMode): 'green' | 'amber' | 'cyan' {
  if (mode === 'parlay') return 'amber';
  if (mode === 'teaser') return 'cyan';
  return 'green';
}

function modeAccentHex(mode: BetMode) {
  if (mode === 'parlay') return THEME_COLORS.amberAccent;
  if (mode === 'teaser') return THEME_COLORS.cyanAccent;
  return THEME_COLORS.electricGreen;
}

function makeSlipLeg(game: OddsGame, selection: OddsSelection, adjustedLine = selection.line): SlipLeg {
  return {
    adjusted_line: adjustedLine,
    awayTeam: game.awayTeam,
    game_id: game.id,
    game_start_time: game.commenceTime,
    homeTeam: game.homeTeam,
    id: getSelectionKey(game.id, selection),
    label: getSelectionLabel(selection),
    leg_odds: selection.odds,
    market: selection.market,
    original_line: selection.line,
    selection: getSelectionLabel(selection),
    selectionKey: getSelectionKey(game.id, selection),
  };
}

function getLegSelectionKey(leg: Pick<SlipLeg, 'game_id' | 'market' | 'original_line' | 'selection'>) {
  return `${leg.game_id}:${leg.market}:${leg.selection}:${leg.original_line ?? 'na'}`;
}

function isPlacedLegLocked(leg: Pick<PlacedBet['bet_legs'][number], 'game_start_time' | 'locked'>) {
  return isBetLegLocked(leg);
}

function isPlacedBetLocked(bet: PlacedBet) {
  return isParentPickLocked(bet);
}

function findOddsGame(oddsGames: OddsGame[], gameId: string) {
  return oddsGames.find((game) => game.id === gameId);
}

function makeEditablePlacedLeg(
  leg: PlacedBet['bet_legs'][number],
  oddsGame: OddsGame | undefined,
  betType: BetType,
): EditingPlacedLeg {
  return {
    adjusted_line: leg.adjusted_line,
    awayTeam: oddsGame?.awayTeam ?? 'Selected',
    betLegId: leg.id,
    game_id: leg.game_id,
    game_start_time: leg.game_start_time,
    homeTeam: oddsGame?.homeTeam ?? 'Game',
    id: leg.id,
    label: formatBetLegLabel(leg, { betType, includeTeaserMovement: false }),
    leg_odds: leg.leg_odds,
    locked: isPlacedLegLocked(leg),
    market: leg.market,
    original_line: leg.original_line,
    selection: leg.selection,
    selectionKey: getLegSelectionKey(leg),
  };
}

function makeEditablePlacedLegs(bet: PlacedBet, oddsGames: OddsGame[]) {
  return bet.bet_legs.map((leg) =>
    makeEditablePlacedLeg(leg, findOddsGame(oddsGames, leg.game_id), bet.bet_type),
  );
}

function makeEditedPlacedLeg(
  currentLeg: EditingPlacedLeg,
  game: OddsGame,
  selection: OddsSelection,
  adjustedLine = selection.line,
): EditingPlacedLeg {
  const nextLeg = makeSlipLeg(game, selection, adjustedLine);

  return {
    ...nextLeg,
    betLegId: currentLeg.betLegId,
    id: currentLeg.id,
    locked: currentLeg.locked,
  };
}

function editableLegToSubmissionLeg(leg: EditingPlacedLeg): BetEditSubmissionLeg {
  return {
    adjusted_line: leg.adjusted_line,
    game_id: leg.game_id,
    game_start_time: leg.game_start_time,
    id: leg.betLegId,
    leg_odds: leg.leg_odds,
    market: leg.market,
    original_line: leg.original_line,
    selection: leg.selection,
  };
}

function makeStraightBet(game: OddsGame, selection: OddsSelection, amount: number): SlipBet {
  const leg = makeSlipLeg(game, selection);
  const reward = calculatePotentialPayout(amount, selection.odds);

  return {
    amount,
    bet_type: 'straight',
    id: `straight:${leg.id}`,
    is_lock: false,
    label: leg.label,
    legs: [leg],
    odds: selection.odds,
    potential_payout: reward,
    teaser_points: null,
  };
}

function calculateParlayDecimalOdds(legs: SlipLeg[]) {
  return legs.reduce((product, leg) => product * americanOddsToDecimal(leg.leg_odds), 1);
}

function getParlayOdds(legs: SlipLeg[]) {
  return decimalOddsToAmerican(calculateParlayDecimalOdds(legs));
}

function calculateParlayReward(amount: number, legs: SlipLeg[]) {
  const rawReward = Number((amount * calculateParlayDecimalOdds(legs)).toFixed(2));
  return {
    cappedReward: Math.min(rawReward, PARLAY_PAYOUT_CAP),
    rawReward,
  };
}

function getSlipBetPayoutForAmount(bet: SlipBet, amount: number) {
  if (bet.bet_type === 'parlay') {
    return calculateParlayReward(amount, bet.legs).cappedReward;
  }

  return calculatePotentialPayout(amount, bet.odds);
}

function updateSlipBetAmount(bet: SlipBet, amount: number): SlipBet {
  const roundedAmount = Number(amount.toFixed(2));

  if (bet.bet_type === 'parlay') {
    const { cappedReward, rawReward } = calculateParlayReward(roundedAmount, bet.legs);
    return {
      ...bet,
      amount: roundedAmount,
      potential_payout: cappedReward,
      rawPotentialReward: rawReward,
    };
  }

  return {
    ...bet,
    amount: roundedAmount,
    potential_payout: calculatePotentialPayout(roundedAmount, bet.odds),
  };
}

function getEditedPlacedBetMetrics(bet: PlacedBet, legs: EditingPlacedLeg[]) {
  if (bet.bet_type === 'parlay') {
    const { cappedReward, rawReward } = calculateParlayReward(bet.amount, legs);
    return {
      odds: getParlayOdds(legs),
      potential_payout: cappedReward,
      rawPotentialReward: rawReward,
      teaser_points: null,
    };
  }

  if (bet.bet_type === 'teaser') {
    const odds = bet.teaser_points ? getTeaserOdds(legs.length, bet.teaser_points) : null;
    return {
      odds: odds ?? bet.odds,
      potential_payout: odds ? calculatePotentialPayout(bet.amount, odds) : bet.potential_payout,
      rawPotentialReward: undefined,
      teaser_points: bet.teaser_points,
    };
  }

  const odds = legs[0]?.leg_odds ?? bet.odds;
  return {
    odds,
    potential_payout: calculatePotentialPayout(bet.amount, odds),
    rawPotentialReward: undefined,
    teaser_points: null,
  };
}

function getTeaserOdds(legCount: number, teaserPoints: TeaserPoints) {
  if (legCount < TEASER_MIN_LEGS || legCount > TEASER_MAX_LEGS) {
    return null;
  }

  return TEASER_ODDS_LOOKUP[legCount as TeaserLegCount][teaserPoints];
}

function getAdjustedTeaserLine(selection: OddsSelection, teaserPoints: TeaserPoints) {
  if (selection.line === null) {
    return null;
  }

  if (selection.market === 'spread') {
    return Number((selection.line + teaserPoints).toFixed(1));
  }

  if (selection.market === 'over_under') {
    const isOver = selection.selection.toLowerCase() === 'over';
    return Number((selection.line + (isOver ? -teaserPoints : teaserPoints)).toFixed(1));
  }

  return selection.line;
}

function formatLine(value: number | null) {
  if (value === null) {
    return '-';
  }

  return value > 0 ? `+${value}` : `${value}`;
}

// Splits the formatted game time into a short weekday/date + clock-time pair so
// the game card can present them as two stacked, clearly readable elements.
function getGameDateParts(isoDate: string) {
  const date = new Date(isoDate);
  const dayLabel = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return { dayLabel, timeLabel };
}

function formatUpcomingSlateDate(isoDate: string | null | undefined) {
  if (!isoDate) {
    return null;
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (date.getTime() <= Date.now()) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    weekday: 'short',
  }).format(date);
}

function LockBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-full border border-gold/55 bg-gold/15',
        compact ? 'px-2 py-0.5' : 'px-3 py-1',
      )}
      style={{
        shadowColor: THEME_COLORS.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      }}>
      <Ionicons color={THEME_COLORS.gold} name="star" size={compact ? 10 : 12} />
      <Text
        className={cn('font-black uppercase text-gold', compact ? 'text-[9px]' : 'text-[10px]')}
        style={{ letterSpacing: compact ? 1 : 1.4 }}>
        Pick of the Week 1.5x
      </Text>
    </View>
  );
}

function getPickAmountError(amountText: string) {
  if (amountText.length === 0) return undefined;

  const amount = Number(amountText);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Enter a valid amount.';
  }

  if (amount > MAX_SINGLE_BET) {
    return `Max single pick is ${formatCurrency(MAX_SINGLE_BET)}.`;
  }

  return undefined;
}

function formatMatchupLabel(leg: SlipLeg) {
  return `${leg.awayTeam} @ ${leg.homeTeam}`;
}

function formatLegConflictLabel(leg: SlipLeg) {
  return `${leg.label} ${formatAmericanOdds(leg.leg_odds)}`;
}

function formatConflictShortLabel(leg: SlipLeg) {
  const side = getPickConflictSide(leg);

  if (leg.market === 'moneyline') {
    return `${side} moneyline`;
  }

  if (leg.market === 'spread') {
    return `${side} spread`;
  }

  return side;
}

function formatConflictInlineLabel(leg: SlipLeg) {
  const side = getPickConflictSide(leg);

  if (leg.market === 'moneyline') {
    return `${getNflTeamShortName(side)} ML`;
  }

  if (leg.market === 'spread') {
    return `${getNflTeamShortName(side)} spread`;
  }

  return side;
}

function capitalizeSentence(value: string) {
  return value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function getSlipBetLocationLabel(bet: SlipBet) {
  if (bet.bet_type === 'straight') {
    return 'your straight pick';
  }

  return `your ${bet.legs.length}-leg ${bet.bet_type}`;
}

function getBuilderLocationLabel(mode: Extract<BetMode, 'parlay' | 'teaser'>) {
  return `this ${mode}`;
}

function getTargetSwapLabel(mode: BetMode) {
  return mode === 'straight' ? 'as a straight pick' : `in this ${mode}`;
}

function getConflictSourceLocation(source: ConflictSource) {
  return source.kind === 'builder'
    ? getBuilderLocationLabel(source.mode)
    : getSlipBetLocationLabel(source.bet);
}

function getConflictSourcePhrase(source: ConflictSource) {
  return source.kind === 'builder'
    ? `already in ${getBuilderLocationLabel(source.mode)}`
    : `already in ${getSlipBetLocationLabel(source.bet)}`;
}

function getConflictActionLabel(
  nextLeg: SlipLeg,
  existingLeg: SlipLeg,
  source: ConflictSource,
  targetMode: BetMode,
) {
  const nextLabel = formatConflictShortLabel(nextLeg);
  const existingLabel = formatConflictShortLabel(existingLeg);

  if (source.kind === 'builder' && source.mode === targetMode) {
    return `Replace ${existingLabel} with ${nextLabel}`;
  }

  return `Replace ${existingLabel} in ${getConflictSourceLocation(
    source,
  )} with ${nextLabel} ${getTargetSwapLabel(targetMode)}`;
}

function makeSelectionConflict({
  existingLeg,
  game,
  nextLeg,
  selection,
  source,
  targetMode,
}: {
  existingLeg: SlipLeg;
  game: OddsGame;
  nextLeg: SlipLeg;
  selection: OddsSelection;
  source: ConflictSource;
  targetMode: BetMode;
}): SelectionConflict {
  const nextLabel = formatConflictShortLabel(nextLeg);
  const existingLabel = formatConflictShortLabel(existingLeg);
  const reason = capitalizeSentence(formatPickConflictReason(nextLeg, existingLeg));

  return {
    actionLabel: getConflictActionLabel(nextLeg, existingLeg, source, targetMode),
    existingLeg,
    game,
    id: `${targetMode}:${nextLeg.selectionKey}:${existingLeg.selectionKey}`,
    message: `${nextLabel} conflicts with ${existingLabel} ${getConflictSourcePhrase(
      source,
    )}. ${reason}.`,
    nextLeg,
    selection,
    source,
    summary: `Blocked by ${formatConflictInlineLabel(existingLeg)}`,
    targetMode,
  };
}

function getUpdatedSlipBetAfterLegRemoval(bet: SlipBet, removedLegId: string): SlipBet | null {
  const legs = bet.legs.filter((leg) => leg.id !== removedLegId);

  if (bet.bet_type === 'straight' || legs.length === 0) {
    return null;
  }

  if (bet.bet_type === 'parlay') {
    if (legs.length < 2) {
      return null;
    }

    const { cappedReward, rawReward } = calculateParlayReward(bet.amount, legs);
    return {
      ...bet,
      id: `parlay:${legs.map((leg) => leg.id).join('|')}`,
      label: `${legs.length}-leg Parlay`,
      legs,
      odds: getParlayOdds(legs),
      potential_payout: cappedReward,
      rawPotentialReward: rawReward,
    };
  }

  if (legs.length < 2 || !bet.teaser_points) {
    return null;
  }

  const odds = getTeaserOdds(legs.length, bet.teaser_points);
  if (!odds) {
    return null;
  }

  return {
    ...bet,
    id: `teaser:${bet.teaser_points}:${legs.map((leg) => leg.id).join('|')}`,
    label: `${legs.length}-leg ${bet.teaser_points}pt Teaser`,
    legs,
    odds,
    potential_payout: calculatePotentialPayout(bet.amount, odds),
    rawPotentialReward: undefined,
  };
}

function formatAddConflictMessage(nextLeg: SlipLeg, existingLeg: SlipLeg) {
  if (getPickConflictKind(nextLeg, existingLeg) === 'same_team_moneyline_spread') {
    return `You already have ${getPickConflictSide(existingLeg)} on the ${conflictMarketLabel(
      existingLeg.market,
    )}. Same-team moneyline and spread can't be combined.`;
  }

  return `Cannot add ${formatLegConflictLabel(nextLeg)}. It directly conflicts with ${formatLegConflictLabel(
    existingLeg,
  )} on ${formatMatchupLabel(nextLeg)} because ${formatPickConflictReason(
    nextLeg,
    existingLeg,
  )}.`;
}

function getSlipLegs(slipBets: SlipBet[]) {
  return slipBets.flatMap((bet) => bet.legs);
}

function getPlacedBetConflictLegs(placedBets: PlacedBet[], editingBetId: string, oddsGames: OddsGame[]) {
  return placedBets
    .filter((bet) => bet.id !== editingBetId)
    .flatMap((bet) => makeEditablePlacedLegs(bet, oddsGames));
}

function useLockClock(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [enabled]);

  return now;
}

function getDisplayedPotentialPayout(bet: Pick<SlipBet, 'is_lock' | 'potential_payout'>) {
  return bet.is_lock
    ? bet.potential_payout * LOCK_OF_THE_WEEK_MULTIPLIER
    : bet.potential_payout;
}

function isCappedParlay(bet: Pick<SlipBet, 'bet_type' | 'potential_payout' | 'rawPotentialReward'>) {
  return bet.bet_type === 'parlay' && (bet.rawPotentialReward ?? bet.potential_payout) > PARLAY_PAYOUT_CAP;
}

function getDisplayedPlacedPayout(bet: Pick<PlacedBet, 'is_lock' | 'potential_payout'>) {
  return bet.is_lock
    ? bet.potential_payout * LOCK_OF_THE_WEEK_MULTIPLIER
    : bet.potential_payout;
}

function isCappedPlacedParlay(bet: Pick<PlacedBet, 'bet_type' | 'potential_payout'>) {
  return bet.bet_type === 'parlay' && bet.potential_payout >= PARLAY_PAYOUT_CAP;
}

function isSettledPick(result: PlacedBet['result']): result is Exclude<PlacedBet['result'], 'pending'> {
  return isSettledResult(result);
}

function getSettledReward(bet: Pick<PlacedBet, 'amount' | 'profit' | 'result'>) {
  return getRealizedReward(bet);
}

function getBetTypeLabel(type: BetType) {
  if (type === 'straight') return 'straight pick';
  return type;
}

function getConflictSummaries(slipBets: SlipBet[]) {
  const legsWithBet = slipBets.flatMap((bet) =>
    bet.legs.map((leg) => ({
      bet,
      leg,
    })),
  );
  const games = new Map<string, typeof legsWithBet>();

  legsWithBet.forEach((item) => {
    games.set(item.leg.game_id, [...(games.get(item.leg.game_id) ?? []), item]);
  });
  const contradictorySelections: string[] = [];

  [...games.values()].forEach((items) => {
    items.forEach((left, leftIndex) => {
      items.slice(leftIndex + 1).forEach((right) => {
        if (!areConflictingPicks(left.leg, right.leg)) {
          return;
        }

        const matchup = formatMatchupLabel(left.leg);
        const sources = `${getBetTypeLabel(left.bet.bet_type)} and ${getBetTypeLabel(
          right.bet.bet_type,
        )}`;
        contradictorySelections.push(
          `${formatLegConflictLabel(left.leg)} conflicts with ${formatLegConflictLabel(
            right.leg,
          )} between your ${sources} on ${matchup} because ${formatPickConflictReason(
            left.leg,
            right.leg,
          )}. Remove one.`,
        );
      });
    });
  });

  return {
    contradictorySelections,
  };
}

function getValidationState(slipBets: SlipBet[]): ValidationState {
  const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
  const lockCount = slipBets.filter((bet) => bet.is_lock).length;
  const { contradictorySelections } = getConflictSummaries(slipBets);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (slipBets.length < MINIMUM_BETS_PER_WEEK) {
    const remaining = MINIMUM_BETS_PER_WEEK - slipBets.length;
    errors.push(`Add ${remaining} more pick${remaining === 1 ? '' : 's'} to hit the weekly minimum.`);
  }

  if (lockCount === 0) {
    errors.push('Choose your Pick of the Week — every weekly card needs one 1.5x pick.');
  } else if (lockCount > 1) {
    errors.push('Only one pick can be your Pick of the Week. Tap the gold star to swap.');
  }

  if (slipBets.some((bet) => bet.amount > MAX_SINGLE_BET)) {
    errors.push(`No single pick can exceed ${formatCurrency(MAX_SINGLE_BET)}.`);
  }

  if (totalAllocated < WEEKLY_BUDGET) {
    errors.push(`Allocate ${formatCurrency(WEEKLY_BUDGET - totalAllocated)} more of your weekly budget.`);
  }

  if (totalAllocated > WEEKLY_BUDGET) {
    errors.push(`You are ${formatCurrency(totalAllocated - WEEKLY_BUDGET)} over the weekly budget.`);
  }

  errors.push(...contradictorySelections);

  slipBets.forEach((bet) => {
    if (bet.bet_type === 'parlay') {
      if (bet.legs.length < 2 || bet.legs.length > 6) {
        errors.push('Parlays must have between 2 and 6 legs.');
      }
      if ((bet.rawPotentialReward ?? bet.potential_payout) > PARLAY_PAYOUT_CAP) {
        warnings.push('Payout capped at 500 coins to keep leagues competitive.');
      }
    }

    if (bet.bet_type === 'teaser') {
      if (bet.legs.length < 2 || bet.legs.length > 4) {
        errors.push('Teasers must have between 2 and 4 legs.');
      }
      if (bet.legs.some((leg) => leg.market === 'moneyline')) {
        errors.push('Teasers can only use spreads and over/unders.');
      }
    }
  });

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}

function findCaptureGame(oddsGames: OddsGame[], gameId: string) {
  return oddsGames.find((game) => game.id === gameId) ?? null;
}

function findCaptureSelection(game: OddsGame | null, market: BetMarket, selectionName: string) {
  return game?.markets[market].find((selection) => selection.selection === selectionName) ?? null;
}

function makeCaptureStraight(
  oddsGames: OddsGame[],
  gameId: string,
  market: BetMarket,
  selectionName: string,
  amount: number,
): SlipBet | null {
  const game = findCaptureGame(oddsGames, gameId);
  const selection = findCaptureSelection(game, market, selectionName);

  if (!game || !selection) {
    return null;
  }

  return makeStraightBet(game, selection, amount);
}

function makeCaptureParlay(
  oddsGames: OddsGame[],
  amount: number,
  legs: Array<{ gameId: string; market: BetMarket; selectionName: string }>,
): SlipBet | null {
  const slipLegs = legs
    .map(({ gameId, market, selectionName }) => {
      const game = findCaptureGame(oddsGames, gameId);
      const selection = findCaptureSelection(game, market, selectionName);
      return game && selection ? makeSlipLeg(game, selection) : null;
    })
    .filter((leg): leg is SlipLeg => leg !== null);

  if (slipLegs.length !== legs.length || slipLegs.length < 2) {
    return null;
  }

  const { cappedReward, rawReward } = calculateParlayReward(amount, slipLegs);
  return {
    amount,
    bet_type: 'parlay',
    id: `capture-parlay:${slipLegs.map((leg) => leg.id).join('|')}`,
    is_lock: false,
    label: `${slipLegs.length}-leg Parlay`,
    legs: slipLegs,
    odds: getParlayOdds(slipLegs),
    potential_payout: cappedReward,
    rawPotentialReward: rawReward,
    teaser_points: null,
  };
}

function makeCaptureTeaser(
  oddsGames: OddsGame[],
  amount: number,
  teaserPoints: TeaserPoints,
  legs: Array<{ gameId: string; market: Exclude<BetMarket, 'moneyline'>; selectionName: string }>,
): SlipBet | null {
  const slipLegs = legs
    .map(({ gameId, market, selectionName }) => {
      const game = findCaptureGame(oddsGames, gameId);
      const selection = findCaptureSelection(game, market, selectionName);
      return game && selection ? makeSlipLeg(game, selection, getAdjustedTeaserLine(selection, teaserPoints)) : null;
    })
    .filter((leg): leg is SlipLeg => leg !== null);
  const odds = getTeaserOdds(slipLegs.length, teaserPoints);

  if (slipLegs.length !== legs.length || odds === null) {
    return null;
  }

  return {
    amount,
    bet_type: 'teaser',
    id: `capture-teaser:${teaserPoints}:${slipLegs.map((leg) => leg.id).join('|')}`,
    is_lock: false,
    label: `${slipLegs.length}-leg ${teaserPoints}pt Teaser`,
    legs: slipLegs,
    odds,
    potential_payout: calculatePotentialPayout(amount, odds),
    teaser_points: teaserPoints,
  };
}

function makeAppStoreCaptureSlip(oddsGames: OddsGame[], mode: AppStoreCaptureMode): SlipBet[] {
  if (mode === 'hook_prefill') {
    const hookBet = makeCaptureStraight(
      oddsGames,
      'mock_nfl_w01_bal_pit',
      'moneyline',
      'Baltimore Ravens',
      20,
    );
    return hookBet ? [hookBet] : [];
  }

  const straightPackers = makeCaptureStraight(
    oddsGames,
    'mock_nfl_w01_min_gb',
    'moneyline',
    'Green Bay Packers',
    20,
  );
  const featuredParlay = makeCaptureParlay(oddsGames, 20, [
    { gameId: 'mock_nfl_w01_buf_nyj', market: 'spread', selectionName: 'Buffalo Bills' },
    { gameId: 'mock_nfl_w01_cin_cle', market: 'moneyline', selectionName: 'Cincinnati Bengals' },
  ]);
  const teaser = makeCaptureTeaser(oddsGames, 20, 6, [
    { gameId: 'mock_nfl_w01_tb_no', market: 'spread', selectionName: 'Tampa Bay Buccaneers' },
    { gameId: 'mock_nfl_w01_was_nyg', market: 'over_under', selectionName: 'Over' },
  ]);
  const straightCowboys = makeCaptureStraight(
    oddsGames,
    'mock_nfl_w01_dal_phi',
    'moneyline',
    'Dallas Cowboys',
    20,
  );
  const straightRavens = makeCaptureStraight(
    oddsGames,
    'mock_nfl_w01_bal_pit',
    'moneyline',
    'Baltimore Ravens',
    20,
  );

  if (!straightPackers || !featuredParlay || !teaser || !straightCowboys || !straightRavens) {
    return [];
  }

  return [
    straightPackers,
    { ...featuredParlay, is_lock: true },
    teaser,
    straightCowboys,
    straightRavens,
  ];
}

// ============================================================
// Header
// ============================================================

function BoardHeader({
  league,
  weekNumber,
}: {
  league: LeagueRow | undefined;
  weekNumber: number | undefined;
}) {
  return (
    <View>
      <View className="flex-row items-center gap-2">
        <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
        <Text
          className="text-[11px] font-semibold uppercase text-electric-green"
          style={{ letterSpacing: 1.2 }}>
          {league && weekNumber ? `Week ${weekNumber}` : 'Week —'}
        </Text>
      </View>
      <Text
        className="mt-1 text-2xl font-extrabold text-white"
        style={{ letterSpacing: -0.4 }}>
        Pick Board
      </Text>
      <Text className="mt-1 text-sm font-medium text-white/55">
        Stack straights, parlays, and teasers across the slate.
      </Text>
    </View>
  );
}

function FutureWeekBoardPlaceholder({ weekNumber }: { weekNumber: number }) {
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
          Week {weekNumber} is not open yet. The lineup builder will unlock when
          the slate is released.
        </Text>
      </View>
    </Card>
  );
}

function NoActiveSlateCard({ revealAt }: { revealAt: string | null | undefined }) {
  const nextSlateLabel = formatUpcomingSlateDate(revealAt);

  return (
    <Card>
      <View className="items-center gap-3 py-5">
        <View className="h-14 w-14 items-center justify-center rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10">
          <Ionicons color={THEME_COLORS.cyanAccent} name="calendar-clear" size={24} />
        </View>
        <Text
          className="text-center text-xl font-black uppercase text-white"
          style={{ letterSpacing: -0.3 }}>
          {nextSlateLabel ? 'Next Slate Opens Soon' : 'Season Starts Soon'}
        </Text>
        <Text className="px-2 text-center text-sm font-semibold leading-5 text-white/55">
          {nextSlateLabel
            ? `Next slate opens ${nextSlateLabel}. No current NFL games are available for picks yet.`
            : 'No active NFL slate is available right now. When the next week opens, games and lines will appear here.'}
        </Text>
      </View>
    </Card>
  );
}

// ============================================================
// Budget Tracker
// ============================================================

function BudgetTracker({
  placedBets,
  slipBets,
}: {
  placedBets?: PlacedBet[];
  slipBets: SlipBet[];
}) {
  const displayedBets = placedBets ?? slipBets;
  const totalAllocated = displayedBets.reduce((sum, bet) => sum + bet.amount, 0);
  const remaining = WEEKLY_BUDGET - totalAllocated;
  const overBudget = remaining < 0;

  const minimumMet = displayedBets.length >= MINIMUM_BETS_PER_WEEK;
  const fullyAllocated = totalAllocated === WEEKLY_BUDGET;

  const progress = Math.min(Math.max(totalAllocated / WEEKLY_BUDGET, 0), 1);
  const barColor = overBudget
    ? THEME_COLORS.coralRed
    : fullyAllocated
      ? THEME_COLORS.electricGreen
      : progress > 0.95
        ? THEME_COLORS.coralRed
        : progress > 0.65
          ? THEME_COLORS.amberAccent
          : THEME_COLORS.electricGreen;

  return (
    <Card tone="highlight">
      <View className="gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View>
            <Text
              className="text-[10px] font-black uppercase text-white/50"
              style={{ letterSpacing: 2 }}>
              Weekly Budget
            </Text>
            <View className="mt-1 flex-row items-baseline">
              <AnimatedNumber
                className="text-3xl font-black text-white"
                suffix=" coins"
                style={{ letterSpacing: -0.8 }}
                value={totalAllocated}
                decimals={0}
              />
              <Text className="text-base font-black text-white/40" style={{ letterSpacing: -0.4 }}>
                {' / '}
                {formatCurrency(WEEKLY_BUDGET)}
              </Text>
            </View>
          </View>
          <View
            className={cn(
              'flex-row items-center gap-1 rounded-full border px-3 py-1.5',
              minimumMet
                ? 'border-electric-green/55 bg-electric-green/20'
                : 'border-amber-accent/45 bg-amber-accent/15',
            )}
            style={{
              shadowColor: minimumMet ? THEME_COLORS.electricGreen : THEME_COLORS.amberAccent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: minimumMet ? 0.45 : 0.25,
              shadowRadius: 8,
            }}>
            <Ionicons
              color={minimumMet ? THEME_COLORS.electricGreen : THEME_COLORS.amberAccent}
              name={minimumMet ? 'checkmark-circle' : 'alert-circle'}
              size={12}
            />
            <Text
              className={cn(
                'text-[10px] font-black uppercase',
                minimumMet ? 'text-electric-green' : 'text-amber-accent',
              )}
              style={{ letterSpacing: 1.5 }}>
              {displayedBets.length}/{MINIMUM_BETS_PER_WEEK} picks
            </Text>
          </View>
        </View>

        <AnimatedBar color={barColor} height={12} progress={progress} />

        <View className="flex-row items-center justify-between">
          <Text
            className="text-[11px] font-black uppercase text-white/50"
            style={{ letterSpacing: 1.5 }}>
            {overBudget ? 'Over Budget' : fullyAllocated ? 'Fully Allocated' : 'Remaining'}
          </Text>
          <AnimatedNumber
            className={cn(
              'text-base font-black',
              overBudget
                ? 'text-coral-red'
                : fullyAllocated
                  ? 'text-electric-green'
                  : remaining > 50
                    ? 'text-electric-green'
                    : remaining > 20
                      ? 'text-gold'
                      : 'text-amber-accent',
            )}
            prefix={remaining < 0 ? '-' : ''}
            suffix=" coins"
            style={{ letterSpacing: -0.3 }}
            value={Math.abs(remaining)}
            decimals={0}
          />
        </View>
      </View>
    </Card>
  );
}

// ============================================================
// League Selector
// ============================================================

function LeagueSelector({
  leagues,
  selectedLeagueId,
  onSelect,
}: {
  leagues: LeagueRow[];
  onSelect: (leagueId: string) => void;
  selectedLeagueId: string | undefined;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (leagues.length <= 1) {
    return null;
  }

  const selected = leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0];

  return (
    <View className="gap-2">
      <Text
        className="text-[10px] font-black uppercase text-white/50"
        style={{ letterSpacing: 2 }}>
        Active League
      </Text>
      <PressableScale
        onPress={() => {
          haptics.selection();
          setPickerOpen(true);
        }}
        pressedScale={0.97}>
        <View
          className="flex-row items-center justify-between rounded-2xl border border-electric-green/35 bg-electric-green/[0.08] px-4 py-3"
          style={{
            shadowColor: THEME_COLORS.electricGreen,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
          }}>
          <View className="flex-1 flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-xl border border-electric-green/40 bg-electric-green/15">
              <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={14} />
            </View>
            <View className="flex-1">
              <Text
                className="text-[10px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 1.5 }}>
                Picking for
              </Text>
              <Text
                className="text-base font-black text-white"
                numberOfLines={1}
                style={{ letterSpacing: -0.3 }}>
                {selected.name}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5">
              <Text
                className="text-[10px] font-black uppercase text-white/65"
                style={{ letterSpacing: 1 }}>
                {leagues.length}
              </Text>
            </View>
            <Ionicons color="rgba(255,255,255,0.6)" name="chevron-down" size={16} />
          </View>
        </View>
      </PressableScale>

      <Modal
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
        transparent
        visible={pickerOpen}>
        <ModalShell variant="overlay">
        <Pressable
          accessibilityRole="button"
          className="flex-1 justify-center bg-black/75 px-5"
          onPress={() => setPickerOpen(false)}>
          <Pressable accessibilityRole="none" onPress={() => undefined}>
            <Card>
              <View className="gap-4">
                <View>
                  <Text
                    className="text-[10px] font-black uppercase text-electric-green"
                    style={{ letterSpacing: 2 }}>
                    Switch League
                  </Text>
                  <Text
                    className="mt-1 text-2xl font-black uppercase text-white"
                    style={{ letterSpacing: -0.4 }}>
                    Pick Where to Play
                  </Text>
                </View>
                <ScrollView style={{ maxHeight: 360 }}>
                  <View className="gap-2">
                    {leagues.map((league) => {
                      const isSelected = league.id === selected.id;
                      return (
                        <PressableScale
                          key={league.id}
                          onPress={() => {
                            haptics.selection();
                            onSelect(league.id);
                            setPickerOpen(false);
                          }}
                          pressedScale={0.97}>
                          <View
                            className={cn(
                              'flex-row items-center justify-between rounded-2xl border px-4 py-3',
                              isSelected
                                ? 'border-electric-green/60 bg-electric-green/15'
                                : 'border-white/10 bg-white/[0.04]',
                            )}>
                            <View className="flex-1 pr-2">
                              <Text
                                className={cn(
                                  'text-sm font-black uppercase',
                                  isSelected ? 'text-electric-green' : 'text-white',
                                )}
                                numberOfLines={2}
                                style={{ letterSpacing: 0.4 }}>
                                {league.name}
                              </Text>
                              <Text
                                className="mt-1 text-[11px] font-semibold text-white/45"
                                numberOfLines={1}>
                                Week {league.current_week} ·{' '}
                                {league.type === 'h2h' ? 'Head-to-Head' : 'Cumulative'}
                              </Text>
                            </View>
                            <Ionicons
                              color={
                                isSelected ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.35)'
                              }
                              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                              size={22}
                            />
                          </View>
                        </PressableScale>
                      );
                    })}
                  </View>
                </ScrollView>
                <Button
                  onPress={() => setPickerOpen(false)}
                  title="Close"
                  variant="secondary"
                />
              </View>
            </Card>
          </Pressable>
        </Pressable>
        </ModalShell>
      </Modal>
    </View>
  );
}

function PickConflictNotice({
  actionLabel,
  message,
  onAction,
  onDismiss,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  return (
    <View className="rounded-2xl border border-coral-red/35 bg-coral-red/10 p-3">
      <View className="flex-row items-start gap-2">
        <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={16} />
        <View className="flex-1 gap-2">
          <Text className="text-sm font-semibold leading-5 text-coral-red">
            {message}
          </Text>
          {actionLabel && onAction ? (
            <Pressable
              accessibilityLabel={actionLabel}
              accessibilityRole="button"
              onPress={onAction}>
              <View className="self-start rounded-full border border-coral-red/45 bg-coral-red/15 px-3 py-1.5">
                <Text
                  className="text-[10px] font-black uppercase text-coral-red"
                  style={{ letterSpacing: 1.1 }}>
                  {actionLabel}
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel="Dismiss pick conflict message"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDismiss}>
          <Ionicons color={THEME_COLORS.coralRed} name="close" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// Game Card
// ============================================================

// Tiny round logo chip. For team-based markets it loads the team's ESPN logo;
// for over/under it keeps the existing up/down market icon.
function OddsLogoChip({
  isSelected,
  selection,
}: {
  isSelected: boolean;
  selection: OddsSelection;
}) {
  if (selection.market === 'over_under') {
    const isOver = selection.selection.toLowerCase().startsWith('over');
    return (
      <View
        className="h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]"
        style={{
          backgroundColor: isSelected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
        }}>
        <Ionicons
          color="rgba(255,255,255,0.92)"
          name={isOver ? 'arrow-up' : 'arrow-down'}
          size={14}
        />
      </View>
    );
  }

  return <NflTeamLogo size={28} teamName={selection.selection || selection.shortName} />;
}

function OddsButton({
  conflictMessage,
  conflictSummary,
  disabled,
  isSelected,
  mode,
  onPress,
  selection,
  teaserPoints,
}: {
  conflictMessage?: string;
  conflictSummary?: string;
  disabled?: boolean;
  isSelected: boolean;
  mode: BetMode;
  onPress: () => void;
  selection: OddsSelection;
  teaserPoints?: TeaserPoints;
}) {
  const tone = getModeTone(mode);
  const accentHex = modeAccentHex(mode);
  const isTeaserMode = mode === 'teaser' && teaserPoints !== undefined;
  const primaryLabel = isTeaserMode
    ? getTeaserOddsButtonLabel(selection, teaserPoints)
    : getOddsButtonLabel(selection);
  // Odds always read in the electric-green action color so the odds value pops
  // against the white selection label — when selected, the value flips to the
  // active mode accent so the chosen pick reads as a single colored unit.
  const oddsColor = isSelected ? accentHex : THEME_COLORS.electricGreen;
  const inactiveBorderColor =
    tone === 'amber'
      ? 'rgba(255,165,2,0.20)'
      : tone === 'cyan'
        ? 'rgba(24,220,255,0.20)'
        : 'rgba(255,255,255,0.08)';
  const buttonStateStyle = isSelected
    ? {
        backgroundColor: `${accentHex}2E`,
        borderColor: accentHex,
        borderWidth: 2,
        shadowColor: accentHex,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
      }
    : null;
  const conflict = Boolean(conflictSummary && !isSelected);
  const baseAccessibilityLabel = isTeaserMode
    ? primaryLabel
    : `${primaryLabel} ${formatAmericanOdds(selection.odds)}`;

  return (
    <PressableScale
      accessibilityHint={conflict ? conflictMessage : undefined}
      accessibilityLabel={
        conflict ? `${baseAccessibilityLabel}. ${conflictSummary}. Tap for details.` : baseAccessibilityLabel
      }
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected: isSelected }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.96}
      style={({ pressed }) => ({
        alignSelf: 'stretch',
        flex: 1,
        flexBasis: 0,
        minHeight: conflict ? 84 : 68,
        minWidth: 0,
        opacity: disabled || conflict ? 0.36 : pressed ? 0.92 : 1,
        width: '100%',
      })}>
      <View
        pointerEvents="none"
        style={[
          {
            backgroundColor: isSelected ? `${accentHex}2E` : 'rgba(255,255,255,0.04)',
            borderColor: conflict
              ? 'rgba(255,71,87,0.45)'
              : isSelected
                ? accentHex
                : inactiveBorderColor,
            borderRadius: 16,
            borderWidth: isSelected || conflict ? 2 : 1,
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            minHeight: conflict ? 84 : 68,
            paddingHorizontal: 10,
            paddingVertical: 12,
            shadowColor: isSelected ? accentHex : '#000',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isSelected ? 0.55 : 0,
            shadowRadius: isSelected ? 12 : 0,
            width: '100%',
          },
          buttonStateStyle,
        ]}>
        <OddsLogoChip isSelected={isSelected} selection={selection} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={{
              color: 'rgba(255,255,255,0.96)',
              fontSize: 16,
              fontWeight: '900',
              includeFontPadding: false,
              letterSpacing: 0,
              lineHeight: 19,
            }}>
            {primaryLabel}
          </Text>
          {!isTeaserMode ? (
            <Text
              numberOfLines={1}
              style={{
                color: oddsColor,
                fontSize: 14,
                fontWeight: '900',
                includeFontPadding: false,
                letterSpacing: 0,
                lineHeight: 18,
                marginTop: 4,
              }}>
              {formatAmericanOdds(selection.odds)}
            </Text>
          ) : null}
          {conflict ? (
            <View
              className="mt-1 flex-row items-center gap-1 rounded-full border border-coral-red/45 bg-coral-red/15 px-2 py-1"
              style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
              <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={10} />
              <Text
                numberOfLines={1}
                style={{
                  color: THEME_COLORS.coralRed,
                  flexShrink: 1,
                  fontSize: 10,
                  fontWeight: '900',
                  includeFontPadding: false,
                  letterSpacing: 0,
                  lineHeight: 12,
                }}>
                {conflictSummary}
              </Text>
            </View>
          ) : null}
        </View>
        {isSelected ? (
          <View style={{ marginLeft: 2 }}>
            <Ionicons color={accentHex} name="checkmark-circle" size={14} />
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

function GameCard({
  builderLegSelectionKeys,
  game,
  getSelectionConflict,
  market,
  mode,
  onMarketChange,
  onSelect,
  readOnly,
  teaserPoints,
}: {
  builderLegSelectionKeys: Set<string>;
  game: OddsGame;
  getSelectionConflict: (game: OddsGame, selection: OddsSelection) => SelectionConflict | null;
  market: BetMarket;
  mode: BetMode;
  onMarketChange: (market: BetMarket) => void;
  onSelect: (selection: OddsSelection) => void;
  readOnly: boolean;
  teaserPoints: TeaserPoints;
}) {
  const resolvedMarket = mode === 'teaser' && market === 'moneyline' ? 'spread' : market;
  const selections = game.markets[resolvedMarket];
  const accentHex = modeAccentHex(mode);
  const { dayLabel, timeLabel } = getGameDateParts(game.commenceTime);

  const marketOptions = useMemo(
    () =>
      MARKET_OPTIONS.filter((option) => mode !== 'teaser' || option.value !== 'moneyline').map(
        (option) => ({
          ...option,
          accent: getModeTone(mode),
        }),
      ),
    [mode],
  );

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <View className="flex-row items-center gap-2">
            <Text
              className="text-[10px] font-black uppercase text-white/45"
              style={{ letterSpacing: 1.5 }}>
              NFL · {dayLabel}
            </Text>
            <View className="h-1 w-1 rounded-full bg-white/20" />
            <Text
              className="text-[10px] font-black uppercase text-white/55"
              style={{ letterSpacing: 1.1 }}>
              {timeLabel}
            </Text>
          </View>
          <Text
            className="text-[19px] font-black uppercase text-white"
            numberOfLines={2}
            style={{ letterSpacing: -0.3, lineHeight: 22 }}>
            {game.awayTeam}
            <Text style={{ color: accentHex }}>{'  @  '}</Text>
            {game.homeTeam}
          </Text>
        </View>

        <SegmentedToggle
          accent={getModeTone(mode)}
          compact
          onChange={(value) => {
            haptics.selection();
            onMarketChange(value);
          }}
          options={marketOptions}
          value={resolvedMarket}
        />

        {selections.length === 0 ? (
          <View className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <Text className="text-sm font-semibold text-white/50">
              {marketLabel(resolvedMarket)} lines aren't published for this game yet.
            </Text>
          </View>
        ) : (
          <View
            style={{
              alignItems: 'stretch',
              alignSelf: 'stretch',
              flexDirection: 'row',
              gap: ODDS_BUTTON_GAP,
              width: '100%',
            }}>
            {selections.map((selection) => {
              const key = getSelectionKey(game.id, selection);
              const isSelected = builderLegSelectionKeys.has(key);
              const conflict = isSelected ? null : getSelectionConflict(game, selection);
              return (
                <View
                  key={`${selection.market}:${selection.selection}:${selection.line ?? 'na'}`}
                  style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
                  <OddsButton
                    conflictMessage={conflict?.message}
                    conflictSummary={conflict?.summary}
                    disabled={readOnly}
                    isSelected={isSelected}
                    mode={mode}
                    selection={selection}
                    teaserPoints={teaserPoints}
                    onPress={() => onSelect(selection)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Card>
  );
}

// ============================================================
// Builder leg row
// ============================================================

function getSelectedTeamLogoName(leg: SlipLeg) {
  return getPickLogoLabel(leg);
}

function BuilderLegRow({
  leg,
  onRemove,
  teaserPoints,
}: {
  leg: SlipLeg;
  onRemove?: (id: string) => void;
  teaserPoints?: TeaserPoints;
}) {
  const isLocked = isBetLegLocked({ game_start_time: leg.game_start_time, locked: false });
  const accent = teaserPoints ? 'text-cyan-accent' : 'text-white/65';
  const isTotal = leg.market === 'over_under';
  const isOver = leg.selection.toLowerCase().startsWith('over');

  return (
    <View className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
      <View className="flex-row justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2.5">
          {isTotal ? (
            <View className="h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
              <Ionicons
                color="rgba(255,255,255,0.86)"
                name={isOver ? 'arrow-up' : 'arrow-down'}
                size={13}
              />
            </View>
          ) : (
            <NflTeamLogo size={24} teamName={getSelectedTeamLogoName(leg)} />
          )}
          <View className="flex-1 gap-1">
            <Text className="text-sm font-black text-white" numberOfLines={1}>
              {leg.label}
            </Text>
            <Text className="text-[11px] font-semibold text-white/45" numberOfLines={1}>
              {leg.awayTeam} at {leg.homeTeam}
            </Text>
          </View>
        </View>
        <View className="items-end gap-2">
          {/* Only surface a status pill once the leg's game has kicked off —
              while the slate is open, every leg is implicitly editable so the
              redundant "Open" pill just adds visual clutter next to Remove. */}
          {isLocked ? <Badge label="Closed" tone="red" /> : null}
          {onRemove ? (
            <Pressable
              accessibilityLabel="Remove leg"
              hitSlop={8}
              onPress={() => {
                haptics.light();
                onRemove(leg.id);
              }}>
              <View className="flex-row items-center gap-1">
                <Ionicons color={THEME_COLORS.coralRed} name="close-circle" size={14} />
                <Text
                  className="text-[10px] font-black uppercase text-coral-red"
                  style={{ letterSpacing: 1.2 }}>
                  Remove
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>

      {teaserPoints ? (
        <View className="mt-2 flex-row items-center gap-2">
          <Text className={cn('text-xs font-black', accent)} style={{ letterSpacing: 0.4 }}>
            {formatLine(leg.original_line)}
          </Text>
          <View className="flex-row items-center gap-1">
            <Ionicons color={THEME_COLORS.cyanAccent} name="arrow-forward" size={11} />
            <Text
              className="text-xs font-black text-cyan-accent"
              style={{ letterSpacing: 0.4 }}>
              {formatLine(leg.adjusted_line)}
            </Text>
          </View>
          <Text className="text-[10px] font-semibold text-white/45">
            ({teaserPoints}pt teaser)
          </Text>
        </View>
      ) : (
        <Text
          className="mt-2 text-[11px] font-black text-white/55"
          style={{ letterSpacing: 0.6 }}>
          {marketLabel(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
        </Text>
      )}
    </View>
  );
}

// ============================================================
// Parlay Builder
// ============================================================

function ParlayBuilder({
  amountText,
  legs,
  onAddToSlip,
  onAmountChange,
  onRemoveLeg,
}: {
  amountText: string;
  legs: SlipLeg[];
  onAddToSlip: () => void;
  onAmountChange: (amount: string) => void;
  onRemoveLeg: (id: string) => void;
}) {
  const amount = Number(amountText);
  const odds = legs.length > 0 ? getParlayOdds(legs) : 0;
  const { cappedReward, rawReward } =
    legs.length > 0 && Number.isFinite(amount)
      ? calculateParlayReward(amount || 0, legs)
      : { cappedReward: 0, rawReward: 0 };
  const amountError = getPickAmountError(amountText);
  const canAdd =
    legs.length >= 2 &&
    legs.length <= 6 &&
    !amountError &&
    Number.isFinite(amount) &&
    amount > 0;
  const overCap = rawReward > PARLAY_PAYOUT_CAP;

  return (
    <View>
      <Card>
        <View className="gap-5">
          <View className="flex-row items-center justify-between">
            <View>
              <View className="flex-row items-center gap-2">
                <Ionicons color={THEME_COLORS.amberAccent} name="link" size={16} />
                <Text
                  className="text-[10px] font-black uppercase text-amber-accent"
                  style={{ letterSpacing: 2.5 }}>
                  Parlay Builder
                </Text>
              </View>
              <Text
                className="mt-1 text-2xl font-black uppercase text-white"
                style={{ letterSpacing: -0.4 }}>
                Stack the Chain
              </Text>
            </View>
            <Badge label={`${legs.length}/6 legs`} tone="amber" />
          </View>

          <View
            className="rounded-2xl border border-amber-accent/30 bg-amber-accent/10 p-4"
            style={{
              shadowColor: THEME_COLORS.amberAccent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
            }}>
            <View className="flex-row items-end justify-between">
              <View>
                <Text
                  className="text-[10px] font-black uppercase text-amber-accent"
                  style={{ letterSpacing: 2 }}>
                  Combo Value
                </Text>
                <Text
                  className="text-5xl font-black text-amber-accent"
                  style={{ letterSpacing: -1.2 }}>
                  {legs.length > 0 ? formatAmericanOdds(odds) : '—'}
                </Text>
              </View>
              <View className="items-end">
                <Text
                  className="text-[10px] font-black uppercase text-white/45"
                  style={{ letterSpacing: 2 }}>
                  Reward
                </Text>
                <AnimatedNumber
                  className="text-2xl font-black text-white"
                  decimals={0}
                  suffix=" coins"
                  style={{ letterSpacing: -0.5 }}
                  value={cappedReward}
                />
              </View>
            </View>
          </View>

          {overCap ? (
            <View className="flex-row items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <Ionicons color={THEME_COLORS.amberAccent} name="information-circle" size={16} />
              <Text className="flex-1 text-xs font-semibold text-white/65">
                Payout capped at 500 coins to keep leagues competitive.
              </Text>
            </View>
          ) : null}

          {legs.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] py-6">
              <Ionicons color={THEME_COLORS.amberAccent} name="add-circle-outline" size={28} />
              <Text className="mt-2 text-sm font-semibold text-white/55">
                Tap values to add non-conflicting legs.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {legs.map((leg, index) => (
                <View key={leg.id} className="flex-row items-stretch gap-2">
                  <View className="w-8 items-center pt-3">
                    <View className="h-7 w-7 items-center justify-center rounded-full border border-amber-accent/40 bg-amber-accent/15">
                      <Text
                        className="text-xs font-black text-amber-accent"
                        style={{ letterSpacing: -0.3 }}>
                        {index + 1}
                      </Text>
                    </View>
                    {index < legs.length - 1 ? (
                      <View className="mt-1 h-full w-[2px] flex-1 rounded-full bg-amber-accent/25" />
                    ) : null}
                  </View>
                  <View className="flex-1">
                    <BuilderLegRow leg={leg} onRemove={onRemoveLeg} />
                  </View>
                </View>
              ))}
            </View>
          )}

          <TextInput
            error={amountError}
            keyboardType="decimal-pad"
            label="Parlay amount"
            onChangeText={onAmountChange}
            placeholder="20"
            value={amountText}
          />
          <Button
            disabled={!canAdd}
            onPress={() => {
              haptics.medium();
              onAddToSlip();
            }}
            title="Add Parlay to Lineup"
            variant="secondary"
          />
        </View>
      </Card>
    </View>
  );
}

// ============================================================
// Teaser Builder
// ============================================================

function TeaserBuilder({
  amountText,
  legs,
  onAddToSlip,
  onAmountChange,
  onRemoveLeg,
  onTeaserPointsChange,
  teaserPoints,
}: {
  amountText: string;
  legs: SlipLeg[];
  onAddToSlip: () => void;
  onAmountChange: (amount: string) => void;
  onRemoveLeg: (id: string) => void;
  onTeaserPointsChange: (points: TeaserPoints) => void;
  teaserPoints: TeaserPoints;
}) {
  const amount = Number(amountText);
  const odds = getTeaserOdds(legs.length, teaserPoints);
  const reward = odds && Number.isFinite(amount) ? calculatePotentialPayout(amount || 0, odds) : 0;
  const amountError = getPickAmountError(amountText);
  const canAdd = Boolean(
    legs.length >= TEASER_MIN_LEGS && odds && !amountError && Number.isFinite(amount) && amount > 0,
  );

  return (
    <View>
      <Card>
        <View className="gap-5">
          <View className="flex-row items-center justify-between">
            <View>
              <View className="flex-row items-center gap-2">
                <Ionicons color={THEME_COLORS.cyanAccent} name="trending-up" size={16} />
                <Text
                  className="text-[10px] font-black uppercase text-cyan-accent"
                  style={{ letterSpacing: 2.5 }}>
                  Teaser Builder
                </Text>
              </View>
              <Text
                className="mt-1 text-2xl font-black uppercase text-white"
                style={{ letterSpacing: -0.4 }}>
                Buy the Points
              </Text>
            </View>
            <Badge label={`${legs.length}/4 legs`} tone="cyan" />
          </View>

          <View className="gap-2">
            <Text
              className="text-[10px] font-black uppercase text-white/55"
              style={{ letterSpacing: 2 }}>
              Teaser Size
            </Text>
            <SegmentedToggle
              accent="cyan"
              onChange={(value) => {
                haptics.selection();
                onTeaserPointsChange(value);
              }}
              options={TEASER_POINT_OPTIONS}
              value={teaserPoints}
            />
          </View>

          <View
            className="rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10 p-4"
            style={{
              shadowColor: THEME_COLORS.cyanAccent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
            }}>
            <View className="flex-row items-end justify-between">
              <View>
                <Text
                  className="text-[10px] font-black uppercase text-cyan-accent"
                  style={{ letterSpacing: 2 }}>
                  Boost Value
                </Text>
                <Text
                  className="text-5xl font-black text-cyan-accent"
                  style={{ letterSpacing: -1.2 }}>
                  {odds ? formatAmericanOdds(odds) : '—'}
                </Text>
              </View>
              <View className="items-end">
                <Text
                  className="text-[10px] font-black uppercase text-white/45"
                  style={{ letterSpacing: 2 }}>
                  Reward
                </Text>
                <AnimatedNumber
                  className="text-2xl font-black text-white"
                  decimals={0}
                  suffix=" coins"
                  style={{ letterSpacing: -0.5 }}
                  value={reward}
                />
              </View>
            </View>
            <View className="mt-3 flex-row gap-2">
              {([2, 3, 4] as TeaserLegCount[]).map((legCount) => {
                const isActive = legCount === legs.length;
                return (
                  <View
                    key={legCount}
                    className={cn(
                      'flex-1 items-center rounded-xl border px-2 py-2',
                      isActive
                        ? 'border-cyan-accent/50 bg-cyan-accent/15'
                        : 'border-white/[0.08] bg-white/[0.04]',
                    )}>
                    <Text
                      className={cn(
                        'text-[10px] font-black uppercase',
                        isActive ? 'text-cyan-accent' : 'text-white/45',
                      )}
                      style={{ letterSpacing: 1 }}>
                      {legCount}-leg
                    </Text>
                    <Text
                      className={cn(
                        'mt-1 text-sm font-black',
                        isActive ? 'text-white' : 'text-white/65',
                      )}
                      style={{ letterSpacing: -0.2 }}>
                      {formatAmericanOdds(TEASER_ODDS_LOOKUP[legCount][teaserPoints])}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {legs.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] py-6">
              <Ionicons color={THEME_COLORS.cyanAccent} name="add-circle-outline" size={28} />
              <Text className="mt-2 text-sm font-semibold text-white/55">
                Tap spreads or totals to build your teaser.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {legs.map((leg) => (
                <BuilderLegRow
                  key={leg.id}
                  leg={leg}
                  teaserPoints={teaserPoints}
                  onRemove={onRemoveLeg}
                />
              ))}
            </View>
          )}

          <TextInput
            error={amountError}
            keyboardType="decimal-pad"
            label="Teaser amount"
            onChangeText={onAmountChange}
            placeholder="20"
            value={amountText}
          />
          <Button
            disabled={!canAdd}
            onPress={() => {
              haptics.medium();
              onAddToSlip();
            }}
            title="Add Teaser to Lineup"
            variant="secondary"
          />
        </View>
      </Card>
    </View>
  );
}

// ============================================================
// Slip Bet Card (inside slip sheet)
// ============================================================

function SlipBetCard({
  bet,
  cosmetics,
  hasAnyLock,
  onEdit,
  onRemove,
  onToggleLock,
}: {
  bet: SlipBet;
  cosmetics?: EquippedCosmeticsByCategory;
  hasAnyLock: boolean;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleLock: (id: string) => void;
}) {
  const accentByType = bet.bet_type === 'parlay'
    ? THEME_COLORS.amberAccent
    : bet.bet_type === 'teaser'
      ? THEME_COLORS.cyanAccent
      : THEME_COLORS.electricGreen;
  const isLock = bet.is_lock;
  const dim = hasAnyLock && !isLock;
  const displayedReward = getDisplayedPotentialPayout(bet);
  const cappedParlay = isCappedParlay(bet);
  const firstLeg = bet.legs[0];

  return (
    <View style={{ marginBottom: isLock ? 14 : 10, opacity: dim ? 0.5 : 1 }}>
      <SwipeableRow onRemove={() => onRemove(bet.id)}>
        {isLock ? (
          <View className="mb-1 flex-row items-center justify-center gap-1.5 px-3">
            <Ionicons color={THEME_COLORS.gold} name="star" size={11} />
            <Text
              className="flex-1 text-center text-[10px] font-black uppercase text-gold"
              style={{ letterSpacing: 1.6 }}>
              Pick of the Week — 1.5x multiplier on profit and loss
            </Text>
          </View>
        ) : null}
        <LockEffect cosmetics={isLock ? cosmetics : undefined}>
        <View
          className={cn(
            'rounded-2xl border bg-white/[0.04] p-4',
            isLock ? 'bg-gold/[0.10]' : null,
          )}
          style={{
            borderColor: isLock ? THEME_COLORS.gold : `${accentByType}66`,
            borderWidth: isLock ? 1.5 : 1,
            shadowColor: isLock ? THEME_COLORS.gold : accentByType,
            shadowOffset: { width: 0, height: isLock ? 6 : 0 },
            shadowOpacity: isLock ? 0.4 : 0,
            shadowRadius: isLock ? 14 : 0,
          }}>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-2">
                <Badge betType={bet.bet_type} />
                <Text
                  className="text-[10px] font-black uppercase text-white/45"
                  style={{ letterSpacing: 1.5 }}>
                  {formatAmericanOdds(bet.odds)}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                {bet.legs.length === 1 && firstLeg?.market !== 'over_under' ? (
                  <NflTeamLogo size={24} teamName={getSelectedTeamLogoName(firstLeg)} />
                ) : null}
                <Text
                  className="flex-1 text-base font-black text-white"
                  style={{ letterSpacing: -0.3 }}
                  numberOfLines={2}>
                  {bet.label}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityLabel={`Edit ${bet.label} amount`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  haptics.light();
                  onEdit(bet.id);
                }}>
                <View className="flex-row items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                  <Ionicons color="rgba(255,255,255,0.62)" name="pencil" size={12} />
                  <Text
                    className="text-[9px] font-black uppercase text-white/55"
                    style={{ letterSpacing: 1 }}>
                    Edit
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityLabel={`Remove ${bet.label}`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  haptics.light();
                  onRemove(bet.id);
                }}>
                <Ionicons color={THEME_COLORS.coralRed} name="close-circle" size={22} />
              </Pressable>
            </View>
          </View>

          {bet.legs.length === 1 ? (
            <View className="mt-3 flex-row items-center gap-2">
              <Text
                className="flex-1 text-[11px] font-semibold text-white/55"
                numberOfLines={1}>
                {bet.legs[0].awayTeam} at {bet.legs[0].homeTeam}
              </Text>
            </View>
          ) : (
            <View className="mt-3 gap-2">
              {bet.legs.map((leg) => (
                <View key={leg.id} className="rounded-xl bg-white/[0.04] p-2">
                  <View className="flex-row items-center gap-2">
                    {leg.market !== 'over_under' ? (
                      <NflTeamLogo size={24} teamName={getSelectedTeamLogoName(leg)} />
                    ) : null}
                    <Text
                      className="flex-1 text-[12px] font-black text-white"
                      numberOfLines={1}>
                      {leg.label}
                    </Text>
                  </View>
                  {bet.bet_type === 'teaser' ? (
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <Text className="text-[10px] font-black text-cyan-accent">
                        {formatLine(leg.original_line)} → {formatLine(leg.adjusted_line)}
                      </Text>
                      <Text
                        className="flex-1 text-[10px] font-semibold text-white/45"
                        numberOfLines={1}>
                        · {leg.awayTeam} at {leg.homeTeam}
                      </Text>
                    </View>
                  ) : (
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <Text className="text-[10px] font-semibold text-white/45">
                        {formatAmericanOdds(leg.leg_odds)} ·
                      </Text>
                      <Text
                        className="flex-1 text-[10px] font-semibold text-white/45"
                        numberOfLines={1}>
                        {leg.awayTeam} at {leg.homeTeam}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          <View className="mt-3 flex-row items-center justify-between border-t border-white/[0.08] pt-3">
            <View>
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Played
              </Text>
              <Text className="mt-0.5 text-base font-black text-white">
                {formatCurrency(bet.amount)}
              </Text>
            </View>
            <View className="items-end">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Reward
              </Text>
              <Text
                className="mt-0.5 text-base font-black"
                style={{
                  color: isLock ? THEME_COLORS.gold : accentByType,
                  letterSpacing: -0.3,
                }}>
                {formatCurrency(displayedReward)}
                {cappedParlay ? ' (capped)' : ''}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              // Heavy haptic so designating the Pick of the Week feels weighty —
              // it's a high-stakes single tap (1.5x multiplier on profit/loss).
              haptics.heavy();
              onToggleLock(bet.id);
            }}>
            <View
              className={cn(
                'mt-3 flex-row items-center justify-center gap-2 rounded-2xl border px-3 py-3',
                isLock ? 'border-gold/55 bg-gold/15' : 'border-white/10 bg-white/[0.04]',
              )}
              style={
                isLock
                  ? {
                      shadowColor: THEME_COLORS.gold,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.45,
                      shadowRadius: 10,
                    }
                  : undefined
              }>
              <Ionicons
                color={isLock ? THEME_COLORS.gold : 'rgba(255,255,255,0.55)'}
                name={isLock ? 'star' : 'star-outline'}
                size={15}
              />
              <Text
                className={cn(
                  'text-[11px] font-black uppercase',
                  isLock ? 'text-gold' : 'text-white/55',
                )}
                style={{ letterSpacing: 1.4 }}>
                {isLock ? 'Tap to Unpick' : 'Mark as Pick of the Week (1.5x)'}
              </Text>
            </View>
          </Pressable>
        </View>
        </LockEffect>
      </SwipeableRow>
    </View>
  );
}

// ============================================================
// Slip Summary
// ============================================================

function SlipSummary({
  slipBets,
  validation,
}: {
  slipBets: SlipBet[];
  validation: ValidationState;
}) {
  const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
  const totalReward = slipBets.reduce((sum, bet) => sum + getDisplayedPotentialPayout(bet), 0);
  const lockBet = slipBets.find((bet) => bet.is_lock);
  const ready = validation.errors.length === 0 && slipBets.length > 0;

  return (
    <View className="gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
      <View className="flex-row justify-between">
        <Text
          className="text-[11px] font-black uppercase text-white/55"
          style={{ letterSpacing: 1.5 }}>
          Allocated
        </Text>
        <Text className="text-sm font-black text-white">{formatCurrency(totalAllocated)}</Text>
      </View>
      <View
        className={cn(
          'flex-row items-center justify-between rounded-xl border px-3 py-2',
          lockBet ? 'border-gold/45 bg-gold/[0.08]' : 'border-white/10 bg-white/[0.03]',
        )}>
        <View className="flex-row items-center gap-2">
          <Ionicons
            color={lockBet ? THEME_COLORS.gold : 'rgba(255,255,255,0.45)'}
            name={lockBet ? 'star' : 'star-outline'}
            size={14}
          />
          <Text
            className={cn(
              'text-[11px] font-black uppercase',
              lockBet ? 'text-gold' : 'text-white/55',
            )}
            style={{ letterSpacing: 1.5 }}>
            Pick of the Week
          </Text>
        </View>
        <Text
          className={cn(
            'flex-1 pl-3 text-right text-sm font-black',
            lockBet ? 'text-white' : 'text-white/40',
          )}
          numberOfLines={1}>
          {lockBet ? lockBet.label : 'Tap a pick to choose'}
        </Text>
      </View>
      <View className="flex-row justify-between">
        <Text
          className="text-[11px] font-black uppercase text-white/55"
          style={{ letterSpacing: 1.5 }}>
          Potential Reward
        </Text>
        <Text className="text-sm font-black text-electric-green">{formatCurrency(totalReward)}</Text>
      </View>
      <View className="flex-row justify-between">
        <Text
          className="text-[11px] font-black uppercase text-white/55"
          style={{ letterSpacing: 1.5 }}>
          Remaining
        </Text>
        <Text
          className={cn(
            'text-sm font-black',
            WEEKLY_BUDGET - totalAllocated < 0 ? 'text-coral-red' : 'text-white',
          )}>
          {formatCurrency(WEEKLY_BUDGET - totalAllocated)}
        </Text>
      </View>

      {validation.errors.length > 0 ? (
        <View className="gap-2 rounded-2xl border border-amber-accent/30 bg-amber-accent/10 p-3">
          {validation.errors.map((message) => (
            <View className="flex-row gap-2" key={message}>
              <Ionicons color={THEME_COLORS.amberAccent} name="alert-circle" size={14} />
              <Text className="flex-1 text-xs font-semibold text-amber-accent">{message}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {validation.warnings.length > 0 ? (
        <View className="gap-2 rounded-2xl border border-gold/30 bg-gold/10 p-3">
          {validation.warnings.map((message) => (
            <View className="flex-row gap-2" key={message}>
              <Ionicons color={THEME_COLORS.gold} name="information-circle" size={14} />
              <Text className="flex-1 text-xs font-semibold text-gold">{message}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {ready ? (
        <View className="flex-row items-center gap-2 rounded-2xl border border-electric-green/30 bg-electric-green/10 p-3">
          <Ionicons color={THEME_COLORS.electricGreen} name="checkmark-circle" size={14} />
          <Text
            className="text-xs font-black uppercase text-electric-green"
            style={{ letterSpacing: 1.5 }}>
            Card is submitted &amp; ready
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// Lineup Bottom Sheet
// ============================================================

function BetSlipSheet({
  cosmetics,
  isSubmitting,
  onClearAll,
  onEdit,
  onRemove,
  onSnapChange,
  onSubmit,
  onToggleLock,
  slipBets,
  snap,
  validation,
  visible,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  isSubmitting: boolean;
  onClearAll: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onSnapChange: (index: SnapIndex) => void;
  onSubmit: () => void;
  onToggleLock: (id: string) => void;
  slipBets: SlipBet[];
  snap: SnapIndex;
  validation: ValidationState;
  visible: boolean;
}) {
  const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
  const remaining = WEEKLY_BUDGET - totalAllocated;
  const canSubmit = validation.errors.length === 0 && slipBets.length > 0;
  const hasAnyLock = slipBets.some((bet) => bet.is_lock);

  return (
    <BottomSheet
      collapsedHeight={LINEUP_COLLAPSED_HEIGHT}
      header={
        <View className="px-5 pb-3 pt-1">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-3">
              <View
                className="h-10 w-10 items-center justify-center rounded-2xl border border-electric-green/40 bg-electric-green/15"
                style={{
                  shadowColor: THEME_COLORS.electricGreen,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                }}>
                <Text
                  className="text-base font-black text-electric-green"
                  style={{ letterSpacing: -0.3 }}>
                  {slipBets.length}
                </Text>
              </View>
              <View>
                <Text
                  className="text-[10px] font-black uppercase text-electric-green"
                  style={{ letterSpacing: 2 }}>
                  Lineup
                </Text>
                <Text
                  className="text-base font-black text-white"
                  style={{ letterSpacing: -0.3 }}>
                  {slipBets.length === 0
                    ? 'Build your weekly card'
                    : `${slipBets.length}/${MINIMUM_BETS_PER_WEEK} picks · ${formatCurrency(totalAllocated)}`}
                </Text>
              </View>
            </View>
            <View className="items-end gap-1">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Remaining
              </Text>
              <Text
                className={cn(
                  'text-base font-black',
                  remaining < 0 ? 'text-coral-red' : 'text-white',
                )}
                style={{ letterSpacing: -0.3 }}>
                {formatCurrency(remaining)}
              </Text>
              {slipBets.length > 0 ? (
                <Pressable
                  accessibilityLabel="Clear all picks from lineup"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    haptics.light();
                    onClearAll();
                  }}>
                  <View className="flex-row items-center gap-1 rounded-full border border-coral-red/25 bg-coral-red/10 px-2 py-0.5">
                    <Ionicons color={THEME_COLORS.coralRed} name="trash-outline" size={10} />
                    <Text
                      className="text-[9px] font-black uppercase text-coral-red"
                      style={{ letterSpacing: 1 }}>
                      Clear All
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      }
      onSnapChange={onSnapChange}
      snap={snap}
      visible={visible}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 4 }}>
        <FlatList
          contentContainerStyle={{ paddingBottom: 24 }}
          data={slipBets}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="items-center gap-3 py-10">
              <View className="h-16 w-16 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
                <Ionicons color={THEME_COLORS.electricGreen} name="receipt" size={26} />
              </View>
              <Text
                className="text-2xl font-black uppercase text-white"
                style={{ letterSpacing: -0.4 }}>
                Lineup is Empty
              </Text>
              <Text className="px-4 text-center text-sm font-semibold text-white/55">
                Select odds from any game above to start building your lineup.
              </Text>
            </View>
          }
          ListFooterComponent={
            slipBets.length > 0 ? (
              <View className="gap-3 pt-2">
                <SlipSummary slipBets={slipBets} validation={validation} />
                <Button
                  disabled={!canSubmit}
                  loading={isSubmitting}
                  onPress={() => {
                    haptics.medium();
                    onSubmit();
                  }}
                  title={canSubmit ? 'Review & Submit' : 'Resolve Issues to Submit'}
                />
              </View>
            ) : null
          }
          renderItem={({ index, item }) => (
            <StaggeredItem index={index} perItemDelay={45}>
              <SlipBetCard
                bet={item}
                cosmetics={cosmetics}
                hasAnyLock={hasAnyLock}
                onEdit={onEdit}
                onRemove={onRemove}
                onToggleLock={onToggleLock}
              />
            </StaggeredItem>
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </BottomSheet>
  );
}

// ============================================================
// Amount Modal (with quick chips)
// ============================================================

function AmountModal({
  editingBet,
  onClose,
  onSaveEdit,
  onSaveStraight,
  pendingSelection,
  projectedRemaining,
}: {
  editingBet: EditingSlipBet | null;
  onClose: () => void;
  onSaveEdit: (betId: string, amount: number) => void;
  onSaveStraight: (amount: number) => void;
  pendingSelection: PendingStraightSelection | null;
  projectedRemaining: (amount: number) => number;
}) {
  const [amountText, setAmountText] = useState('');
  const isEditing = editingBet !== null;
  const visible = pendingSelection !== null || editingBet !== null;

  useEffect(() => {
    setAmountText(editingBet ? String(editingBet.bet.amount) : '');
  }, [editingBet, pendingSelection]);

  const parsedAmount = Number(amountText);
  const amountError = getPickAmountError(amountText);
  const activeOdds = pendingSelection?.selection.odds ?? editingBet?.bet.odds;
  const activeLabel = pendingSelection
    ? getSelectionLabel(pendingSelection.selection)
    : editingBet?.bet.label;
  const projectedRemainingCoins =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? projectedRemaining(parsedAmount)
      : projectedRemaining(0);
  const projectedOverBudget = projectedRemainingCoins < 0;
  const payout =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? pendingSelection
        ? calculatePotentialPayout(parsedAmount, pendingSelection.selection.odds)
        : editingBet
          ? getSlipBetPayoutForAmount(editingBet.bet, parsedAmount)
          : 0
      : 0;
  const profit = payout - (Number.isFinite(parsedAmount) ? parsedAmount : 0);

  const canSave =
    !amountError &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    (pendingSelection !== null || editingBet !== null);

  const setQuickAmount = (value: number) => {
    haptics.selection();
    setAmountText(String(value));
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <ModalShell variant="overlay">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center bg-black/75 px-5">
        <View>
          <Card>
            <View className="gap-5">
              <View>
                <View className="flex-row items-center gap-2">
                  <View className="h-2 w-2 rounded-full bg-electric-green" />
                  <Text
                    className="text-[10px] font-black uppercase text-electric-green"
                    style={{ letterSpacing: 2 }}>
                    {isEditing ? 'Edit This Pick' : 'Play This Pick'}
                  </Text>
                </View>
                <Text
                  className="mt-2 text-2xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.4 }}>
                  Set Amount
                </Text>
                {activeLabel && activeOdds ? (
                  <Text className="mt-2 text-sm font-semibold text-white/55">
                    {activeLabel} · {formatAmericanOdds(activeOdds)}
                  </Text>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {QUICK_AMOUNTS.map((value) => {
                  const isSelected = Number(amountText) === value;
                  return (
                    <PressableScale
                      key={value}
                      onPress={() => setQuickAmount(value)}
                      pressedScale={0.94}
                      style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
                      <View
                        className={cn(
                          'items-center justify-center rounded-2xl border',
                          isSelected
                            ? 'border-electric-green bg-electric-green/15'
                            : 'border-white/10 bg-white/[0.04]',
                        )}
                        style={{
                          minHeight: 56,
                          paddingHorizontal: 4,
                          shadowColor: isSelected ? THEME_COLORS.electricGreen : 'transparent',
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: isSelected ? 0.45 : 0,
                          shadowRadius: 12,
                          width: '100%',
                        }}>
                        <Text
                          className={cn(
                            'text-base font-black',
                            isSelected ? 'text-electric-green' : 'text-white',
                          )}
                          numberOfLines={1}
                          style={{ letterSpacing: -0.3 }}>
                          {value}
                        </Text>
                        <Text
                          className={cn(
                            'mt-0.5 text-[9px] font-black uppercase',
                            isSelected ? 'text-electric-green/85' : 'text-white/55',
                          )}
                          style={{ letterSpacing: 1.2 }}>
                          coins
                        </Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>

              <TextInput
                autoFocus
                error={amountError}
                keyboardType="decimal-pad"
                label="Custom amount"
                onChangeText={setAmountText}
                placeholder="20"
                value={amountText}
              />

              <View
                className={cn(
                  'flex-row items-center gap-2 rounded-2xl border px-3 py-3',
                  projectedOverBudget
                    ? 'border-coral-red/35 bg-coral-red/10'
                    : 'border-white/10 bg-white/[0.04]',
                )}>
                <Ionicons
                  color={projectedOverBudget ? THEME_COLORS.coralRed : THEME_COLORS.electricGreen}
                  name={projectedOverBudget ? 'alert-circle' : 'wallet'}
                  size={16}
                />
                <Text
                  className={cn(
                    'text-sm font-black',
                    projectedOverBudget ? 'text-coral-red' : 'text-white',
                  )}>
                  {projectedOverBudget
                    ? `${formatCurrency(Math.abs(projectedRemainingCoins))} over budget`
                    : `${formatCurrency(projectedRemainingCoins)} remaining`}
                </Text>
              </View>

              {Number.isFinite(parsedAmount) && parsedAmount > 0 ? (
                <View
                  className="rounded-2xl border border-electric-green/45 bg-electric-green/[0.12] px-4 py-4"
                  style={{
                    shadowColor: THEME_COLORS.electricGreen,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 14,
                  }}>
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={12} />
                    <Text
                      className="text-[10px] font-black uppercase text-electric-green"
                      style={{ letterSpacing: 2 }}>
                      Potential Reward
                    </Text>
                  </View>
                  <Text
                    className="mt-1 text-3xl font-black text-electric-green"
                    style={{ letterSpacing: -0.6 }}>
                    {formatCurrency(payout)}
                  </Text>
                  <Text
                    className="mt-0.5 text-[11px] font-black uppercase text-electric-green/80"
                    style={{ letterSpacing: 1.4 }}>
                    Profit {formatProfit(profit)}
                  </Text>
                </View>
              ) : null}

              <View className="gap-2">
                <Button
                  disabled={!canSave}
                  onPress={() => {
                    haptics.medium();
                    const amount = Number(parsedAmount.toFixed(2));
                    if (editingBet) {
                      onSaveEdit(editingBet.bet.id, amount);
                      return;
                    }
                    onSaveStraight(amount);
                  }}
                  title={isEditing ? 'Save Amount' : 'Add to Lineup'}
                />
                <Button title="Cancel" variant="secondary" onPress={onClose} />
              </View>
            </View>
          </Card>
        </View>
      </KeyboardAvoidingView>
      </ModalShell>
    </Modal>
  );
}

// ============================================================
// Confirmation Modal
// ============================================================

function ConfirmRow({ bet }: { bet: SlipBet }) {
  const accentByType = bet.bet_type === 'parlay'
    ? THEME_COLORS.amberAccent
    : bet.bet_type === 'teaser'
      ? THEME_COLORS.cyanAccent
      : THEME_COLORS.electricGreen;
  const displayedReward = getDisplayedPotentialPayout(bet);
  const cappedParlay = isCappedParlay(bet);

  return (
    <View
      className="rounded-2xl border bg-white/[0.04] p-3"
      style={{ borderColor: `${accentByType}55` }}>
      {bet.is_lock ? (
        <View className="mb-2 flex-row">
          <LockBadge compact />
        </View>
      ) : null}
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2 shrink">
          <Badge betType={bet.bet_type} />
          <Text
            className="text-[10px] font-black uppercase text-white/45"
            style={{ letterSpacing: 1.5 }}
            numberOfLines={1}>
            {formatAmericanOdds(bet.odds)}
          </Text>
        </View>
        <Text
          className="text-sm font-black shrink-0"
          style={{ color: accentByType, letterSpacing: -0.3 }}
          numberOfLines={1}>
          {formatCurrency(bet.amount)} → {formatCurrency(displayedReward)}
          {cappedParlay ? ' (capped)' : ''}
        </Text>
      </View>
      <View className="mt-2 gap-1">
        {bet.legs.map((leg) => (
          <Text className="text-[11px] font-semibold text-white/65" key={leg.id} numberOfLines={1}>
            {bet.bet_type === 'teaser'
              ? `${leg.label}: ${formatLine(leg.original_line)} → ${formatLine(leg.adjusted_line)}`
              : `${leg.label} (${formatAmericanOdds(leg.leg_odds)})`}
          </Text>
        ))}
      </View>
    </View>
  );
}

function ConfirmationModal({
  isSubmitting,
  onCancel,
  onConfirm,
  slipBets,
  visible,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  slipBets: SlipBet[];
  visible: boolean;
}) {
  const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
  const totalReward = slipBets.reduce((sum, bet) => sum + getDisplayedPotentialPayout(bet), 0);

  const grouped = useMemo(
    () => ({
      parlay: slipBets.filter((bet) => bet.bet_type === 'parlay'),
      straight: slipBets.filter((bet) => bet.bet_type === 'straight'),
      teaser: slipBets.filter((bet) => bet.bet_type === 'teaser'),
    }),
    [slipBets],
  );

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <ModalShell variant="overlay">
      <View className="flex-1 justify-center bg-black/80 px-5">
        <View>
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
                  <Ionicons color={THEME_COLORS.electricGreen} name="lock-closed" size={22} />
                </View>
                <Text
                  className="text-[10px] font-black uppercase text-electric-green"
                  style={{ letterSpacing: 3 }}>
                  Final Review
                </Text>
                <Text
                  className="text-2xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.4 }}>
                  Submit Your Card
                </Text>
                <Text className="px-4 text-center text-sm font-semibold text-white/55">
                  Values and lines are frozen at submit. No edits once games kick off.
                </Text>
              </View>

              <ScrollView className="max-h-72">
                <View className="gap-4">
                  {(['straight', 'parlay', 'teaser'] as BetType[]).map((type) => {
                    const items = grouped[type];
                    if (items.length === 0) return null;
                    return (
                      <View className="gap-2" key={type}>
                        <Text
                          className={cn(
                            'text-[10px] font-black uppercase',
                            type === 'parlay'
                              ? 'text-amber-accent'
                              : type === 'teaser'
                                ? 'text-cyan-accent'
                                : 'text-electric-green',
                          )}
                          style={{ letterSpacing: 2 }}>
                          {type === 'straight' ? 'Straight Picks' : type === 'parlay' ? 'Parlays' : 'Teasers'} · {items.length}
                        </Text>
                        <View className="gap-2">
                          {items.map((bet) => (
                            <ConfirmRow bet={bet} key={bet.id} />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              <View className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-[11px] font-black uppercase text-white/55"
                    style={{ letterSpacing: 1.5 }}>
                    Played
                  </Text>
                  <Text className="text-sm font-black text-white">
                    {formatCurrency(totalAllocated)}
                  </Text>
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text
                    className="text-[11px] font-black uppercase text-white/55"
                    style={{ letterSpacing: 1.5 }}>
                    Potential Reward
                  </Text>
                  <Text className="text-base font-black text-electric-green">
                    {formatCurrency(totalReward)}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button title="Back" variant="secondary" onPress={onCancel} />
                </View>
                <View className="flex-[1.4]">
                  <Button
                    loading={isSubmitting}
                    onPress={() => {
                      haptics.heavy();
                      onConfirm();
                    }}
                    title="Submit Lineup"
                  />
                </View>
              </View>
            </View>
          </Card>
        </View>
      </View>
      </ModalShell>
    </Modal>
  );
}

function TourArrow({ direction }: { direction: 'up' | 'down' }) {
  return (
    <View className="items-center" style={{ opacity: 0.92 }}>
      <View
        style={{
          borderBottomColor: direction === 'up' ? 'rgba(0,255,135,0.55)' : 'transparent',
          borderBottomWidth: direction === 'up' ? 12 : 0,
          borderLeftColor: 'transparent',
          borderLeftWidth: 10,
          borderRightColor: 'transparent',
          borderRightWidth: 10,
          borderTopColor: direction === 'down' ? 'rgba(0,255,135,0.55)' : 'transparent',
          borderTopWidth: direction === 'down' ? 12 : 0,
          height: 0,
          width: 0,
        }}
      />
    </View>
  );
}

function BetBoardTour({
  onComplete,
  visible,
}: {
  onComplete: () => void;
  visible: boolean;
}) {
  const [step, setStep] = useState(0);
  const insets = useSafeAreaInsets();
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  // Anchor 'top' tooltips need extra clearance below the safe area so they
  // never tuck under the Dynamic Island / notch.
  const topAnchorPadding = insets.top + 24;

  const dismiss = () => {
    haptics.light();
    setStep(0);
    onComplete();
  };

  const advance = () => {
    if (isLast) {
      dismiss();
      return;
    }
    haptics.selection();
    setStep((currentStep) => currentStep + 1);
  };

  // Tap anywhere on the overlay to advance.
  const handleOverlayTap = () => {
    advance();
  };

  const tooltip = (
    <View key={step}>
      <View
        className="rounded-2xl border border-electric-green/40 bg-arena-surface p-4"
        style={{
          shadowColor: THEME_COLORS.electricGreen,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.45,
          shadowRadius: 18,
        }}>
        <View className="flex-row items-start gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-2xl border border-electric-green/45 bg-electric-green/15"
            style={{
              shadowColor: THEME_COLORS.electricGreen,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.55,
              shadowRadius: 8,
            }}>
            <Ionicons color={THEME_COLORS.electricGreen} name={current.icon} size={18} />
          </View>
          <View className="flex-1">
            <Text
              className="text-[10px] font-black uppercase text-electric-green"
              style={{ letterSpacing: 2 }}>
              Walkthrough · {step + 1}/{TOUR_STEPS.length}
            </Text>
            <Text
              className="mt-1 text-lg font-black uppercase text-white"
              style={{ letterSpacing: -0.3 }}>
              {current.title}
            </Text>
            <Text className="mt-2 text-[13px] font-semibold leading-5 text-white/65">
              {current.body}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <View className="flex-row gap-1.5">
            {TOUR_STEPS.map((item, index) => (
              <View
                className={cn(
                  'h-1.5 rounded-full',
                  index === step ? 'w-6 bg-electric-green' : 'w-1.5 bg-white/15',
                )}
                key={item.title}
              />
            ))}
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable hitSlop={8} onPress={dismiss}>
              <Text
                className="text-[11px] font-black uppercase text-white/55"
                style={{ letterSpacing: 1.5 }}>
                Skip
              </Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={advance}>
              <View className="flex-row items-center gap-1 rounded-full border border-electric-green/45 bg-electric-green/15 px-3 py-1.5">
                <Text
                  className="text-[11px] font-black uppercase text-electric-green"
                  style={{ letterSpacing: 1.5 }}>
                  {isLast ? 'Got it' : 'Next'}
                </Text>
                <Ionicons
                  color={THEME_COLORS.electricGreen}
                  name={isLast ? 'checkmark' : 'arrow-forward'}
                  size={12}
                />
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );

  const layout =
    current.anchor === 'top' ? (
      <View
        className="flex-1 justify-start gap-2 px-5"
        style={{ paddingTop: topAnchorPadding }}>
        {tooltip}
        <TourArrow direction="up" />
      </View>
    ) : current.anchor === 'bottom' ? (
      <View
        className="flex-1 justify-end gap-2 px-5"
        style={{ paddingBottom: insets.bottom + 24 }}>
        <TourArrow direction="down" />
        {tooltip}
      </View>
    ) : (
      <View
        className="flex-1 justify-center gap-2 px-5"
        style={{ paddingTop: topAnchorPadding }}>
        <TourArrow direction="up" />
        {tooltip}
        <TourArrow direction="down" />
      </View>
    );

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={dismiss}>
      <ModalShell variant="overlay">
        <Pressable
          accessibilityRole="button"
          onPress={handleOverlayTap}
          style={{ backgroundColor: 'rgba(5, 8, 18, 0.78)', flex: 1 }}>
          {layout}
          <View className="absolute bottom-3 left-0 right-0 items-center">
            <Text
              className="text-[10px] font-black uppercase text-white/40"
              style={{ letterSpacing: 1.5 }}>
              Tap anywhere to advance
            </Text>
          </View>
        </Pressable>
      </ModalShell>
    </Modal>
  );
}

// ============================================================
// Placed Bets View
// ============================================================

function LockStatusPill() {
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1">
      <Ionicons color="rgba(255,255,255,0.55)" name="lock-closed" size={10} />
      <Text
        className="text-[10px] font-black uppercase text-white/55"
        style={{ letterSpacing: 1.5 }}>
        Locked
      </Text>
    </View>
  );
}

type OutcomePillSize = 'sm' | 'md';

const OUTCOME_PILL_SIZING: Record<
  OutcomePillSize,
  { icon: number; label: string; padding: string }
> = {
  sm: { icon: 10, label: 'text-[10px]', padding: 'px-2.5 py-1' },
  md: { icon: 12, label: 'text-[10px]', padding: 'px-3 py-1.5' },
};

function SettledOutcomePill({
  result,
  size = 'md',
}: {
  result: Exclude<PlacedBet['result'], 'pending'>;
  size?: OutcomePillSize;
}) {
  const sizing = OUTCOME_PILL_SIZING[size];
  const config =
    result === 'win'
      ? {
          bgClass: 'bg-electric-green/15',
          borderClass: 'border-electric-green/50',
          icon: 'checkmark-circle' as const,
          iconColor: THEME_COLORS.electricGreen,
          label: 'Win',
          textClass: 'text-electric-green',
        }
      : result === 'loss'
        ? {
            bgClass: 'bg-coral-red/15',
            borderClass: 'border-coral-red/50',
            icon: 'close-circle' as const,
            iconColor: THEME_COLORS.coralRed,
            label: 'Loss',
            textClass: 'text-coral-red',
          }
        : {
            bgClass: 'bg-white/[0.06]',
            borderClass: 'border-white/15',
            icon: null,
            iconColor: 'rgba(255,255,255,0.55)',
            label: 'Push',
            textClass: 'text-white/60',
          };

  return (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-full border',
        sizing.padding,
        config.bgClass,
        config.borderClass,
      )}>
      {config.icon ? (
        <Ionicons color={config.iconColor} name={config.icon} size={sizing.icon} />
      ) : null}
      <Text
        className={cn('font-black uppercase', sizing.label, config.textClass)}
        style={{ letterSpacing: 1.4 }}>
        {config.label}
      </Text>
    </View>
  );
}

function EditActionButton() {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-electric-green/45 bg-electric-green/15 px-3 py-1.5">
      <Ionicons color={THEME_COLORS.electricGreen} name="pencil" size={11} />
      <Text
        className="text-[10px] font-black uppercase text-electric-green"
        style={{ letterSpacing: 1.4 }}>
        Edit
      </Text>
    </View>
  );
}

function ViewOnlyPill() {
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5">
      <Ionicons color="rgba(255,255,255,0.62)" name="eye-outline" size={11} />
      <Text
        className="text-[10px] font-black uppercase text-white/60"
        style={{ letterSpacing: 1.4 }}>
        View
      </Text>
    </View>
  );
}

function getEditIneligibleReason(bet: PlacedBet, legs: EditingPlacedLeg[]) {
  if (bet.result !== 'pending') {
    return 'Settled picks can no longer be edited.';
  }

  if (legs.some((leg) => isBetLegLocked(leg))) {
    return bet.bet_type === 'straight'
      ? 'This pick is locked because its game has started.'
      : 'This pick is locked because one of its games has started.';
  }

  return null;
}

function getMissingReplacementLinesMessage(mode: BetMode, selectedLeg: EditingPlacedLeg | null) {
  if (!selectedLeg) {
    return 'Choose a pick leg before selecting replacement lines.';
  }

  if (mode === 'straight') {
    return `Current ${marketLabel(selectedLeg.market).toLowerCase()} lines for this pick are not published yet. Try again from this screen.`;
  }

  return 'Replacement lines for this slate are not published yet. Try again from this screen.';
}

function PickFinancialSummary({ bet }: { bet: PlacedBet }) {
  const metrics: PickSummaryMetric[] = [
    { label: 'Odds', value: formatAmericanOdds(bet.odds) },
    { label: 'Played', value: formatCurrency(bet.amount) },
  ];

  if (!isSettledPick(bet.result)) {
    metrics.push({
      label: 'Reward',
      tone: bet.is_lock ? 'gold' : 'green',
      value: `${formatCurrency(getDisplayedPlacedPayout(bet))}${
        isCappedPlacedParlay(bet) ? ' capped' : ''
      }`,
    });

    if (bet.is_lock) {
      metrics.push({
        label: 'Base',
        tone: 'gold',
        value: `${formatCurrency(bet.potential_payout)} x ${LOCK_OF_THE_WEEK_MULTIPLIER}`,
      });
    }
  } else {
    const realizedReward = getSettledReward(bet);
    const profit = bet.profit ?? 0;

    metrics.push({
      label: 'Outcome',
      value: formatCurrency(realizedReward),
    });

    if (bet.result === 'push') {
      metrics.push({
        label: 'Result',
        value: 'Push',
      });
    } else {
      metrics.push({
        label: bet.result === 'win' ? 'Profit' : 'Loss',
        tone: bet.result === 'win' ? 'green' : 'red',
        value: formatProfit(profit),
      });
    }
  }

  return <PickSummaryMetricGrid metrics={metrics} />;
}

function PotwStarButton({
  disabled,
  isActive,
  onPress,
  visible,
}: {
  disabled: boolean;
  isActive: boolean;
  onPress: () => void;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  const iconName = isActive ? 'star' : 'star-outline';

  if (disabled || isActive) {
    return (
      <View
        accessibilityLabel={isActive ? 'Current Pick of the Week' : 'Pick of the Week unavailable'}
        className={cn(
          'h-8 w-8 items-center justify-center rounded-full border',
          isActive ? 'border-gold/55 bg-gold/15' : 'border-white/10 bg-white/[0.04]',
        )}>
        <Ionicons color={isActive ? THEME_COLORS.gold : 'rgba(255,255,255,0.35)'} name={iconName} size={16} />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel="Make Pick of the Week"
      accessibilityRole="button"
      className="h-8 w-8 items-center justify-center rounded-full border border-gold/45 bg-gold/10"
      hitSlop={8}
      onPress={onPress}>
      <Ionicons color={THEME_COLORS.gold} name={iconName} size={16} />
    </Pressable>
  );
}

function LegLockPill({ label, locked }: { label: string; locked: boolean }) {
  return (
    <View
      className={cn(
        'self-start flex-row items-center gap-1 rounded-full border px-3 py-1',
        locked ? 'border-white/15 bg-white/[0.06]' : 'border-electric-green/40 bg-electric-green/15',
      )}>
      {locked ? <Ionicons color="rgba(255,255,255,0.55)" name="lock-closed" size={10} /> : null}
      <Text
        className={cn(
          'text-[10px] font-black uppercase',
          locked ? 'text-white/55' : 'text-electric-green',
        )}
        style={{ letterSpacing: 1.5 }}>
        {label}
      </Text>
    </View>
  );
}

function EditLegRow({
  isSelected,
  leg,
  onPress,
  teaserPoints,
}: {
  isSelected: boolean;
  leg: EditingPlacedLeg;
  onPress: () => void;
  teaserPoints: TeaserPoints | null;
}) {
  const isTotal = leg.market === 'over_under';
  const isOver = leg.selection.toLowerCase().startsWith('over');
  const accentColor = teaserPoints ? THEME_COLORS.cyanAccent : THEME_COLORS.amberAccent;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: leg.locked, selected: isSelected }}
      disabled={leg.locked}
      onPress={onPress}
      pressedScale={0.98}>
      <View
        className="rounded-2xl border bg-white/[0.04] p-3"
        style={{
          borderColor: isSelected ? accentColor : 'rgba(255,255,255,0.08)',
          opacity: leg.locked ? 0.62 : 1,
        }}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-2.5">
            {isTotal ? (
              <View className="h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
                <Ionicons
                  color="rgba(255,255,255,0.86)"
                  name={isOver ? 'arrow-up' : 'arrow-down'}
                  size={13}
                />
              </View>
            ) : (
              <NflTeamLogo size={24} teamName={getSelectedTeamLogoName(leg)} />
            )}
            <View className="flex-1">
              <Text className="text-sm font-black text-white" numberOfLines={1}>
                {leg.label}
              </Text>
              <Text className="mt-1 text-[11px] font-semibold text-white/45" numberOfLines={1}>
                {marketLabel(leg.market)} · {formatGameTime(leg.game_start_time)}
              </Text>
            </View>
          </View>
          <LegLockPill
            label={leg.locked ? 'Locked' : isSelected ? 'Swapping' : 'Open'}
            locked={leg.locked}
          />
        </View>
        {teaserPoints ? (
          <Text className="mt-2 text-[11px] font-black text-cyan-accent">
            {formatLine(leg.original_line)} → {formatLine(leg.adjusted_line)}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

function EditSelectionGrid({
  game,
  market,
  mode,
  onMarketChange,
  onSelect,
  selectedKeys,
  teaserPoints,
}: {
  game: OddsGame;
  market: BetMarket;
  mode: BetMode;
  onMarketChange?: (market: BetMarket) => void;
  onSelect: (game: OddsGame, selection: OddsSelection) => void;
  selectedKeys: Set<string>;
  teaserPoints?: TeaserPoints;
}) {
  const resolvedMarket = mode === 'teaser' && market === 'moneyline' ? 'spread' : market;
  const selections = game.markets[resolvedMarket];
  const accentHex = modeAccentHex(mode);
  const { dayLabel, timeLabel } = getGameDateParts(game.commenceTime);
  const marketOptions = MARKET_OPTIONS.filter(
    (option) => mode !== 'teaser' || option.value !== 'moneyline',
  ).map((option) => ({
    ...option,
    accent: getModeTone(mode),
  }));

  return (
    <View className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
      <View className="gap-3">
        <View>
          <Text
            className="text-[10px] font-black uppercase text-white/45"
            style={{ letterSpacing: 1.5 }}>
            NFL · {dayLabel} · {timeLabel}
          </Text>
          <Text
            className="mt-1 text-base font-black uppercase text-white"
            numberOfLines={2}
            style={{ letterSpacing: -0.2 }}>
            {game.awayTeam}
            <Text style={{ color: accentHex }}>{' @ '}</Text>
            {game.homeTeam}
          </Text>
        </View>

        {onMarketChange ? (
          <SegmentedToggle
            accent={getModeTone(mode)}
            compact
            onChange={(value) => {
              haptics.selection();
              onMarketChange(value);
            }}
            options={marketOptions}
            value={resolvedMarket}
          />
        ) : null}

        {selections.length === 0 ? (
          <View className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <Text className="text-sm font-semibold text-white/50">
              {marketLabel(resolvedMarket)} lines aren't published for this game yet.
            </Text>
          </View>
        ) : (
          <View className="flex-row gap-2">
            {selections.map((selection) => {
              const key = getSelectionKey(game.id, selection);
              return (
                <View
                  key={`${selection.market}:${selection.selection}:${selection.line ?? 'na'}`}
                  style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
                  <OddsButton
                    isSelected={selectedKeys.has(key)}
                    mode={mode}
                    selection={selection}
                    teaserPoints={teaserPoints}
                    onPress={() => onSelect(game, selection)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

function PostSubmitEditModal({
  bet,
  isSaving,
  oddsGames,
  onCancel,
  onRetryReplacementLines,
  onSave,
  placedBets,
  replacementLinesError,
  replacementLinesLoading = false,
}: {
  bet: PlacedBet | null;
  isSaving: boolean;
  oddsGames: OddsGame[];
  onCancel: () => void;
  onRetryReplacementLines?: () => void;
  onSave: (edit: BetEditSubmission) => Promise<void>;
  placedBets: PlacedBet[];
  replacementLinesError?: Error | null;
  replacementLinesLoading?: boolean;
}) {
  const [legs, setLegs] = useState<EditingPlacedLeg[]>([]);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [marketByGameId, setMarketByGameId] = useState<Record<string, BetMarket>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bet) {
      setLegs([]);
      setSelectedLegId(null);
      setMarketByGameId({});
      setErrorMessage(null);
      return;
    }

    const editableLegs = makeEditablePlacedLegs(bet, oddsGames);
    setLegs(editableLegs);
    setSelectedLegId(editableLegs.find((leg) => !leg.locked)?.id ?? editableLegs[0]?.id ?? null);
    setMarketByGameId(
      Object.fromEntries(editableLegs.map((leg) => [leg.game_id, leg.market])),
    );
    setErrorMessage(null);
  }, [bet, oddsGames]);

  if (!bet) {
    return null;
  }

  const mode = bet.bet_type;
  const tone = getModeTone(mode);
  const accent = modeAccentHex(mode);
  const metrics = getEditedPlacedBetMetrics(bet, legs);
  const selectedLeg = legs.find((leg) => leg.id === selectedLegId) ?? null;
  const selectedKeys = new Set(legs.map((leg) => leg.selectionKey));
  const otherLegs = getPlacedBetConflictLegs(placedBets, bet.id, oddsGames);
  const straightGame = selectedLeg ? findOddsGame(oddsGames, selectedLeg.game_id) : undefined;
  const editIneligibleReason = getEditIneligibleReason(bet, legs);
  const changed = legs.some((leg) => {
    const original = bet.bet_legs.find((item) => item.id === leg.betLegId);
    return Boolean(
      original &&
        (original.game_id !== leg.game_id ||
          original.market !== leg.market ||
          original.selection !== leg.selection ||
          original.original_line !== leg.original_line ||
          original.adjusted_line !== leg.adjusted_line ||
          original.leg_odds !== leg.leg_odds ||
          original.game_start_time !== leg.game_start_time),
    );
  });
  const canSave = changed && !isSaving && !errorMessage && !editIneligibleReason;

  const replaceSelectedLeg = (game: OddsGame, selection: OddsSelection) => {
    if (!selectedLeg) {
      setErrorMessage('Choose a leg to swap first.');
      return;
    }

    if (selectedLeg.locked) {
      setErrorMessage('That leg is locked because its game has started.');
      return;
    }

    if (mode === 'straight' && (game.id !== selectedLeg.game_id || selection.market !== selectedLeg.market)) {
      setErrorMessage('Straight pick edits keep the same game and market.');
      return;
    }

    if (mode === 'teaser' && selection.market === 'moneyline') {
      setErrorMessage('Teasers can only use spreads and over/unders.');
      return;
    }

    // Keep the submitted coin amount fixed on swaps so players cannot use updated
    // lines to create information-arbitrage after their weekly card is built.
    const adjustedLine =
      mode === 'teaser' && bet.teaser_points
        ? getAdjustedTeaserLine(selection, bet.teaser_points)
        : selection.line;
    const nextLeg = makeEditedPlacedLeg(selectedLeg, game, selection, adjustedLine);
    const draftLegs = legs.filter((leg) => leg.id !== selectedLeg.id);
    const conflict = findConflictingPick([...otherLegs, ...draftLegs], nextLeg);

    if (conflict) {
      haptics.warning();
      setErrorMessage(formatAddConflictMessage(nextLeg, conflict));
      return;
    }

    haptics.light();
    setErrorMessage(null);
    setLegs((current) => current.map((leg) => (leg.id === selectedLeg.id ? nextLeg : leg)));
  };

  const save = async () => {
    if (!canSave) return;

    await onSave({
      bet_id: bet.id,
      legs: legs.map(editableLegToSubmissionLeg),
      odds: metrics.odds,
      potential_payout: metrics.potential_payout,
      teaser_points: metrics.teaser_points,
    });
  };

  const gameList =
    mode === 'straight'
      ? straightGame
        ? [straightGame]
        : []
      : oddsGames;
  const showReplacementLinesLoading = replacementLinesLoading && gameList.length === 0;
  const showReplacementLinesError =
    !showReplacementLinesLoading && Boolean(replacementLinesError) && gameList.length === 0;
  const missingReplacementLinesMessage = getMissingReplacementLinesMessage(mode, selectedLeg);

  return (
    <Modal animationType="slide" onRequestClose={onCancel} visible={Boolean(bet)}>
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
                  style={{ color: accent, letterSpacing: 2.5 }}>
                  Edit Submitted Pick
                </Text>
                <Text
                  className="mt-2 text-2xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.4 }}>
                  {mode === 'straight' ? 'Swap Side' : `Edit ${mode}`}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close edit flow"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onCancel}>
                <View className="h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                  <Ionicons color="rgba(255,255,255,0.72)" name="close" size={18} />
                </View>
              </Pressable>
            </View>

            <Card>
              <View className="gap-3">
                <View className="flex-row items-center justify-between gap-2">
                  <Badge betType={mode} />
                  <Text
                    className="text-[11px] font-black uppercase text-white/55"
                    style={{ letterSpacing: 1.5 }}>
                    {formatCurrency(bet.amount)} fixed
                  </Text>
                </View>
                <Text className="text-sm font-semibold leading-5 text-white/55">
                  {mode === 'straight'
                    ? 'Choose the other side from this same game and market. Coins stay fixed.'
                    : 'Choose an unlocked leg, then tap a replacement line. Coins stay fixed.'}
                </Text>
                <View className="flex-row items-center justify-between border-t border-white/[0.08] pt-3">
                  <Text
                    className="text-[10px] font-black uppercase text-white/45"
                    style={{ letterSpacing: 1.5 }}>
                    New Reward
                  </Text>
                  <Text className="text-base font-black" style={{ color: accent }}>
                    {formatAmericanOdds(metrics.odds)} · {formatCurrency(metrics.potential_payout)}
                  </Text>
                </View>
              </View>
            </Card>

            {errorMessage ? (
              <PickConflictNotice message={errorMessage} onDismiss={() => setErrorMessage(null)} />
            ) : null}

            {mode !== 'straight' ? (
              <View className="gap-2">
                <Text
                  className="text-[10px] font-black uppercase text-white/50"
                  style={{ letterSpacing: 2 }}>
                  Pick Leg to Swap
                </Text>
                {legs.map((leg) => (
                  <EditLegRow
                    isSelected={leg.id === selectedLegId}
                    key={leg.id}
                    leg={leg}
                    teaserPoints={bet.teaser_points}
                    onPress={() => {
                      haptics.selection();
                      setSelectedLegId(leg.id);
                      setErrorMessage(null);
                    }}
                  />
                ))}
              </View>
            ) : null}

            <View className="gap-3">
              <Text
                className="text-[10px] font-black uppercase text-white/50"
                style={{ letterSpacing: 2 }}>
                Replacement Lines
              </Text>
              {editIneligibleReason ? (
                <Card>
                  <View className="flex-row items-start gap-2">
                    <Ionicons color="rgba(255,255,255,0.58)" name="lock-closed" size={16} />
                    <Text className="flex-1 text-sm font-semibold leading-5 text-white/58">
                      {editIneligibleReason}
                    </Text>
                  </View>
                </Card>
              ) : showReplacementLinesLoading ? (
                <Card>
                  <View className="flex-row items-center gap-3">
                    <ActivityIndicator color={accent} />
                    <Text className="flex-1 text-sm font-semibold leading-5 text-white/58">
                      Loading replacement lines...
                    </Text>
                  </View>
                </Card>
              ) : showReplacementLinesError ? (
                <Card>
                  <View className="gap-3">
                    <View className="flex-row items-start gap-2">
                      <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={16} />
                      <Text className="flex-1 text-sm font-semibold leading-5 text-coral-red">
                        {replacementLinesError?.message ?? 'Unable to load replacement lines right now.'}
                      </Text>
                    </View>
                    {onRetryReplacementLines ? (
                      <Button title="Try Again" variant="secondary" onPress={onRetryReplacementLines} />
                    ) : null}
                  </View>
                </Card>
              ) : gameList.length === 0 ? (
                <Card>
                  <Text className="text-sm font-semibold leading-5 text-white/55">
                    {missingReplacementLinesMessage}
                  </Text>
                </Card>
              ) : (
                gameList.map((game) => {
                  const activeMarket =
                    mode === 'straight'
                      ? selectedLeg?.market ?? 'moneyline'
                      : marketByGameId[game.id] ?? (mode === 'teaser' ? 'spread' : 'moneyline');

                  return (
                    <EditSelectionGrid
                      game={game}
                      key={game.id}
                      market={activeMarket}
                      mode={mode}
                      selectedKeys={selectedKeys}
                      teaserPoints={bet.teaser_points ?? undefined}
                      onMarketChange={
                        mode === 'straight'
                          ? undefined
                          : (market) =>
                              setMarketByGameId((current) => ({
                                ...current,
                                [game.id]: market,
                              }))
                      }
                      onSelect={replaceSelectedLeg}
                    />
                  );
                })
              )}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button title="Cancel" variant="secondary" onPress={onCancel} />
              </View>
              <View className="flex-[1.35]">
                <Button
                  disabled={!canSave}
                  loading={isSaving}
                  title={
                    changed ? (mode === 'straight' ? 'Confirm Swap' : 'Save Changes') : 'Choose a Swap'
                  }
                  onPress={() => {
                    void save();
                  }}
                />
              </View>
            </View>
        </ScrollView>
      </ModalShell>
    </Modal>
  );
}

function PlacedBetCard({
  bet,
  cosmetics,
  highlighted,
  isLockHeadline,
  liveScoresByGameId,
  onEdit,
  onShare,
  onSetPotw,
  potwSwapClosed,
  potwSwapPending,
  readOnly,
  shareLoading,
}: {
  bet: PlacedBet;
  cosmetics?: EquippedCosmeticsByCategory;
  highlighted: boolean;
  isLockHeadline: boolean;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  onEdit: () => void;
  onShare: () => Promise<void>;
  onSetPotw: () => void;
  potwSwapClosed: boolean;
  potwSwapPending: boolean;
  readOnly: boolean;
  shareLoading: boolean;
}) {
  const isLocked = isPlacedBetLocked(bet);
  const settledResult = isSettledPick(bet.result) ? bet.result : null;
  const isSettled = Boolean(settledResult);
  const isLock = bet.is_lock;
  const liveStatus = evaluateLiveBetStatus(bet, liveScoresByGameId);
  const dim = !isLockHeadline && !isLock; // gently de-emphasize non-lock bets after headline
  const showPotwStar = !readOnly && !potwSwapClosed && !isLocked && !isSettled;
  const canSetPotw =
    !readOnly && !isLock && !potwSwapClosed && !isLocked && !isSettled && !potwSwapPending;
  const settledAccent =
    settledResult === 'win'
      ? THEME_COLORS.electricGreen
      : settledResult === 'loss'
        ? THEME_COLORS.coralRed
        : null;
  const cardStyle = settledAccent
    ? {
        backgroundColor:
          settledResult === 'win' ? 'rgba(0,255,135,0.07)' : 'rgba(255,71,87,0.07)',
        borderColor:
          settledResult === 'win' ? 'rgba(0,255,135,0.34)' : 'rgba(255,71,87,0.34)',
        borderWidth: 1.5,
        opacity: 1,
        shadowColor: settledAccent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      }
    : isLock && !isSettled
      ? {
          borderWidth: 2,
          shadowColor: THEME_COLORS.gold,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.55,
          shadowRadius: 18,
          opacity: 1,
        }
      : { opacity: dim ? 0.78 : 1 };
  const card = (
    <View
      className={cn(
        'overflow-hidden rounded-2xl border bg-white/[0.04]',
        isLock && !isSettled ? 'border-gold/70 bg-gold/[0.10]' : 'border-white/[0.08]',
      )}
      style={cardStyle}>
      {isLock ? (
        <View className="flex-row items-center justify-center gap-1.5 border-b border-gold/40 bg-gold/15 px-3 py-1.5">
          <Ionicons color={THEME_COLORS.gold} name="star" size={11} />
          <Text
            className="text-[10px] font-black uppercase text-gold"
            style={{ letterSpacing: 1.6 }}>
            Pick of the Week · {LOCK_OF_THE_WEEK_MULTIPLIER}x profit/loss
          </Text>
        </View>
      ) : null}
      <View className="gap-3 p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <PotwStarButton
                disabled={!canSetPotw}
                isActive={isLock}
                onPress={onSetPotw}
                visible={showPotwStar}
              />
              <Badge betType={bet.bet_type} />
            </View>
            <Text
              className={cn(
                'font-black uppercase text-white',
                isLock ? 'text-xl' : 'text-base',
              )}
              style={{ letterSpacing: -0.3 }}
              numberOfLines={2}>
              {formatPickTitle(bet)}
            </Text>
            <LiveBetStatusSummary status={liveStatus} />
          </View>
          {settledResult ? (
            <SettledOutcomePill result={settledResult} />
          ) : readOnly ? (
            <ViewOnlyPill />
          ) : isLocked ? (
            <LockStatusPill />
          ) : (
            <EditActionButton />
          )}
        </View>
        {bet.bet_legs.map((leg) => {
          const settledLegResult = isSettledPick(leg.result) ? leg.result : null;
          return (
            <View className="rounded-2xl bg-white/[0.04] p-3" key={leg.id}>
              <View className="flex-row justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-black text-white">
                    {formatBetLegLabel(leg, {
                      betType: bet.bet_type,
                      includeTeaserMovement: false,
                    })}
                  </Text>
                  <Text className="mt-1 text-[11px] font-semibold text-white/45">
                    {marketLabel(leg.market)} · {formatGameTime(leg.game_start_time)}
                  </Text>
                </View>
                {settledLegResult ? <SettledOutcomePill result={settledLegResult} size="sm" /> : null}
              </View>
              {bet.bet_type === 'teaser' ? (
                <Text className="mt-2 text-[11px] font-black text-cyan-accent">
                  {formatLine(leg.original_line)} → {formatLine(leg.adjusted_line)}
                </Text>
              ) : null}
              <LiveLegScoreLine leg={leg} score={liveScoresByGameId[leg.game_id]} />
            </View>
          );
        })}
        <PickFinancialSummary bet={bet} />
        <Button
          loading={shareLoading}
          onPress={() => {
            void onShare();
          }}
          title="Share to Chat"
          variant="secondary"
        />
      </View>
    </View>
  );

  const content = readOnly || isLocked || isSettled ? (
    card
  ) : (
    <PressableScale
      accessibilityLabel="Edit submitted pick"
      accessibilityRole="button"
      onPress={onEdit}
      pressedScale={0.985}>
      {card}
    </PressableScale>
  );

  return (
    <LockEffect cosmetics={isLock ? cosmetics : undefined}>
      {highlighted ? (
        <LivePulse color={THEME_COLORS.gold} intensity={0.65} style={{ borderRadius: 18 }}>
          {content}
        </LivePulse>
      ) : (
        content
      )}
    </LockEffect>
  );
}

function SubmittedCardSummaryRow({
  label,
  value,
  valueClassName = 'text-white',
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text
        className="text-[10px] font-black uppercase text-white/45"
        style={{ letterSpacing: 1.5 }}>
        {label}
      </Text>
      <Text
        adjustsFontSizeToFit
        className={cn('text-sm font-black', valueClassName)}
        minimumFontScale={0.82}
        numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PlacedBetsView({
  bets,
  cosmetics,
  highlightedPotwBetId,
  onEdit,
  onSetPotw,
  potwSwapClosed,
  potwSwapPendingBetId,
  readOnly,
  userId,
  weekNumber,
}: {
  bets: PlacedBet[];
  cosmetics?: EquippedCosmeticsByCategory;
  highlightedPotwBetId: string | null;
  onEdit: (bet: PlacedBet) => void;
  onSetPotw: (bet: PlacedBet) => void;
  potwSwapClosed: boolean;
  potwSwapPendingBetId: string | null;
  readOnly: boolean;
  userId: string | undefined;
  weekNumber: number;
}) {
  const shareBet = useShareBetToChat(userId);
  const totalAllocated = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const settlementState = getBetSettlementState(bets);
  const settledBets = bets.filter((bet) => isSettledPick(bet.result));
  const pendingBets = bets.filter((bet) => !isSettledPick(bet.result));
  const totalSettledReward = settledBets.reduce((sum, bet) => sum + getSettledReward(bet), 0);
  const totalPendingReward = pendingBets.reduce(
    (sum, bet) => sum + getDisplayedPlacedPayout(bet),
    0,
  );
  const totalSettledProfit = settledBets.reduce((sum, bet) => sum + (bet.profit ?? 0), 0);
  const liveScoreGameIds = useMemo(
    () => bets.flatMap((bet) => bet.bet_legs.map((leg) => leg.game_id)),
    [bets],
  );
  const liveScoresQuery = useLiveScores(liveScoreGameIds);
  const headerIcon =
    settlementState === 'settled'
      ? 'checkmark-circle'
      : settlementState === 'partially_settled'
        ? 'time-outline'
        : readOnly
          ? 'eye-outline'
          : 'lock-closed';
  const headerColor =
    settlementState === 'settled'
      ? THEME_COLORS.electricGreen
      : settlementState === 'partially_settled'
        ? THEME_COLORS.gold
        : readOnly
          ? THEME_COLORS.cyanAccent
          : THEME_COLORS.electricGreen;
  const headerTextClass =
    settlementState === 'partially_settled'
      ? 'text-gold'
      : readOnly && settlementState === 'unsettled'
        ? 'text-cyan-accent'
        : 'text-electric-green';
  const headerLabel =
    settlementState === 'settled'
      ? 'Card Settled'
      : settlementState === 'partially_settled'
        ? 'Results Updating'
        : readOnly
          ? `Week ${weekNumber} Lineup`
          : 'Card Submitted';
  const headline =
    settlementState === 'settled'
      ? 'Week Results Final'
      : settlementState === 'partially_settled'
        ? 'Picks Are Settling'
        : readOnly
          ? 'Read-Only Lineup'
          : 'This Week is Submitted';
  const helperText =
    settlementState === 'settled'
      ? 'All picks have settled. Returns and net profit are final for this card.'
      : settlementState === 'partially_settled'
        ? `${settledBets.length} of ${bets.length} picks have settled. Pending picks still show potential reward.`
        : readOnly
          ? 'Past weeks show submitted picks and cannot be edited.'
          : 'Picks stay editable until their lock game starts. Pick of the Week can be moved until first kickoff.';

  // Surface Pick of the Week first, the rest follow.
  const orderedBets = useMemo(() => {
    const lock = bets.find((bet) => bet.is_lock);
    const rest = bets.filter((bet) => !bet.is_lock);
    return lock ? [lock, ...rest] : bets;
  }, [bets]);

  const handleShare = async (bet: PlacedBet) => {
    try {
      await shareBet.mutateAsync(bet);
      Alert.alert('Shared to chat', 'This pick is now in league chat.');
    } catch (error) {
      Alert.alert(
        'Could not share pick',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  return (
    <View className="gap-4">
      <Card tone="highlight">
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Ionicons
              color={headerColor}
              name={headerIcon}
              size={14}
            />
            <Text
              className={cn('text-[10px] font-black uppercase', headerTextClass)}
              style={{ letterSpacing: 2.5 }}>
              {headerLabel}
            </Text>
          </View>
          <Text
            className="text-2xl font-black uppercase text-white"
            style={{ letterSpacing: -0.4 }}>
            {headline}
          </Text>
          <Text className="text-sm font-semibold text-white/55">
            {helperText}
          </Text>
          <View className="mt-2 gap-2">
            <SubmittedCardSummaryRow
              label="Allocated"
              value={formatCurrency(totalAllocated)}
            />
            {settlementState === 'settled' ? (
              <>
                <SubmittedCardSummaryRow
                  label="Total Returned"
                  value={formatCurrency(totalSettledReward)}
                  valueClassName="text-electric-green"
                />
                <SubmittedCardSummaryRow
                  label="Net Profit"
                  value={formatProfit(totalSettledProfit)}
                  valueClassName={getProfitTone(totalSettledProfit)}
                />
              </>
            ) : settlementState === 'partially_settled' ? (
              <>
                <SubmittedCardSummaryRow
                  label="Returned So Far"
                  value={formatCurrency(totalSettledReward)}
                  valueClassName="text-electric-green"
                />
                <SubmittedCardSummaryRow
                  label="Pending Potential"
                  value={formatCurrency(totalPendingReward)}
                  valueClassName="text-gold"
                />
                <SubmittedCardSummaryRow
                  label="Net So Far"
                  value={formatProfit(totalSettledProfit)}
                  valueClassName={getProfitTone(totalSettledProfit)}
                />
              </>
            ) : (
              <SubmittedCardSummaryRow
                label="Potential Reward"
                value={formatCurrency(totalPendingReward)}
                valueClassName="text-electric-green"
              />
            )}
          </View>
        </View>
      </Card>

      {orderedBets.length === 0 ? (
        <Card>
          <View className="items-center gap-3 py-5">
            <Ionicons color="rgba(255,255,255,0.45)" name="receipt-outline" size={26} />
            <Text className="text-center text-lg font-black text-white">
              No picks this week
            </Text>
            <Text className="text-center text-sm font-semibold text-white/50">
              There is no submitted lineup for Week {weekNumber}.
            </Text>
          </View>
        </Card>
      ) : null}

      {orderedBets.map((bet, index) => (
        <PlacedBetCard
          bet={bet}
          cosmetics={cosmetics}
          highlighted={highlightedPotwBetId === bet.id}
          isLockHeadline={index === 0 && bet.is_lock}
          key={bet.id}
          liveScoresByGameId={liveScoresQuery.scoresByGameId}
          onEdit={() => onEdit(bet)}
          onShare={() => handleShare(bet)}
          onSetPotw={() => onSetPotw(bet)}
          potwSwapClosed={potwSwapClosed}
          potwSwapPending={potwSwapPendingBetId === bet.id}
          readOnly={readOnly}
          shareLoading={shareBet.isPending}
        />
      ))}
    </View>
  );
}

// ============================================================
// Skeletons
// ============================================================

function OddsSkeletons() {
  return (
    <View className="gap-4">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <View className="gap-4">
            <SkeletonLoader height={14} width="40%" />
            <SkeletonLoader height={26} width="90%" />
            <SkeletonLoader height={44} radius={16} />
            <SkeletonLoader height={70} radius={16} />
          </View>
        </Card>
      ))}
    </View>
  );
}

// ============================================================
// Main Screen
// ============================================================

export default function BetBoardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const leaguesQuery = useMyLeagues(user?.id);
  const cosmeticsQuery = useUserCosmetics(user?.id);
  const tourFlag = useLocalFlag(LOCAL_FLAG_KEYS.betBoardTourComplete);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | undefined>();
  const [mode, setMode] = useState<BetMode>('straight');
  const [marketByGameId, setMarketByGameId] = useState<Record<string, BetMarket>>({});
  const [slipBets, setSlipBets] = useState<SlipBet[]>([]);
  const [pendingStraightSelection, setPendingStraightSelection] = useState<PendingStraightSelection | null>(null);
  const [editingSlipBet, setEditingSlipBet] = useState<EditingSlipBet | null>(null);
  const [parlayLegs, setParlayLegs] = useState<SlipLeg[]>([]);
  const [parlayAmount, setParlayAmount] = useState('');
  const [teaserLegs, setTeaserLegs] = useState<SlipLeg[]>([]);
  const [teaserAmount, setTeaserAmount] = useState('');
  const [teaserPoints, setTeaserPoints] = useState<TeaserPoints>(6);
  const [slipSnap, setSlipSnap] = useState<SnapIndex>(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingPlacedBet, setEditingPlacedBet] = useState<PlacedBet | null>(null);
  const [highlightedPotwBetId, setHighlightedPotwBetId] = useState<string | null>(null);
  const [tourVisible, setTourVisible] = useState(false);
  const [pickConflictMessage, setPickConflictMessage] = useState<string | null>(null);
  const [selectionConflict, setSelectionConflict] = useState<SelectionConflict | null>(null);
  const appStorePrefillKeyRef = useRef<string | null>(null);

  const leagueSummaries = leaguesQuery.data ?? [];
  const leagues = leagueSummaries.map((summary) => summary.league);
  const selectedLeague = leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0];
  const appStoreCaptureMode = getAppStoreCaptureMode(selectedLeague);
  const oddsQuery = useUpcomingNflOdds({ allowMockOdds: Boolean(appStoreCaptureMode) });
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>();
  const viewedWeek = selectedWeek ?? selectedLeague?.current_week;
  const isPastWeek =
    selectedLeague !== undefined && viewedWeek !== undefined && viewedWeek < selectedLeague.current_week;
  const isFutureWeek =
    selectedLeague !== undefined && viewedWeek !== undefined && viewedWeek > selectedLeague.current_week;
  const isCurrentWeek = Boolean(
    selectedLeague !== undefined && viewedWeek === selectedLeague.current_week,
  );
  const accessQuery = useBetBoardAccess({
    leagueId: selectedLeague?.id,
    userId: user?.id,
    weekNumber: viewedWeek,
  });
  const hasBetBoardAccessInputs = Boolean(selectedLeague?.id && user?.id && viewedWeek);
  const placedBetsQuery = usePlacedBets(selectedLeague?.id, user?.id, viewedWeek);
  const revealTimeQuery = useLeagueWeekRevealTime(selectedLeague?.id, viewedWeek);
  const submitBets = useSubmitBetsMutation(selectedLeague?.id, user?.id, viewedWeek);
  const updatePlacedBet = useUpdatePlacedBetMutation(
    selectedLeague?.id,
    user?.id,
    viewedWeek,
  );
  const setPickOfWeek = useSetPickOfWeekMutation(
    selectedLeague?.id,
    user?.id,
    viewedWeek,
  );
  const placedBets = placedBetsQuery.data ?? [];
  const hasLoadedPlacedBets = placedBetsQuery.isSuccess;
  const hasSubmittedLineup = hasLoadedPlacedBets && placedBets.length > 0;
  const isReadOnly = isPastWeek || hasSubmittedLineup;
  const canBuildLineup = isCurrentWeek && hasLoadedPlacedBets && !hasSubmittedLineup;
  const isCheckingBetBoardAccess = hasBetBoardAccessInputs && accessQuery.isLoading;
  const canAccessBetBoard = hasBetBoardAccessInputs ? accessQuery.data === true : true;
  const hasActiveSlate = Boolean(oddsQuery.data?.length);
  const canBuildLineupWithSlate = canBuildLineup && canAccessBetBoard && hasActiveSlate;
  const potwSwapClosed = revealTimeQuery.data
    ? Date.now() >= new Date(revealTimeQuery.data).getTime()
    : false;
  const validation = useMemo(() => getValidationState(slipBets), [slipBets]);
  useSyncLeagueWeekSlate(
    selectedLeague?.id,
    canBuildLineupWithSlate ? viewedWeek : undefined,
    oddsQuery.data,
  );
  const lockClockNow = useLockClock(isReadOnly);

  // Keep submitted cards stable: a previous focus/polling refetch depended on
  // React Query result objects, causing a refetch/render loop that looked like
  // runaway pull-to-refresh. Lock state advances locally from game_start_time;
  // DB-side simulations update through the explicit RefreshControl gesture.

  useEffect(() => {
    if (!editingPlacedBet) {
      return;
    }

    const refreshedBet = placedBets.find((bet) => bet.id === editingPlacedBet.id);
    if (refreshedBet && isPlacedBetLocked(refreshedBet)) {
      setEditingPlacedBet(null);
    }
  }, [editingPlacedBet, lockClockNow, placedBets]);

  const builderLegSelectionKeys = useMemo(() => {
    const keys = new Set<string>();
    if (mode === 'parlay') {
      parlayLegs.forEach((leg) => keys.add(leg.selectionKey));
    } else if (mode === 'teaser') {
      teaserLegs.forEach((leg) => keys.add(leg.selectionKey));
    }
    return keys;
  }, [mode, parlayLegs, teaserLegs]);

  useEffect(() => {
    if (!selectedLeagueId && leagues[0]) {
      setSelectedLeagueId(leagues[0].id);
    }
  }, [leagues, selectedLeagueId]);

  useEffect(() => {
    if (selectedLeague) {
      setSelectedWeek(selectedLeague.current_week);
    }
  }, [selectedLeague?.current_week, selectedLeague?.id]);

  useEffect(() => {
    appStorePrefillKeyRef.current = null;
    setSlipBets([]);
    setEditingSlipBet(null);
    setPendingStraightSelection(null);
    setParlayLegs([]);
    setTeaserLegs([]);
    setParlayAmount('');
    setTeaserAmount('');
    setEditingPlacedBet(null);
    setHighlightedPotwBetId(null);
    setPickConflictMessage(null);
    setSelectionConflict(null);
  }, [selectedLeagueId, viewedWeek]);

  useEffect(() => {
    if (
      !appStoreCaptureMode ||
      !selectedLeague ||
      viewedWeek === undefined ||
      !canBuildLineup ||
      !oddsQuery.data?.length
    ) {
      return;
    }

    const prefillKey = `${selectedLeague.id}:${viewedWeek}:${appStoreCaptureMode}`;
    if (appStorePrefillKeyRef.current === prefillKey) {
      return;
    }

    const captureSlip = makeAppStoreCaptureSlip(oddsQuery.data, appStoreCaptureMode);
    const expectedCount = appStoreCaptureMode === 'lineup_prefill' ? MINIMUM_BETS_PER_WEEK : 1;
    if (captureSlip.length !== expectedCount) {
      return;
    }

    appStorePrefillKeyRef.current = prefillKey;
    setSlipBets(captureSlip);
    setMode('straight');
    setPendingStraightSelection(null);
    setEditingSlipBet(null);
    setParlayLegs([]);
    setTeaserLegs([]);
    setParlayAmount('');
    setTeaserAmount('');
    setPickConflictMessage(null);
    setSelectionConflict(null);
    setSlipSnap(appStoreCaptureMode === 'lineup_prefill' ? 1 : 0);
  }, [
    appStoreCaptureMode,
    canBuildLineup,
    oddsQuery.data,
    selectedLeague,
    viewedWeek,
  ]);

  useEffect(() => {
    if (!tourFlag.isLoading && !tourFlag.value && leagues.length > 0) {
      setTourVisible(true);
    }
  }, [leagues.length, tourFlag.isLoading, tourFlag.value]);

  useEffect(() => {
    if (!highlightedPotwBetId) {
      return;
    }

    const timeout = setTimeout(() => setHighlightedPotwBetId(null), 1600);
    return () => clearTimeout(timeout);
  }, [highlightedPotwBetId]);

  useEffect(() => {
    if (!selectionConflict) {
      return;
    }

    const timeout = setTimeout(() => setSelectionConflict(null), 5500);
    return () => clearTimeout(timeout);
  }, [selectionConflict]);

  const getTargetLegForSelection = (game: OddsGame, selection: OddsSelection) => {
    if (mode === 'teaser') {
      if (selection.market === 'moneyline') {
        return null;
      }

      return makeSlipLeg(game, selection, getAdjustedTeaserLine(selection, teaserPoints));
    }

    return makeSlipLeg(game, selection);
  };

  const getConflictSources = () => {
    const builderSources: { leg: SlipLeg; source: ConflictSource }[] = [
      ...parlayLegs.map((leg) => ({
        leg,
        source: { kind: 'builder' as const, mode: 'parlay' as const },
      })),
      ...teaserLegs.map((leg) => ({
        leg,
        source: { kind: 'builder' as const, mode: 'teaser' as const },
      })),
    ];

    const slipSources = slipBets.flatMap((bet) =>
      bet.legs.map((leg) => ({
        leg,
        source: { bet, kind: 'slip' as const },
      })),
    );

    return [...builderSources, ...slipSources];
  };

  const getSelectionConflict = (game: OddsGame, selection: OddsSelection) => {
    const nextLeg = getTargetLegForSelection(game, selection);
    if (!nextLeg) {
      return null;
    }

    const selectedInCurrentBuilder =
      (mode === 'parlay' && parlayLegs.some((leg) => leg.selectionKey === nextLeg.selectionKey)) ||
      (mode === 'teaser' && teaserLegs.some((leg) => leg.selectionKey === nextLeg.selectionKey));

    if (selectedInCurrentBuilder) {
      return null;
    }

    const conflict = getConflictSources().find((item) => areConflictingPicks(item.leg, nextLeg));

    if (!conflict) {
      return null;
    }

    return makeSelectionConflict({
      existingLeg: conflict.leg,
      game,
      nextLeg,
      selection,
      source: conflict.source,
      targetMode: mode,
    });
  };

  const removeConflictSource = (conflict: SelectionConflict) => {
    if (conflict.source.kind === 'builder') {
      if (conflict.source.mode === 'parlay') {
        setParlayLegs((current) =>
          current.filter((leg) => leg.selectionKey !== conflict.existingLeg.selectionKey),
        );
      } else {
        setTeaserLegs((current) =>
          current.filter((leg) => leg.selectionKey !== conflict.existingLeg.selectionKey),
        );
      }
      return;
    }

    const sourceBet = conflict.source.bet;

    setSlipBets((current) =>
      current.flatMap((bet) => {
        if (bet.id !== sourceBet.id) {
          return [bet];
        }

        const updatedBet = getUpdatedSlipBetAfterLegRemoval(
          bet,
          conflict.existingLeg.id,
        );
        return updatedBet ? [updatedBet] : [];
      }),
    );
  };

  const addConflictReplacement = (conflict: SelectionConflict) => {
    if (conflict.targetMode === 'straight') {
      setEditingSlipBet(null);
      setPendingStraightSelection({ game: conflict.game, selection: conflict.selection });
      return;
    }

    if (conflict.targetMode === 'parlay') {
      setParlayLegs((current) => {
        const replacedInCurrent = current.some(
          (leg) => leg.selectionKey === conflict.existingLeg.selectionKey,
        );

        if (replacedInCurrent) {
          return current.map((leg) =>
            leg.selectionKey === conflict.existingLeg.selectionKey ? conflict.nextLeg : leg,
          );
        }

        if (current.some((leg) => leg.selectionKey === conflict.nextLeg.selectionKey)) {
          return current;
        }

        if (current.length >= 6) {
          Alert.alert('Leg limit reached', 'This pick can have up to 6 legs.');
          return current;
        }

        return [...current, conflict.nextLeg];
      });
      return;
    }

    setTeaserLegs((current) => {
      const replacedInCurrent = current.some(
        (leg) => leg.selectionKey === conflict.existingLeg.selectionKey,
      );

      if (replacedInCurrent) {
        return current.map((leg) =>
          leg.selectionKey === conflict.existingLeg.selectionKey ? conflict.nextLeg : leg,
        );
      }

      if (current.some((leg) => leg.selectionKey === conflict.nextLeg.selectionKey)) {
        return current;
      }

      if (current.length >= 4) {
        Alert.alert('Leg limit reached', 'This pick can have up to 4 legs.');
        return current;
      }

      return [...current, conflict.nextLeg];
    });
  };

  const applySelectionConflictSwap = (conflict: SelectionConflict) => {
    if (
      conflict.targetMode === 'parlay' &&
      !(conflict.source.kind === 'builder' && conflict.source.mode === 'parlay') &&
      parlayLegs.length >= 6
    ) {
      Alert.alert('Leg limit reached', 'This pick can have up to 6 legs.');
      return;
    }

    if (
      conflict.targetMode === 'teaser' &&
      !(conflict.source.kind === 'builder' && conflict.source.mode === 'teaser') &&
      teaserLegs.length >= 4
    ) {
      Alert.alert('Leg limit reached', 'This pick can have up to 4 legs.');
      return;
    }

    haptics.medium();
    removeConflictSource(conflict);
    addConflictReplacement(conflict);
    setPickConflictMessage(null);
    setSelectionConflict(null);
  };

  const addBuilderLeg = (currentLegs: SlipLeg[], nextLeg: SlipLeg, maxLegs: number) => {
    if (currentLegs.some((leg) => leg.selectionKey === nextLeg.selectionKey)) {
      haptics.light();
      setPickConflictMessage(null);
      return currentLegs.filter((leg) => leg.selectionKey !== nextLeg.selectionKey);
    }

    const conflictingLeg = findConflictingPick([...getSlipLegs(slipBets), ...currentLegs], nextLeg);
    if (conflictingLeg) {
      haptics.warning();
      setPickConflictMessage(formatAddConflictMessage(nextLeg, conflictingLeg));
      setSelectionConflict(null);
      return currentLegs;
    }

    if (currentLegs.length >= maxLegs) {
      haptics.warning();
      Alert.alert('Leg limit reached', `This pick can have up to ${maxLegs} legs.`);
      return currentLegs;
    }

    haptics.light();
    setPickConflictMessage(null);
    setSelectionConflict(null);
    return [...currentLegs, nextLeg];
  };

  const handleSelectOdds = (game: OddsGame, selection: OddsSelection) => {
    if (!selectedLeague) {
      haptics.warning();
      Alert.alert('Choose a league', 'Join or create a league before submitting picks.');
      return;
    }

    if (!canAccessBetBoard) {
      haptics.warning();
      Alert.alert(
        'Early access window',
        'Season Pass holders get the first 30 minutes when new matchups are posted.',
      );
      return;
    }

    const selectionConflictForTap = getSelectionConflict(game, selection);
    if (selectionConflictForTap) {
      haptics.warning();
      setPickConflictMessage(null);
      setSelectionConflict(selectionConflictForTap);
      return;
    }

    if (mode === 'straight') {
      const nextLeg = makeSlipLeg(game, selection);
      const conflictingLeg = findConflictingPick(
        [...getSlipLegs(slipBets), ...parlayLegs, ...teaserLegs],
        nextLeg,
      );
      if (conflictingLeg) {
        haptics.warning();
        setPickConflictMessage(formatAddConflictMessage(nextLeg, conflictingLeg));
        return;
      }

      haptics.light();
      setPickConflictMessage(null);
      setSelectionConflict(null);
      setEditingSlipBet(null);
      setPendingStraightSelection({ game, selection });
      return;
    }

    if (mode === 'parlay') {
      setParlayLegs((current) => addBuilderLeg(current, makeSlipLeg(game, selection), 6));
      return;
    }

    if (selection.market === 'moneyline') {
      haptics.warning();
      Alert.alert('Winner picks are unavailable for teasers', 'Use spreads or over/unders.');
      return;
    }

    const adjustedLine = getAdjustedTeaserLine(selection, teaserPoints);
    setTeaserLegs((current) => addBuilderLeg(current, makeSlipLeg(game, selection, adjustedLine), 4));
  };

  const handleSaveStraightAmount = (amount: number) => {
    if (!pendingStraightSelection) return;
    if (amount > MAX_SINGLE_BET) {
      haptics.warning();
      Alert.alert(
        'Amount too high',
        `No single pick can exceed ${formatCurrency(MAX_SINGLE_BET)}.`,
      );
      return;
    }

    const nextBet = makeStraightBet(
      pendingStraightSelection.game,
      pendingStraightSelection.selection,
      amount,
    );
    setSlipBets((current) => {
      const existing = current.find((bet) => bet.id === nextBet.id);
      return [
        ...current.filter((bet) => bet.id !== nextBet.id),
        { ...nextBet, is_lock: existing?.is_lock ?? false },
      ];
    });
    setPickConflictMessage(null);
    setSelectionConflict(null);
    setPendingStraightSelection(null);
    setSlipSnap(1);
  };

  const handleSaveEditedAmount = (betId: string, amount: number) => {
    if (amount > MAX_SINGLE_BET) {
      haptics.warning();
      Alert.alert(
        'Amount too high',
        `No single pick can exceed ${formatCurrency(MAX_SINGLE_BET)}.`,
      );
      return;
    }

    setSlipBets((current) =>
      current.map((bet) => (bet.id === betId ? updateSlipBetAmount(bet, amount) : bet)),
    );
    setPickConflictMessage(null);
    setSelectionConflict(null);
    setEditingSlipBet(null);
    setSlipSnap(1);
  };

  const handleClearAllPicks = () => {
    Alert.alert('Remove all picks from your lineup?', 'This clears every pick and coin amount.', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          haptics.medium();
          setEditingSlipBet(null);
          setSlipBets([]);
          setPickConflictMessage(null);
          setSelectionConflict(null);
          setSlipSnap(0);
        },
        style: 'destructive',
        text: 'Clear All',
      },
    ]);
  };

  const addParlayToSlip = () => {
    const amount = Number(parlayAmount);
    if (!Number.isFinite(amount) || amount <= 0 || parlayLegs.length < 2) return;
    if (amount > MAX_SINGLE_BET) {
      haptics.warning();
      Alert.alert(
        'Amount too high',
        `No single pick can exceed ${formatCurrency(MAX_SINGLE_BET)}.`,
      );
      return;
    }

    const { cappedReward, rawReward } = calculateParlayReward(amount, parlayLegs);
    const bet: SlipBet = {
      amount: Number(amount.toFixed(2)),
      bet_type: 'parlay',
      id: `parlay:${parlayLegs.map((leg) => leg.id).join('|')}`,
      is_lock: false,
      label: `${parlayLegs.length}-leg Parlay`,
      legs: parlayLegs,
      odds: getParlayOdds(parlayLegs),
      potential_payout: cappedReward,
      rawPotentialReward: rawReward,
      teaser_points: null,
    };
    const conflict = findPickConflict(getSlipLegs(slipBets), bet.legs);
    if (conflict) {
      haptics.warning();
      setPickConflictMessage(
        formatAddConflictMessage(conflict.nextLeg, conflict.existingLeg),
      );
      setSelectionConflict(null);
      return;
    }

    setSlipBets((current) => {
      const existing = current.find((item) => item.id === bet.id);
      return [
        ...current.filter((item) => item.id !== bet.id),
        { ...bet, is_lock: existing?.is_lock ?? false },
      ];
    });
    setPickConflictMessage(null);
    setSelectionConflict(null);
    setParlayLegs([]);
    setParlayAmount('');
    setSlipSnap(1);
  };

  const addTeaserToSlip = () => {
    const amount = Number(teaserAmount);
    const odds = getTeaserOdds(teaserLegs.length, teaserPoints);
    if (teaserLegs.length < TEASER_MIN_LEGS) {
      haptics.warning();
      Alert.alert('Add another leg', 'Teasers need at least two legs.');
      return;
    }
    if (!odds || !Number.isFinite(amount) || amount <= 0) return;
    if (amount > MAX_SINGLE_BET) {
      haptics.warning();
      Alert.alert(
        'Amount too high',
        `No single pick can exceed ${formatCurrency(MAX_SINGLE_BET)}.`,
      );
      return;
    }

    const bet: SlipBet = {
      amount: Number(amount.toFixed(2)),
      bet_type: 'teaser',
      id: `teaser:${teaserPoints}:${teaserLegs.map((leg) => leg.id).join('|')}`,
      is_lock: false,
      label: `${teaserLegs.length}-leg ${teaserPoints}pt Teaser`,
      legs: teaserLegs,
      odds,
      potential_payout: calculatePotentialPayout(amount, odds),
      teaser_points: teaserPoints,
    };
    const conflict = findPickConflict(getSlipLegs(slipBets), bet.legs);
    if (conflict) {
      haptics.warning();
      setPickConflictMessage(
        formatAddConflictMessage(conflict.nextLeg, conflict.existingLeg),
      );
      setSelectionConflict(null);
      return;
    }

    setSlipBets((current) => {
      const existing = current.find((item) => item.id === bet.id);
      return [
        ...current.filter((item) => item.id !== bet.id),
        { ...bet, is_lock: existing?.is_lock ?? false },
      ];
    });
    setPickConflictMessage(null);
    setSelectionConflict(null);
    setTeaserLegs([]);
    setTeaserAmount('');
    setSlipSnap(1);
  };

  const handleSubmit = () => {
    if (validation.errors.length > 0) return;
    setIsConfirmOpen(true);
  };

  const toggleLockBet = (id: string) => {
    setSlipBets((current) =>
      current.map((bet) => ({
        ...bet,
        is_lock: bet.id === id ? !bet.is_lock : false,
      })),
    );
  };

  const handleConfirm = async () => {
    if (submitBets.isPending) {
      return;
    }

    try {
      await submitBets.mutateAsync(slipBets);
      setIsConfirmOpen(false);
      setSlipSnap(0);
      setSlipBets([]);
      haptics.success();
      Alert.alert('Lineup submitted', 'Your card is set at the selected values.');
    } catch (error) {
      haptics.error();
      Alert.alert('Could not submit picks', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const handleOpenPlacedBetEdit = (bet: PlacedBet) => {
    if (!isCurrentWeek) {
      haptics.warning();
      Alert.alert('Read-only week', 'Past weeks can be reviewed but not edited.');
      return;
    }

    if (isPlacedBetLocked(bet)) {
      haptics.warning();
      Alert.alert('Pick locked', 'This pick is locked because one of its games has started.');
      return;
    }

    haptics.selection();
    setEditingPlacedBet(bet);
    void oddsQuery.refetch();
  };

  const handleSavePlacedBetEdit = async (edit: BetEditSubmission) => {
    try {
      await updatePlacedBet.mutateAsync(edit);
      setEditingPlacedBet(null);
      haptics.success();
      Alert.alert('Pick updated', 'Your submitted pick has been updated.');
    } catch (error) {
      haptics.error();
      Alert.alert('Could not update pick', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const handleSetPlacedPotw = async (bet: PlacedBet) => {
    if (!isCurrentWeek) {
      return;
    }

    if (bet.is_lock || setPickOfWeek.isPending) {
      return;
    }

    if (potwSwapClosed) {
      haptics.warning();
      Alert.alert(
        'Pick of the Week locked',
        'Pick of the Week can no longer be changed after first kickoff.',
      );
      return;
    }

    if (isPlacedBetLocked(bet)) {
      haptics.warning();
      Alert.alert('Pick locked', 'This pick is locked and cannot become Pick of the Week.');
      return;
    }

    try {
      await setPickOfWeek.mutateAsync(bet.id);
      setHighlightedPotwBetId(bet.id);
      haptics.success();
    } catch (error) {
      haptics.error();
      Alert.alert(
        'Could not change Pick of the Week',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  if (leaguesQuery.isLoading) {
    return (
      <ScreenWrapper topSafe>
        <OddsSkeletons />
      </ScreenWrapper>
    );
  }

  if (leagues.length === 0) {
    return (
      <ScreenWrapper centered topSafe>
        <View className="items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
            <Ionicons color={THEME_COLORS.electricGreen} name="receipt" size={28} />
          </View>
          <Text
            className="text-center text-3xl font-black uppercase text-white"
            style={{ letterSpacing: -0.4 }}>
            Pick Board
          </Text>
          <Text className="px-2 text-center text-base font-semibold text-white/55">
            Join or create a league before building your weekly card.
          </Text>
          <View className="w-full gap-3 px-4">
            <Button title="Create a League" onPress={() => router.push('/leagues/create')} />
            <Button
              title="Join a League"
              variant="secondary"
              onPress={() => router.push('/leagues/join')}
            />
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  const showPlacedBetsView = isPastWeek || hasSubmittedLineup;
  const sheetVisible = canBuildLineupWithSlate && !isFutureWeek;
  const slipBottomPadding = sheetVisible ? LINEUP_COLLAPSED_HEIGHT + 20 : 32;
  const activeEditingPlacedBet = isCurrentWeek && editingPlacedBet
    ? placedBets.find((bet) => bet.id === editingPlacedBet.id) ?? editingPlacedBet
    : null;

  return (
    <View style={{ backgroundColor: THEME_COLORS.background, flex: 1 }}>
      <ScreenWrapper className="pb-0" topSafe>
        <FlatList
          contentContainerStyle={{ paddingBottom: slipBottomPadding }}
          data={canBuildLineupWithSlate ? oddsQuery.data ?? [] : []}
          keyExtractor={(game) => game.id}
          ListHeaderComponent={
            <View className="gap-5 pb-5">
              <BoardHeader league={selectedLeague} weekNumber={viewedWeek} />

              {viewedWeek ? (
                <View className="items-end">
                  <WeekNavigator
                    maxWeek={REGULAR_SEASON_WEEKS}
                    onChange={(week) => {
                      haptics.selection();
                      setSelectedWeek(week);
                    }}
                    week={viewedWeek}
                  />
                </View>
              ) : null}

              {canBuildLineupWithSlate ? (
                <View className="gap-2">
                  <Text
                    className="text-[10px] font-black uppercase text-white/50"
                    style={{ letterSpacing: 2 }}>
                    Pick Type
                  </Text>
                  <SegmentedToggle
                    accent="green"
                    onChange={(value) => {
                      haptics.selection();
                      setSelectionConflict(null);
                      setMode(value);
                    }}
                    options={BET_MODE_OPTIONS}
                    value={mode}
                  />
                </View>
              ) : null}

              <LeagueSelector
                leagues={leagues}
                onSelect={setSelectedLeagueId}
                selectedLeagueId={selectedLeague?.id}
              />

              {isFutureWeek && viewedWeek ? (
                <FutureWeekBoardPlaceholder weekNumber={viewedWeek} />
              ) : null}

              {isCurrentWeek && (hasSubmittedLineup || hasActiveSlate) ? (
                <BudgetTracker
                  placedBets={hasSubmittedLineup ? placedBets : undefined}
                  slipBets={slipBets}
                />
              ) : null}

              {pickConflictMessage ? (
                <PickConflictNotice
                  message={pickConflictMessage}
                  onDismiss={() => setPickConflictMessage(null)}
                />
              ) : null}

              {selectionConflict ? (
                <PickConflictNotice
                  actionLabel={selectionConflict.actionLabel}
                  message={selectionConflict.message}
                  onAction={() => applySelectionConflictSwap(selectionConflict)}
                  onDismiss={() => setSelectionConflict(null)}
                />
              ) : null}

              {canBuildLineup && isCheckingBetBoardAccess ? (
                <Card>
                  <View className="items-center gap-3 py-3">
                    <Ionicons color={THEME_COLORS.cyanAccent} name="time" size={28} />
                    <Text className="text-center text-xl font-black uppercase text-white">
                      Checking Access
                    </Text>
                    <Text className="text-center text-sm font-semibold leading-5 text-white/60">
                      Confirming whether this slate is inside the Season Pass early-access window.
                    </Text>
                  </View>
                </Card>
              ) : null}

              {canBuildLineup && !isCheckingBetBoardAccess && !canAccessBetBoard ? (
                <Card tone="highlight">
                  <View className="items-center gap-3 py-3">
                    <Ionicons color={THEME_COLORS.gold} name="time" size={28} />
                    <Text className="text-center text-xl font-black uppercase text-white">
                      Early Access Window
                    </Text>
                    <Text className="text-center text-sm font-semibold leading-5 text-white/60">
                      Season Pass holders can build cards for the first 30 minutes after new matchups are posted.
                      Free access opens automatically after the window ends.
                    </Text>
                  </View>
                </Card>
              ) : null}

              {canBuildLineupWithSlate && mode === 'parlay' ? (
                <ParlayBuilder
                  amountText={parlayAmount}
                  legs={parlayLegs}
                  onAddToSlip={addParlayToSlip}
                  onAmountChange={setParlayAmount}
                  onRemoveLeg={(id) => {
                    setPickConflictMessage(null);
                    setSelectionConflict(null);
                    setParlayLegs((current) => current.filter((leg) => leg.id !== id));
                  }}
                />
              ) : null}

              {canBuildLineupWithSlate && mode === 'teaser' ? (
                <TeaserBuilder
                  amountText={teaserAmount}
                  legs={teaserLegs}
                  onAddToSlip={addTeaserToSlip}
                  onAmountChange={setTeaserAmount}
                  onRemoveLeg={(id) => {
                    setPickConflictMessage(null);
                    setSelectionConflict(null);
                    setTeaserLegs((current) => current.filter((leg) => leg.id !== id));
                  }}
                  onTeaserPointsChange={(points) => {
                    setTeaserPoints(points);
                    setSelectionConflict(null);
                    setTeaserLegs((current) =>
                      current.map((leg) => ({
                        ...leg,
                        adjusted_line:
                          leg.market === 'moneyline'
                            ? leg.adjusted_line
                            : getAdjustedTeaserLine(
                                {
                                  label: leg.label,
                                  line: leg.original_line,
                                  market: leg.market,
                                  odds: leg.leg_odds,
                                  selection: getPickLegBaseLabel(leg),
                                  shortName: leg.label,
                                },
                                points,
                              ),
                      })),
                    );
                  }}
                  teaserPoints={teaserPoints}
                />
              ) : null}

              {placedBetsQuery.isLoading ? <OddsSkeletons /> : null}
              {showPlacedBetsView && viewedWeek ? (
                <PlacedBetsView
                  bets={placedBets}
                  cosmetics={cosmeticsQuery.data?.equippedByCategory}
                  highlightedPotwBetId={highlightedPotwBetId}
                  onEdit={handleOpenPlacedBetEdit}
                  onSetPotw={handleSetPlacedPotw}
                  potwSwapClosed={potwSwapClosed}
                  potwSwapPendingBetId={setPickOfWeek.variables ?? null}
                  readOnly={isPastWeek}
                  userId={user?.id}
                  weekNumber={viewedWeek}
                />
              ) : null}

              {canBuildLineup && canAccessBetBoard && oddsQuery.isError ? (
                <Card>
                  <View className="flex-row items-center gap-2">
                    <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={16} />
                    <Text className="flex-1 text-sm font-semibold text-coral-red">
                      {oddsQuery.error instanceof Error
                        ? oddsQuery.error.message
                        : 'Unable to load lines right now.'}
                    </Text>
                  </View>
                </Card>
              ) : null}
              {canBuildLineup && canAccessBetBoard && oddsQuery.isLoading ? <OddsSkeletons /> : null}
            </View>
          }
          ListEmptyComponent={
            canBuildLineup && canAccessBetBoard && !oddsQuery.isLoading && !oddsQuery.isError ? (
              <NoActiveSlateCard revealAt={revealTimeQuery.data} />
            ) : null
          }
          refreshControl={
            <RefreshControl
              tintColor={THEME_COLORS.electricGreen}
              refreshing={
                oddsQuery.isRefetching ||
                placedBetsQuery.isRefetching ||
                accessQuery.isRefetching ||
                revealTimeQuery.isRefetching
              }
              onRefresh={() => {
                void oddsQuery.refetch();
                void placedBetsQuery.refetch();
                void accessQuery.refetch();
                void revealTimeQuery.refetch();
              }}
            />
          }
          renderItem={({ index, item }) => (
            <StaggeredItem index={index} perItemDelay={50}>
              <GameCard
                builderLegSelectionKeys={builderLegSelectionKeys}
                game={item}
                getSelectionConflict={getSelectionConflict}
                market={
                  marketByGameId[item.id] ?? (mode === 'teaser' ? 'spread' : 'moneyline')
                }
                mode={mode}
                onMarketChange={(market) => {
                  setSelectionConflict(null);
                  setMarketByGameId((current) => ({ ...current, [item.id]: market }));
                }}
                onSelect={(selection) => handleSelectOdds(item, selection)}
                readOnly={isReadOnly}
                teaserPoints={teaserPoints}
              />
            </StaggeredItem>
          )}
          showsVerticalScrollIndicator={false}
        />
      </ScreenWrapper>

      <AmountModal
        editingBet={editingSlipBet}
        onClose={() => {
          setPendingStraightSelection(null);
          setEditingSlipBet(null);
        }}
        onSaveEdit={handleSaveEditedAmount}
        onSaveStraight={handleSaveStraightAmount}
        pendingSelection={pendingStraightSelection}
        projectedRemaining={(amount) => {
          const editingAmount = editingSlipBet?.bet.amount ?? 0;
          const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
          return WEEKLY_BUDGET - totalAllocated + editingAmount - amount;
        }}
      />

      <PostSubmitEditModal
        bet={activeEditingPlacedBet}
        isSaving={updatePlacedBet.isPending}
        oddsGames={oddsQuery.data ?? []}
        placedBets={placedBets}
        replacementLinesError={oddsQuery.error}
        replacementLinesLoading={oddsQuery.isLoading || oddsQuery.isRefetching}
        onCancel={() => setEditingPlacedBet(null)}
        onRetryReplacementLines={() => {
          haptics.selection();
          void oddsQuery.refetch();
        }}
        onSave={handleSavePlacedBetEdit}
      />

      <BetSlipSheet
        isSubmitting={submitBets.isPending}
        cosmetics={cosmeticsQuery.data?.equippedByCategory}
        onClearAll={handleClearAllPicks}
        onEdit={(id) => {
          const bet = slipBets.find((item) => item.id === id);
          if (!bet) return;
          setPendingStraightSelection(null);
          setEditingSlipBet({ bet });
        }}
        onRemove={(id) => {
          haptics.light();
          if (editingSlipBet?.bet.id === id) {
            setEditingSlipBet(null);
          }
          setPickConflictMessage(null);
          setSelectionConflict(null);
          setSlipBets((current) => current.filter((bet) => bet.id !== id));
        }}
        onSnapChange={setSlipSnap}
        onSubmit={handleSubmit}
        onToggleLock={toggleLockBet}
        slipBets={slipBets}
        snap={slipSnap}
        validation={validation}
        visible={sheetVisible}
      />

      <ConfirmationModal
        isSubmitting={submitBets.isPending}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
        slipBets={slipBets}
        visible={isConfirmOpen}
      />

      <BetBoardTour
        onComplete={() => {
          setTourVisible(false);
          void tourFlag.markComplete();
        }}
        visible={tourVisible}
      />
    </View>
  );
}
