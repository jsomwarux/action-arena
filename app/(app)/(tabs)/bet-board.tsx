import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
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
import {
  AnimatedBar,
  AnimatedNumber,
  Badge,
  BottomSheet,
  Button,
  Card,
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
} from '@/components/ui';
import {
  LOCK_OF_THE_WEEK_MULTIPLIER,
  MAX_SINGLE_BET,
  MINIMUM_BETS_PER_WEEK,
  PARLAY_PAYOUT_CAP,
  TEASER_ODDS_LOOKUP,
  WEEKLY_BUDGET,
} from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { useShareBetToChat } from '@/hooks/use-league-chat';
import { LOCAL_FLAG_KEYS, useLocalFlag } from '@/hooks/use-local-flags';
import { useMyLeagues } from '@/hooks/use-leagues';
import { useUpcomingNflOdds } from '@/hooks/use-odds';
import { useBetBoardAccess } from '@/hooks/use-season-pass';
import {
  type BetSubmissionLeg,
  type MixedBetSubmission,
  type PlacedBet,
  usePlacedBets,
  useSubmitBetsMutation,
} from '@/hooks/use-straight-bets';
import { cn } from '@/lib/cn';
import {
  americanOddsToDecimal,
  calculatePotentialPayout,
  decimalOddsToAmerican,
  formatAmericanOdds,
  formatCurrency,
  formatGameTime,
  formatProfit,
} from '@/lib/format';
import { haptics } from '@/lib/haptics';
import type { OddsGame, OddsSelection } from '@/lib/odds-api';
import type {
  BetMarket,
  BetType,
  EquippedCosmeticsByCategory,
  LeagueRow,
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

type ValidationState = {
  errors: string[];
  warnings: string[];
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
    body: 'Submit unlocks once you have at least 5 picks, exactly one Pick of the Week, no pick over 35 coins, the full 100-coin budget allocated, and no duplicate game sides.',
    icon: 'checkmark-done',
    title: 'Validation rules',
  },
];

function marketLabel(market: BetMarket) {
  if (market === 'moneyline') return 'Winner';
  if (market === 'spread') return 'Spread';
  return 'Over/Under';
}

function getSelectionLabel(selection: OddsSelection) {
  if (selection.market === 'spread' && selection.line !== null) {
    return `${selection.selection} ${selection.line > 0 ? '+' : ''}${selection.line}`;
  }

  if (selection.market === 'over_under' && selection.line !== null) {
    return `${selection.selection} ${selection.line}`;
  }

  return selection.selection;
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

function getTeaserOdds(legCount: number, teaserPoints: TeaserPoints) {
  if (legCount < 2 || legCount > 4) {
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

function getLegConflictSide(leg: SlipLeg) {
  if (leg.market === 'spread') {
    return getSelectedTeamLogoName(leg);
  }

  if (leg.market === 'over_under') {
    return leg.selection.toLowerCase().startsWith('over') ? 'Over' : 'Under';
  }

  return leg.selection;
}

function isExactSameSelection(left: SlipLeg, right: SlipLeg) {
  return left.selectionKey === right.selectionKey;
}

function areContradictingSameGameLegs(left: SlipLeg, right: SlipLeg) {
  if (left.game_id !== right.game_id || left.market !== right.market) {
    return false;
  }

  if (isExactSameSelection(left, right)) {
    return false;
  }

  if (left.market === 'moneyline' || left.market === 'spread' || left.market === 'over_under') {
    return getLegConflictSide(left) !== getLegConflictSide(right);
  }

  return false;
}

function findContradictingLeg(legs: SlipLeg[], nextLeg: SlipLeg) {
  return legs.find((leg) => areContradictingSameGameLegs(leg, nextLeg));
}

function formatLegConflictLabel(leg: SlipLeg) {
  return `${leg.label} ${formatAmericanOdds(leg.leg_odds)}`;
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

function getBetTypeLabel(type: BetType) {
  if (type === 'straight') return 'straight pick';
  return type;
}

function joinConflictSources(sources: string[]) {
  const uniqueSources = [...new Set(sources)];

  if (uniqueSources.length <= 1) {
    return uniqueSources[0] ?? 'your lineup';
  }

  if (uniqueSources.length === 2) {
    return `${uniqueSources[0]} and ${uniqueSources[1]}`;
  }

  return `${uniqueSources.slice(0, -1).join(', ')}, and ${uniqueSources[uniqueSources.length - 1]}`;
}

function getConflictSummaries(slipBets: SlipBet[]) {
  const legsWithBet = slipBets.flatMap((bet) =>
    bet.legs.map((leg) => ({
      bet,
      leg,
    })),
  );
  const games = new Map<string, typeof legsWithBet>();
  const selections = new Map<string, typeof legsWithBet>();

  legsWithBet.forEach((item) => {
    games.set(item.leg.game_id, [...(games.get(item.leg.game_id) ?? []), item]);
    selections.set(item.leg.selectionKey, [
      ...(selections.get(item.leg.selectionKey) ?? []),
      item,
    ]);
  });
  const contradictorySelections: string[] = [];

  [...games.values()].forEach((items) => {
    items.forEach((left, leftIndex) => {
      items.slice(leftIndex + 1).forEach((right) => {
        if (!areContradictingSameGameLegs(left.leg, right.leg)) {
          return;
        }

        const matchup = formatMatchupLabel(left.leg);
        contradictorySelections.push(
          `${formatLegConflictLabel(left.leg)} and ${formatLegConflictLabel(
            right.leg,
          )} conflict on ${matchup} — remove one.`,
        );
      });
    });
  });

  return {
    contradictorySelections,
    duplicateSelections: [...selections.values()]
      .filter((items) => items.length > 1)
      .map((items) => {
        const selection = formatLegConflictLabel(items[0].leg);
        const sources = items.map((item) => getBetTypeLabel(item.bet.bet_type));
        return `${selection} appears in both your ${joinConflictSources(
          sources,
        )} — remove the duplicate.`;
      }),
  };
}

function getValidationState(slipBets: SlipBet[]): ValidationState {
  const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
  const lockCount = slipBets.filter((bet) => bet.is_lock).length;
  const { contradictorySelections, duplicateSelections } = getConflictSummaries(slipBets);
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
  errors.push(...duplicateSelections);

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

// ============================================================
// Header
// ============================================================

function BoardHeader({ league }: { league: LeagueRow | undefined }) {
  return (
    <View>
      <View className="flex-row items-center gap-2">
        <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
        <Text
          className="text-[11px] font-semibold uppercase text-electric-green"
          style={{ letterSpacing: 1.2 }}>
          {league ? `Week ${league.current_week}` : 'Week —'}
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

  const progress = Math.min(Math.max(totalAllocated / WEEKLY_BUDGET, 0), 1);
  const barColor = overBudget
    ? THEME_COLORS.coralRed
    : progress > 0.95
      ? THEME_COLORS.coralRed
      : progress > 0.65
        ? THEME_COLORS.amberAccent
        : THEME_COLORS.electricGreen;

  const minimumMet = displayedBets.length >= MINIMUM_BETS_PER_WEEK;
  const fullyAllocated = totalAllocated === WEEKLY_BUDGET;

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
      </Modal>
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
  disabled,
  isSelected,
  mode,
  onPress,
  selection,
  teaserPoints,
}: {
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

  return (
    <PressableScale
      accessibilityLabel={
        isTeaserMode ? primaryLabel : `${primaryLabel} ${formatAmericanOdds(selection.odds)}`
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
        minHeight: 68,
        minWidth: 0,
        opacity: disabled ? 0.32 : pressed ? 0.92 : 1,
        width: '100%',
      })}>
      <View
        pointerEvents="none"
        style={[
          {
            backgroundColor: isSelected ? `${accentHex}2E` : 'rgba(255,255,255,0.04)',
            borderColor: isSelected ? accentHex : inactiveBorderColor,
            borderRadius: 16,
            borderWidth: isSelected ? 2 : 1,
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            minHeight: 68,
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
  market,
  mode,
  onMarketChange,
  onSelect,
  readOnly,
  teaserPoints,
}: {
  builderLegSelectionKeys: Set<string>;
  game: OddsGame;
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
              return (
                <View
                  key={`${selection.market}:${selection.selection}:${selection.line ?? 'na'}`}
                  style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
                  <OddsButton
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
  if (leg.market === 'spread') {
    return leg.selection.replace(/\s[+-]\d+(?:\.\d+)?$/, '');
  }

  return leg.selection;
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
  const isLocked = new Date(leg.game_start_time).getTime() <= Date.now();
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
  const canAdd = Boolean(odds && !amountError && Number.isFinite(amount) && amount > 0);

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
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Badge betType={bet.bet_type} />
          {bet.is_lock ? <LockBadge compact /> : null}
          <Text
            className="text-[10px] font-black uppercase text-white/45"
            style={{ letterSpacing: 1.5 }}>
            {formatAmericanOdds(bet.odds)}
          </Text>
        </View>
        <Text
          className="text-sm font-black"
          style={{ color: accentByType, letterSpacing: -0.3 }}>
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
    </Modal>
  );
}

// ============================================================
// Placed Bets View
// ============================================================

function PlacedBetCard({
  bet,
  cosmetics,
  isLockHeadline,
  onShare,
  shareLoading,
}: {
  bet: PlacedBet;
  cosmetics?: EquippedCosmeticsByCategory;
  isLockHeadline: boolean;
  onShare: () => Promise<void>;
  shareLoading: boolean;
}) {
  const allLocked = bet.bet_legs.every(
    (leg) => leg.locked || new Date(leg.game_start_time).getTime() <= Date.now(),
  );
  const isLock = bet.is_lock;
  const displayedReward = getDisplayedPlacedPayout(bet);
  const cappedParlay = isCappedPlacedParlay(bet);
  const dim = !isLockHeadline && !isLock; // gently de-emphasize non-lock bets after headline

  return (
    <LockEffect cosmetics={isLock ? cosmetics : undefined}>
    <View
      className={cn(
        'overflow-hidden rounded-2xl border bg-white/[0.04]',
        isLock ? 'border-gold/70 bg-gold/[0.10]' : 'border-white/[0.08]',
      )}
      style={
        isLock
          ? {
              borderWidth: 2,
              shadowColor: THEME_COLORS.gold,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.55,
              shadowRadius: 18,
              opacity: 1,
            }
          : { opacity: dim ? 0.78 : 1 }
      }>
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
              <Badge betType={bet.bet_type} />
              {isLock ? <LockBadge compact /> : null}
            </View>
            <Text
              className={cn(
                'font-black uppercase text-white',
                isLock ? 'text-xl' : 'text-base',
              )}
              style={{ letterSpacing: -0.3 }}
              numberOfLines={2}>
              {bet.bet_type === 'straight'
                ? bet.bet_legs[0]?.selection ?? 'Straight pick'
                : `${bet.bet_legs.length}-leg ${bet.bet_type}`}
            </Text>
          </View>
          <Badge label={allLocked ? 'Closed' : 'Editable'} tone={allLocked ? 'red' : 'green'} />
        </View>
        {bet.bet_legs.map((leg) => {
          const legLocked =
            leg.locked || new Date(leg.game_start_time).getTime() <= Date.now();
          return (
            <View className="rounded-2xl bg-white/[0.04] p-3" key={leg.id}>
              <View className="flex-row justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-black text-white">{leg.selection}</Text>
                  <Text className="mt-1 text-[11px] font-semibold text-white/45">
                    {marketLabel(leg.market)} · {formatGameTime(leg.game_start_time)}
                  </Text>
                </View>
                <Badge
                  label={legLocked ? 'Closed' : 'Open'}
                  tone={legLocked ? 'red' : 'green'}
                />
              </View>
              {bet.bet_type === 'teaser' ? (
                <Text className="mt-2 text-[11px] font-black text-cyan-accent">
                  {formatLine(leg.original_line)} → {formatLine(leg.adjusted_line)}
                </Text>
              ) : null}
            </View>
          );
        })}
        <View className="flex-row items-center justify-between border-t border-white/[0.08] pt-3">
          <Text
            className="text-[11px] font-black uppercase text-white/55"
            style={{ letterSpacing: 1.5 }}>
            {formatAmericanOdds(bet.odds)} · {formatCurrency(bet.amount)}
          </Text>
          <View className="items-end">
            <Text
              className={cn(
                'text-sm font-black',
                isLock ? 'text-gold' : 'text-electric-green',
              )}>
              Reward {formatCurrency(displayedReward)}
              {cappedParlay ? ' (capped)' : ''}
            </Text>
            {isLock ? (
              <Text
                className="mt-0.5 text-[10px] font-semibold text-gold/85"
                style={{ letterSpacing: 0.4 }}>
                base {formatCurrency(bet.potential_payout)} × 1.5
              </Text>
            ) : null}
          </View>
        </View>
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
    </LockEffect>
  );
}

function PlacedBetsView({
  bets,
  cosmetics,
  userId,
}: {
  bets: PlacedBet[];
  cosmetics?: EquippedCosmeticsByCategory;
  userId: string | undefined;
}) {
  const shareBet = useShareBetToChat(userId);
  const totalAllocated = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const totalReward = bets.reduce((sum, bet) => sum + getDisplayedPlacedPayout(bet), 0);

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
            <Ionicons color={THEME_COLORS.electricGreen} name="lock-closed" size={14} />
            <Text
              className="text-[10px] font-black uppercase text-electric-green"
              style={{ letterSpacing: 2.5 }}>
              Card Submitted
            </Text>
          </View>
          <Text
            className="text-2xl font-black uppercase text-white"
            style={{ letterSpacing: -0.4 }}>
            This Week is Submitted
          </Text>
          <Text className="text-sm font-semibold text-white/55">
            Multi-pick cards stay editable until every leg's game starts.
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Text
              className="text-[10px] font-black uppercase text-white/45"
              style={{ letterSpacing: 1.5 }}>
              Allocated
            </Text>
            <Text className="text-sm font-black text-white">{formatCurrency(totalAllocated)}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text
              className="text-[10px] font-black uppercase text-white/45"
              style={{ letterSpacing: 1.5 }}>
              Potential Reward
            </Text>
            <Text className="text-sm font-black text-electric-green">
              {formatCurrency(totalReward)}
            </Text>
          </View>
        </View>
      </Card>

      {orderedBets.map((bet, index) => (
        <PlacedBetCard
          bet={bet}
          cosmetics={cosmetics}
          isLockHeadline={index === 0 && bet.is_lock}
          key={bet.id}
          onShare={() => handleShare(bet)}
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
  const leaguesQuery = useMyLeagues(user?.id);
  const oddsQuery = useUpcomingNflOdds();
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
  const [tourVisible, setTourVisible] = useState(false);

  const leagueSummaries = leaguesQuery.data ?? [];
  const leagues = leagueSummaries.map((summary) => summary.league);
  const selectedLeague = leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0];
  const accessQuery = useBetBoardAccess({
    leagueId: selectedLeague?.id,
    userId: user?.id,
    weekNumber: selectedLeague?.current_week,
  });
  const placedBetsQuery = usePlacedBets(selectedLeague?.id, user?.id, selectedLeague?.current_week);
  const submitBets = useSubmitBetsMutation(selectedLeague?.id, user?.id, selectedLeague?.current_week);
  const placedBets = placedBetsQuery.data ?? [];
  const isReadOnly = placedBets.length > 0;
  const canAccessBetBoard = accessQuery.data ?? true;
  const validation = useMemo(() => getValidationState(slipBets), [slipBets]);

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
    setSlipBets([]);
    setEditingSlipBet(null);
    setPendingStraightSelection(null);
    setParlayLegs([]);
    setTeaserLegs([]);
    setParlayAmount('');
    setTeaserAmount('');
  }, [selectedLeagueId]);

  useEffect(() => {
    if (!tourFlag.isLoading && !tourFlag.value && leagues.length > 0) {
      setTourVisible(true);
    }
  }, [leagues.length, tourFlag.isLoading, tourFlag.value]);

  const addBuilderLeg = (currentLegs: SlipLeg[], nextLeg: SlipLeg, maxLegs: number) => {
    if (currentLegs.some((leg) => leg.selectionKey === nextLeg.selectionKey)) {
      haptics.light();
      return currentLegs.filter((leg) => leg.selectionKey !== nextLeg.selectionKey);
    }

    if (currentLegs.length >= maxLegs) {
      haptics.warning();
      Alert.alert('Leg limit reached', `This pick can have up to ${maxLegs} legs.`);
      return currentLegs;
    }

    const conflictingLeg = findContradictingLeg(currentLegs, nextLeg);
    if (conflictingLeg) {
      haptics.warning();
      Alert.alert(
        'Conflicting legs',
        `${formatLegConflictLabel(nextLeg)} conflicts with ${formatLegConflictLabel(
          conflictingLeg,
        )} on ${formatMatchupLabel(nextLeg)}. Choose one side.`,
      );
      return currentLegs;
    }

    haptics.light();
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

    if (mode === 'straight') {
      haptics.light();
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

    setSlipBets((current) => {
      const existing = current.find((item) => item.id === bet.id);
      return [
        ...current.filter((item) => item.id !== bet.id),
        { ...bet, is_lock: existing?.is_lock ?? false },
      ];
    });
    setParlayLegs([]);
    setParlayAmount('');
    setSlipSnap(1);
  };

  const addTeaserToSlip = () => {
    const amount = Number(teaserAmount);
    const odds = getTeaserOdds(teaserLegs.length, teaserPoints);
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

    setSlipBets((current) => {
      const existing = current.find((item) => item.id === bet.id);
      return [
        ...current.filter((item) => item.id !== bet.id),
        { ...bet, is_lock: existing?.is_lock ?? false },
      ];
    });
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

  if (leaguesQuery.isLoading) {
    return (
      <ScreenWrapper>
        <OddsSkeletons />
      </ScreenWrapper>
    );
  }

  if (leagues.length === 0) {
    return (
      <ScreenWrapper centered>
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
        </View>
      </ScreenWrapper>
    );
  }

  const sheetVisible = !isReadOnly;
  const slipBottomPadding = sheetVisible ? LINEUP_COLLAPSED_HEIGHT + 20 : 32;

  return (
    <View style={{ backgroundColor: THEME_COLORS.background, flex: 1 }}>
      <ScreenWrapper className="pb-0">
        <FlatList
          contentContainerStyle={{ paddingBottom: slipBottomPadding }}
          data={isReadOnly || !canAccessBetBoard ? [] : oddsQuery.data ?? []}
          keyExtractor={(game) => game.id}
          ListHeaderComponent={
            <View className="gap-5 pb-5">
              <BoardHeader league={selectedLeague} />

              {!isReadOnly ? (
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

              <BudgetTracker
                placedBets={isReadOnly ? placedBets : undefined}
                slipBets={slipBets}
              />

              {!isReadOnly && !canAccessBetBoard ? (
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

              {!isReadOnly && canAccessBetBoard && mode === 'parlay' ? (
                <ParlayBuilder
                  amountText={parlayAmount}
                  legs={parlayLegs}
                  onAddToSlip={addParlayToSlip}
                  onAmountChange={setParlayAmount}
                  onRemoveLeg={(id) =>
                    setParlayLegs((current) => current.filter((leg) => leg.id !== id))
                  }
                />
              ) : null}

              {!isReadOnly && canAccessBetBoard && mode === 'teaser' ? (
                <TeaserBuilder
                  amountText={teaserAmount}
                  legs={teaserLegs}
                  onAddToSlip={addTeaserToSlip}
                  onAmountChange={setTeaserAmount}
                  onRemoveLeg={(id) =>
                    setTeaserLegs((current) => current.filter((leg) => leg.id !== id))
                  }
                  onTeaserPointsChange={(points) => {
                    setTeaserPoints(points);
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
                                  selection: leg.selection.startsWith('Over')
                                    ? 'Over'
                                    : leg.selection.startsWith('Under')
                                      ? 'Under'
                                      : leg.selection,
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
              {isReadOnly ? (
                <PlacedBetsView
                  bets={placedBets}
                  cosmetics={cosmeticsQuery.data?.equippedByCategory}
                  userId={user?.id}
                />
              ) : null}

              {!isReadOnly && canAccessBetBoard && oddsQuery.isError ? (
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
              {!isReadOnly && canAccessBetBoard && oddsQuery.isLoading ? <OddsSkeletons /> : null}
            </View>
          }
          ListEmptyComponent={
            !isReadOnly && canAccessBetBoard && !oddsQuery.isLoading && !oddsQuery.isError ? (
              <Card>
                <View className="items-center gap-3 py-4">
                  <View className="h-14 w-14 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
                    <Ionicons color={THEME_COLORS.electricGreen} name="football" size={26} />
                  </View>
                  <Text
                    className="text-center text-xl font-black uppercase text-white"
                    style={{ letterSpacing: -0.3 }}>
                    Lines Loading Up
                  </Text>
                  <Text className="px-2 text-center text-sm font-semibold leading-5 text-white/55">
                    No NFL lines are showing yet. Check your connection, then pull
                    down to refresh.
                  </Text>
                  <Button
                    onPress={() => {
                      haptics.selection();
                      void oddsQuery.refetch();
                    }}
                    title="Try Again"
                    variant="secondary"
                  />
                </View>
              </Card>
            ) : null
          }
          refreshControl={
            <RefreshControl
              tintColor={THEME_COLORS.electricGreen}
              refreshing={oddsQuery.isRefetching || placedBetsQuery.isRefetching || accessQuery.isRefetching}
              onRefresh={() => {
                void oddsQuery.refetch();
                void placedBetsQuery.refetch();
                void accessQuery.refetch();
              }}
            />
          }
          renderItem={({ index, item }) => (
            <StaggeredItem index={index} perItemDelay={50}>
              <GameCard
                builderLegSelectionKeys={builderLegSelectionKeys}
                game={item}
                market={
                  marketByGameId[item.id] ?? (mode === 'teaser' ? 'spread' : 'moneyline')
                }
                mode={mode}
                onMarketChange={(market) =>
                  setMarketByGameId((current) => ({ ...current, [item.id]: market }))
                }
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
