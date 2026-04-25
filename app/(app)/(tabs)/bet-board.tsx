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

import {
  AnimatedBar,
  AnimatedNumber,
  Badge,
  BottomSheet,
  Button,
  Card,
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
  MAX_SINGLE_BET,
  MINIMUM_BETS_PER_WEEK,
  PARLAY_PAYOUT_CAP,
  TEASER_ODDS_LOOKUP,
  WEEKLY_BUDGET,
} from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useShareBetToChat } from '@/hooks/use-league-chat';
import { LOCAL_FLAG_KEYS, useLocalFlag } from '@/hooks/use-local-flags';
import { useMyLeagues } from '@/hooks/use-leagues';
import { useUpcomingNflOdds } from '@/hooks/use-odds';
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
} from '@/lib/format';
import { haptics } from '@/lib/haptics';
import type { OddsGame, OddsSelection } from '@/lib/odds-api';
import type { BetMarket, BetType, LeagueRow, TeaserLegCount, TeaserPoints } from '@/types/database';

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
  rawPotentialPayout?: number;
};

type PendingStraightSelection = {
  game: OddsGame;
  selection: OddsSelection;
};

type ValidationState = {
  errors: string[];
  warnings: string[];
};

const MARKET_OPTIONS: SegmentedOption<BetMarket>[] = [
  { icon: 'cash', label: 'Money', value: 'moneyline' },
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

type TourAnchor = 'top' | 'middle' | 'bottom';

const TOUR_STEPS: {
  anchor: TourAnchor;
  body: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
}[] = [
  {
    anchor: 'top',
    body: 'This bar tracks the full $100 weekly budget, what is allocated, what remains, and your progress toward the 5-bet minimum.',
    icon: 'wallet',
    title: 'Budget tracker',
  },
  {
    anchor: 'middle',
    body: 'Tap an odds button on a game card, set the dollar amount, and the pick lands in your slip immediately.',
    icon: 'finger-print',
    title: 'Select a bet',
  },
  {
    anchor: 'top',
    body: 'Use the Straight, Parlay, and Teaser toggle to change how picks are built. Parlay is amber, teaser is cyan.',
    icon: 'swap-horizontal',
    title: 'Switch bet modes',
  },
  {
    anchor: 'bottom',
    body: 'Pull up the slip from the bottom to review picks, payouts, remaining budget, and remove anything before locking in.',
    icon: 'receipt',
    title: 'Bet slip',
  },
  {
    anchor: 'middle',
    body: 'The submit button stays disabled until you have at least 5 bets, no bet over $35, exactly $100 allocated, and no duplicate game sides.',
    icon: 'checkmark-done',
    title: 'Validation rules',
  },
];

function marketLabel(market: BetMarket) {
  if (market === 'moneyline') return 'Moneyline';
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
  const payout = calculatePotentialPayout(amount, selection.odds);

  return {
    amount,
    bet_type: 'straight',
    id: `straight:${leg.id}`,
    label: leg.label,
    legs: [leg],
    odds: selection.odds,
    potential_payout: payout,
    teaser_points: null,
  };
}

function calculateParlayDecimalOdds(legs: SlipLeg[]) {
  return legs.reduce((product, leg) => product * americanOddsToDecimal(leg.leg_odds), 1);
}

function getParlayOdds(legs: SlipLeg[]) {
  return decimalOddsToAmerican(calculateParlayDecimalOdds(legs));
}

function calculateParlayPayout(amount: number, legs: SlipLeg[]) {
  const rawPayout = Number((amount * calculateParlayDecimalOdds(legs)).toFixed(2));
  return {
    cappedPayout: Math.min(rawPayout, PARLAY_PAYOUT_CAP),
    rawPayout,
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

function getGameCountDuplicates(legs: SlipLeg[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  legs.forEach((leg) => {
    if (seen.has(leg.game_id)) {
      duplicates.add(leg.game_id);
    }
    seen.add(leg.game_id);
  });

  return duplicates;
}

function getSelectionDuplicates(legs: SlipLeg[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  legs.forEach((leg) => {
    if (seen.has(leg.selectionKey)) {
      duplicates.add(leg.selectionKey);
    }
    seen.add(leg.selectionKey);
  });

  return duplicates;
}

function getValidationState(slipBets: SlipBet[]): ValidationState {
  const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
  const allLegs = slipBets.flatMap((bet) => bet.legs);
  const duplicateGames = getGameCountDuplicates(allLegs);
  const duplicateSelections = getSelectionDuplicates(allLegs);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (slipBets.length < MINIMUM_BETS_PER_WEEK) {
    const remaining = MINIMUM_BETS_PER_WEEK - slipBets.length;
    errors.push(`Add ${remaining} more bet${remaining === 1 ? '' : 's'} to hit the weekly minimum.`);
  }

  if (slipBets.some((bet) => bet.amount > MAX_SINGLE_BET)) {
    errors.push(`No single bet can exceed ${formatCurrency(MAX_SINGLE_BET)}.`);
  }

  if (totalAllocated < WEEKLY_BUDGET) {
    errors.push(`Allocate ${formatCurrency(WEEKLY_BUDGET - totalAllocated)} more of your weekly budget.`);
  }

  if (totalAllocated > WEEKLY_BUDGET) {
    errors.push(`You are ${formatCurrency(totalAllocated - WEEKLY_BUDGET)} over the weekly budget.`);
  }

  if (duplicateGames.size > 0) {
    errors.push('Only one selection per game across all bet types.');
  }

  if (duplicateSelections.size > 0) {
    errors.push('Same selection used twice — pick something different.');
  }

  slipBets.forEach((bet) => {
    const uniqueGames = new Set(bet.legs.map((leg) => leg.game_id));

    if (bet.bet_type === 'parlay') {
      if (bet.legs.length < 2 || bet.legs.length > 6) {
        errors.push('Parlays must have between 2 and 6 legs.');
      }
      if (uniqueGames.size !== bet.legs.length) {
        errors.push('Parlays cannot include two legs from the same game.');
      }
      if ((bet.rawPotentialPayout ?? bet.potential_payout) > PARLAY_PAYOUT_CAP) {
        warnings.push(`Parlay payout is capped at ${formatCurrency(PARLAY_PAYOUT_CAP)}.`);
      }
    }

    if (bet.bet_type === 'teaser') {
      if (bet.legs.length < 2 || bet.legs.length > 4) {
        errors.push('Teasers must have between 2 and 4 legs.');
      }
      if (uniqueGames.size !== bet.legs.length) {
        errors.push('Teasers cannot include two legs from the same game.');
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
        Bet Board
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
                prefix="$"
                style={{ letterSpacing: -0.8 }}
                value={totalAllocated}
                decimals={totalAllocated % 1 === 0 ? 0 : 2}
              />
              <Text className="text-base font-black text-white/40" style={{ letterSpacing: -0.4 }}>
                {' / '}
                {formatCurrency(WEEKLY_BUDGET)}
              </Text>
            </View>
          </View>
          <View
            className={cn(
              'flex-row items-center gap-1 rounded-full border px-3 py-1',
              minimumMet
                ? 'border-electric-green/40 bg-electric-green/15'
                : 'border-gold/40 bg-gold/10',
            )}>
            <Ionicons
              color={minimumMet ? THEME_COLORS.electricGreen : THEME_COLORS.gold}
              name={minimumMet ? 'checkmark-circle' : 'alert-circle'}
              size={12}
            />
            <Text
              className={cn(
                'text-[10px] font-black uppercase',
                minimumMet ? 'text-electric-green' : 'text-gold',
              )}
              style={{ letterSpacing: 1.5 }}>
              {displayedBets.length}/{MINIMUM_BETS_PER_WEEK} bets
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
            prefix={remaining < 0 ? '-$' : '$'}
            style={{ letterSpacing: -0.3 }}
            value={Math.abs(remaining)}
            decimals={Math.abs(remaining) % 1 === 0 ? 0 : 2}
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
  if (leagues.length <= 1) {
    return null;
  }

  return (
    <View className="gap-2">
      <Text
        className="text-[10px] font-black uppercase text-white/50"
        style={{ letterSpacing: 2 }}>
        Active League
      </Text>
      <FlatList
        data={leagues}
        horizontal
        keyExtractor={(league) => league.id}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedLeagueId;
          return (
            <PressableScale
              onPress={() => {
                haptics.selection();
                onSelect(item.id);
              }}
              style={{ marginRight: 8 }}>
              <View
                className={cn(
                  'rounded-full border px-4 py-2',
                  isSelected
                    ? 'border-electric-green bg-electric-green/15'
                    : 'border-white/10 bg-white/[0.04]',
                )}>
                <Text
                  className={cn(
                    'text-xs font-black uppercase',
                    isSelected ? 'text-electric-green' : 'text-white/65',
                  )}
                  style={{ letterSpacing: 1.2 }}>
                  {item.name}
                </Text>
              </View>
            </PressableScale>
          );
        }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

// ============================================================
// Game Card
// ============================================================

function OddsButton({
  disabled,
  isSelected,
  mode,
  onPress,
  selection,
}: {
  disabled?: boolean;
  isSelected: boolean;
  mode: BetMode;
  onPress: () => void;
  selection: OddsSelection;
}) {
  const tone = getModeTone(mode);
  const accentHex = modeAccentHex(mode);

  return (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.94}
      style={{ flex: 1, opacity: disabled ? 0.32 : 1 }}>
      <View
        className={cn(
          'min-h-[70px] flex-1 items-center justify-center rounded-2xl border px-3 py-3',
          isSelected ? '' : 'bg-white/[0.04]',
          tone === 'green' && !isSelected ? 'border-electric-green/15' : null,
          tone === 'amber' && !isSelected ? 'border-amber-accent/20' : null,
          tone === 'cyan' && !isSelected ? 'border-cyan-accent/20' : null,
        )}
        style={
          isSelected
            ? {
                backgroundColor: `${accentHex}26`,
                borderColor: accentHex,
                shadowColor: accentHex,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.55,
                shadowRadius: 12,
              }
            : undefined
        }>
        <Text
          className="text-center text-[10px] font-black uppercase text-white/55"
          style={{ letterSpacing: 1.2 }}>
          {getSelectionLabel(selection)}
        </Text>
        <Text
          className="mt-1 text-lg font-black"
          style={{
            color: isSelected ? accentHex : accentHex,
            letterSpacing: -0.3,
          }}>
          {formatAmericanOdds(selection.odds)}
        </Text>
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
}: {
  builderLegSelectionKeys: Set<string>;
  game: OddsGame;
  market: BetMarket;
  mode: BetMode;
  onMarketChange: (market: BetMarket) => void;
  onSelect: (selection: OddsSelection) => void;
  readOnly: boolean;
}) {
  const resolvedMarket = mode === 'teaser' && market === 'moneyline' ? 'spread' : market;
  const selections = game.markets[resolvedMarket];
  const accentHex = modeAccentHex(mode);

  const marketOptions = useMemo(
    () =>
      MARKET_OPTIONS.map((option) => ({
        ...option,
        accent: getModeTone(mode),
        disabled: mode === 'teaser' && option.value === 'moneyline',
      })),
    [mode],
  );

  return (
    <Card style={{ marginBottom: 14 }}>
      <View className="gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Ionicons color={THEME_COLORS.electricGreen} name="time-outline" size={11} />
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                {formatGameTime(game.commenceTime)}
              </Text>
            </View>
            <Text
              className="text-xl font-black uppercase text-white"
              style={{ letterSpacing: -0.4 }}
              numberOfLines={2}>
              {game.awayTeam}
              {'  '}
              <Text style={{ color: accentHex }}>@</Text>
              {'  '}
              {game.homeTeam}
            </Text>
          </View>
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
              {marketLabel(resolvedMarket)} odds aren't published for this game yet.
            </Text>
          </View>
        ) : (
          <View className="flex-row gap-2">
            {selections.map((selection) => {
              const key = getSelectionKey(game.id, selection);
              const isSelected = builderLegSelectionKeys.has(key);
              return (
                <OddsButton
                  disabled={readOnly}
                  isSelected={isSelected}
                  key={`${selection.market}:${selection.selection}:${selection.line ?? 'na'}`}
                  mode={mode}
                  selection={selection}
                  onPress={() => onSelect(selection)}
                />
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

  return (
    <View className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
      <View className="flex-row justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-sm font-black text-white" numberOfLines={1}>
            {leg.label}
          </Text>
          <Text className="text-[11px] font-semibold text-white/45">
            {leg.awayTeam} at {leg.homeTeam}
          </Text>
        </View>
        <View className="items-end gap-2">
          <Badge label={isLocked ? 'Locked' : 'Open'} tone={isLocked ? 'red' : 'green'} />
          {onRemove ? (
            <Pressable
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
  const { cappedPayout, rawPayout } =
    legs.length > 0 && Number.isFinite(amount)
      ? calculateParlayPayout(amount || 0, legs)
      : { cappedPayout: 0, rawPayout: 0 };
  const canAdd = legs.length >= 2 && legs.length <= 6 && Number.isFinite(amount) && amount > 0;
  const overCap = rawPayout > PARLAY_PAYOUT_CAP;

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
                  Combined Odds
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
                  Pays
                </Text>
                <AnimatedNumber
                  className="text-2xl font-black text-white"
                  decimals={2}
                  prefix="$"
                  style={{ letterSpacing: -0.5 }}
                  value={cappedPayout}
                />
              </View>
            </View>
          </View>

          {overCap ? (
            <View className="flex-row items-center gap-2 rounded-2xl border border-amber-accent/40 bg-amber-accent/10 p-3">
              <Ionicons color={THEME_COLORS.amberAccent} name="alert-circle" size={16} />
              <Text className="flex-1 text-xs font-semibold text-amber-accent">
                Raw payout {formatCurrency(rawPayout)} hits the {formatCurrency(PARLAY_PAYOUT_CAP)} cap.
              </Text>
            </View>
          ) : null}

          {legs.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] py-6">
              <Ionicons color={THEME_COLORS.amberAccent} name="add-circle-outline" size={28} />
              <Text className="mt-2 text-sm font-semibold text-white/55">
                Tap odds on different games to add legs.
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
            title="Add Parlay to Slip"
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
  const payout = odds && Number.isFinite(amount) ? calculatePotentialPayout(amount || 0, odds) : 0;
  const canAdd = Boolean(odds && Number.isFinite(amount) && amount > 0);

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
                  Lookup Odds
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
                  Pays
                </Text>
                <AnimatedNumber
                  className="text-2xl font-black text-white"
                  decimals={2}
                  prefix="$"
                  style={{ letterSpacing: -0.5 }}
                  value={payout}
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
                Tap spreads or totals to add legs from different games.
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
            title="Add Teaser to Slip"
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

function SlipBetCard({ bet, onRemove }: { bet: SlipBet; onRemove: (id: string) => void }) {
  const accentByType = bet.bet_type === 'parlay'
    ? THEME_COLORS.amberAccent
    : bet.bet_type === 'teaser'
      ? THEME_COLORS.cyanAccent
      : THEME_COLORS.electricGreen;

  return (
    <View style={{ marginBottom: 10 }}>
      <SwipeableRow onRemove={() => onRemove(bet.id)}>
        <View
          className="rounded-2xl border bg-white/[0.04] p-4"
          style={{ borderColor: `${accentByType}66` }}>
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
              <Text
                className="text-base font-black text-white"
                style={{ letterSpacing: -0.3 }}
                numberOfLines={2}>
                {bet.label}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                haptics.light();
                onRemove(bet.id);
              }}>
              <Ionicons color={THEME_COLORS.coralRed} name="close-circle" size={22} />
            </Pressable>
          </View>

          <View className="mt-3 gap-2">
            {bet.legs.map((leg) => (
              <View key={leg.id} className="rounded-xl bg-white/[0.04] p-2">
                <Text className="text-[12px] font-black text-white" numberOfLines={1}>
                  {leg.label}
                </Text>
                {bet.bet_type === 'teaser' ? (
                  <Text className="mt-1 text-[10px] font-black text-cyan-accent">
                    {formatLine(leg.original_line)} → {formatLine(leg.adjusted_line)}
                  </Text>
                ) : (
                  <Text className="mt-1 text-[10px] font-semibold text-white/45">
                    {formatAmericanOdds(leg.leg_odds)} · {leg.awayTeam} at {leg.homeTeam}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View className="mt-3 flex-row items-center justify-between border-t border-white/[0.08] pt-3">
            <View>
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Stake
              </Text>
              <Text className="mt-0.5 text-base font-black text-white">
                {formatCurrency(bet.amount)}
              </Text>
            </View>
            <View className="items-end">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Pays
              </Text>
              <Text
                className="mt-0.5 text-base font-black"
                style={{ color: accentByType, letterSpacing: -0.3 }}>
                {formatCurrency(bet.potential_payout)}
              </Text>
            </View>
          </View>
        </View>
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
  const totalPayout = slipBets.reduce((sum, bet) => sum + bet.potential_payout, 0);
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
      <View className="flex-row justify-between">
        <Text
          className="text-[11px] font-black uppercase text-white/55"
          style={{ letterSpacing: 1.5 }}>
          Potential Payout
        </Text>
        <Text className="text-sm font-black text-electric-green">{formatCurrency(totalPayout)}</Text>
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
            Card is locked &amp; ready
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// Bet Slip Bottom Sheet
// ============================================================

function BetSlipSheet({
  isSubmitting,
  onRemove,
  onSnapChange,
  onSubmit,
  slipBets,
  snap,
  validation,
  visible,
}: {
  isSubmitting: boolean;
  onRemove: (id: string) => void;
  onSnapChange: (index: SnapIndex) => void;
  onSubmit: () => void;
  slipBets: SlipBet[];
  snap: SnapIndex;
  validation: ValidationState;
  visible: boolean;
}) {
  const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
  const remaining = WEEKLY_BUDGET - totalAllocated;
  const canSubmit = validation.errors.length === 0 && slipBets.length > 0;

  return (
    <BottomSheet
      collapsedHeight={104}
      header={
        <View className="px-5 pb-3 pt-1">
          <View className="flex-row items-center justify-between">
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
                  Bet Slip
                </Text>
                <Text
                  className="text-base font-black text-white"
                  style={{ letterSpacing: -0.3 }}>
                  {slipBets.length === 0
                    ? 'Build your weekly card'
                    : `${slipBets.length}/${MINIMUM_BETS_PER_WEEK} bets · ${formatCurrency(totalAllocated)}`}
                </Text>
              </View>
            </View>
            <View className="items-end">
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
            </View>
          </View>
        </View>
      }
      onSnapChange={onSnapChange}
      snap={snap}
      visible={visible}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 4 }}>
        <FlatList
          contentContainerStyle={{ paddingBottom: 16 }}
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
                Slip is Empty
              </Text>
              <Text className="px-4 text-center text-sm font-semibold text-white/55">
                Tap odds, build a parlay, or stack a teaser to get started.
              </Text>
            </View>
          }
          renderItem={({ index, item }) => (
            <StaggeredItem index={index} perItemDelay={45}>
              <SlipBetCard bet={item} onRemove={onRemove} />
            </StaggeredItem>
          )}
          showsVerticalScrollIndicator={false}
        />
        {slipBets.length > 0 ? (
          <View className="gap-3 pb-4 pt-1">
            <SlipSummary slipBets={slipBets} validation={validation} />
            <Button
              disabled={!canSubmit}
              loading={isSubmitting}
              onPress={() => {
                haptics.medium();
                onSubmit();
              }}
              title={canSubmit ? 'Review & Lock In' : 'Resolve Issues to Submit'}
            />
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

// ============================================================
// Amount Modal (with quick chips)
// ============================================================

function AmountModal({
  onClose,
  onSave,
  pendingSelection,
}: {
  onClose: () => void;
  onSave: (amount: number) => void;
  pendingSelection: PendingStraightSelection | null;
}) {
  const [amountText, setAmountText] = useState('');

  useEffect(() => {
    setAmountText('');
  }, [pendingSelection]);

  const parsedAmount = Number(amountText);
  const amountError =
    amountText.length > 0 && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
      ? 'Enter a valid amount.'
      : parsedAmount > MAX_SINGLE_BET
        ? `Max single bet is ${formatCurrency(MAX_SINGLE_BET)}.`
        : undefined;

  const canSave =
    !amountError && Number.isFinite(parsedAmount) && parsedAmount > 0 && pendingSelection !== null;

  const setQuickAmount = (value: number) => {
    haptics.selection();
    setAmountText(String(value));
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(pendingSelection)}
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
                    Stake This Pick
                  </Text>
                </View>
                <Text
                  className="mt-2 text-2xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.4 }}>
                  Set Amount
                </Text>
                {pendingSelection ? (
                  <Text className="mt-2 text-sm font-semibold text-white/55">
                    {getSelectionLabel(pendingSelection.selection)} ·{' '}
                    {formatAmericanOdds(pendingSelection.selection.odds)}
                  </Text>
                ) : null}
              </View>

              <View className="flex-row gap-2">
                {QUICK_AMOUNTS.map((value) => {
                  const isSelected = Number(amountText) === value;
                  return (
                    <PressableScale
                      key={value}
                      onPress={() => setQuickAmount(value)}
                      pressedScale={0.94}
                      style={{ flex: 1 }}>
                      <View
                        className={cn(
                          'items-center rounded-2xl border px-2 py-3',
                          isSelected
                            ? 'border-electric-green bg-electric-green/15'
                            : 'border-white/10 bg-white/[0.04]',
                        )}>
                        <Text
                          className={cn(
                            'text-base font-black',
                            isSelected ? 'text-electric-green' : 'text-white',
                          )}
                          style={{ letterSpacing: -0.3 }}>
                          ${value}
                        </Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>

              <TextInput
                error={amountError}
                keyboardType="decimal-pad"
                label="Custom amount"
                onChangeText={setAmountText}
                placeholder="20"
                value={amountText}
              />

              {Number.isFinite(parsedAmount) && parsedAmount > 0 && pendingSelection ? (
                <View className="flex-row items-center gap-2 rounded-2xl border border-electric-green/30 bg-electric-green/10 px-3 py-3">
                  <Ionicons color={THEME_COLORS.electricGreen} name="cash" size={16} />
                  <Text className="text-sm font-black text-electric-green">
                    Pays{' '}
                    {formatCurrency(
                      calculatePotentialPayout(
                        parsedAmount,
                        pendingSelection.selection.odds,
                      ),
                    )}
                  </Text>
                </View>
              ) : null}

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button title="Cancel" variant="secondary" onPress={onClose} />
                </View>
                <View className="flex-1">
                  <Button
                    disabled={!canSave}
                    onPress={() => {
                      haptics.medium();
                      onSave(Number(parsedAmount.toFixed(2)));
                    }}
                    title="Add to Slip"
                  />
                </View>
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

  return (
    <View
      className="rounded-2xl border bg-white/[0.04] p-3"
      style={{ borderColor: `${accentByType}55` }}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Badge betType={bet.bet_type} />
          <Text
            className="text-[10px] font-black uppercase text-white/45"
            style={{ letterSpacing: 1.5 }}>
            {formatAmericanOdds(bet.odds)}
          </Text>
        </View>
        <Text
          className="text-sm font-black"
          style={{ color: accentByType, letterSpacing: -0.3 }}>
          {formatCurrency(bet.amount)} → {formatCurrency(bet.potential_payout)}
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
  const totalPayout = slipBets.reduce((sum, bet) => sum + bet.potential_payout, 0);

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
                  Final Lock
                </Text>
                <Text
                  className="text-2xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.4 }}>
                  Lock In Your Card
                </Text>
                <Text className="px-4 text-center text-sm font-semibold text-white/55">
                  Odds and lines are frozen at submit. No edits once games kick off.
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
                          {type === 'straight' ? 'Straight Bets' : type === 'parlay' ? 'Parlays' : 'Teasers'} · {items.length}
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
                    Stake
                  </Text>
                  <Text className="text-sm font-black text-white">
                    {formatCurrency(totalAllocated)}
                  </Text>
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text
                    className="text-[11px] font-black uppercase text-white/55"
                    style={{ letterSpacing: 1.5 }}>
                    Potential Payout
                  </Text>
                  <Text className="text-base font-black text-electric-green">
                    {formatCurrency(totalPayout)}
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
                    title="Lock In Bets"
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
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

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
      <View className="flex-1 justify-start gap-2 px-5 pt-8">
        {tooltip}
        <TourArrow direction="up" />
      </View>
    ) : current.anchor === 'bottom' ? (
      <View className="flex-1 justify-end gap-2 px-5 pb-8">
        <TourArrow direction="down" />
        {tooltip}
      </View>
    ) : (
      <View className="flex-1 justify-center gap-2 px-5">
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

function PlacedBetsView({ bets, userId }: { bets: PlacedBet[]; userId: string | undefined }) {
  const shareBet = useShareBetToChat(userId);
  const totalAllocated = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const totalPayout = bets.reduce((sum, bet) => sum + bet.potential_payout, 0);

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
            This Week is Locked
          </Text>
          <Text className="text-sm font-semibold text-white/55">
            Multi-leg bets stay editable until every leg's game starts.
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
              Potential Payout
            </Text>
            <Text className="text-sm font-black text-electric-green">
              {formatCurrency(totalPayout)}
            </Text>
          </View>
        </View>
      </Card>

      {bets.map((bet) => {
        const allLocked = bet.bet_legs.every(
          (leg) => leg.locked || new Date(leg.game_start_time).getTime() <= Date.now(),
        );
        return (
          <Card key={bet.id}>
            <View className="gap-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-2">
                  <Badge betType={bet.bet_type} />
                  <Text
                    className="text-lg font-black uppercase text-white"
                    style={{ letterSpacing: -0.3 }}
                    numberOfLines={2}>
                    {bet.bet_type === 'straight'
                      ? bet.bet_legs[0]?.selection ?? 'Straight bet'
                      : `${bet.bet_legs.length}-leg ${bet.bet_type}`}
                  </Text>
                </View>
                <Badge label={allLocked ? 'Locked' : 'Editable'} tone={allLocked ? 'red' : 'green'} />
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
                      <Badge label={legLocked ? 'Locked' : 'Open'} tone={legLocked ? 'red' : 'green'} />
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
                <Text className="text-sm font-black text-electric-green">
                  Pays {formatCurrency(bet.potential_payout)}
                </Text>
              </View>
              <Button
                loading={shareBet.isPending}
                onPress={async () => {
                  try {
                    await shareBet.mutateAsync(bet);
                    Alert.alert('Shared to chat', 'This bet is now in league chat.');
                  } catch (error) {
                    Alert.alert(
                      'Could not share bet',
                      error instanceof Error ? error.message : 'Try again.',
                    );
                  }
                }}
                title="Share to Chat"
                variant="secondary"
              />
            </View>
          </Card>
        );
      })}
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
  const tourFlag = useLocalFlag(LOCAL_FLAG_KEYS.betBoardTourComplete);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | undefined>();
  const [mode, setMode] = useState<BetMode>('straight');
  const [marketByGameId, setMarketByGameId] = useState<Record<string, BetMarket>>({});
  const [slipBets, setSlipBets] = useState<SlipBet[]>([]);
  const [pendingStraightSelection, setPendingStraightSelection] = useState<PendingStraightSelection | null>(null);
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
  const placedBetsQuery = usePlacedBets(selectedLeague?.id, user?.id, selectedLeague?.current_week);
  const submitBets = useSubmitBetsMutation(selectedLeague?.id, user?.id, selectedLeague?.current_week);
  const placedBets = placedBetsQuery.data ?? [];
  const isReadOnly = placedBets.length > 0;
  const validation = useMemo(() => getValidationState(slipBets), [slipBets]);

  const builderLegSelectionKeys = useMemo(() => {
    const keys = new Set<string>();
    if (mode === 'parlay') {
      parlayLegs.forEach((leg) => keys.add(leg.selectionKey));
    } else if (mode === 'teaser') {
      teaserLegs.forEach((leg) => keys.add(leg.selectionKey));
    }
    slipBets.forEach((bet) => bet.legs.forEach((leg) => keys.add(leg.selectionKey)));
    return keys;
  }, [mode, parlayLegs, teaserLegs, slipBets]);

  useEffect(() => {
    if (!selectedLeagueId && leagues[0]) {
      setSelectedLeagueId(leagues[0].id);
    }
  }, [leagues, selectedLeagueId]);

  useEffect(() => {
    setSlipBets([]);
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
    if (currentLegs.length >= maxLegs) {
      haptics.warning();
      Alert.alert('Leg limit reached', `This bet can have up to ${maxLegs} legs.`);
      return currentLegs;
    }

    if (currentLegs.some((leg) => leg.game_id === nextLeg.game_id)) {
      haptics.warning();
      Alert.alert('Same-game legs are not allowed', 'Choose a selection from a different game.');
      return currentLegs;
    }

    if (currentLegs.some((leg) => leg.selectionKey === nextLeg.selectionKey)) {
      haptics.warning();
      Alert.alert('Duplicate selection', 'That selection is already in this builder.');
      return currentLegs;
    }

    haptics.light();
    return [...currentLegs, nextLeg];
  };

  const handleSelectOdds = (game: OddsGame, selection: OddsSelection) => {
    if (!selectedLeague) {
      haptics.warning();
      Alert.alert('Choose a league', 'Join or create a league before placing bets.');
      return;
    }

    if (mode === 'straight') {
      haptics.light();
      setPendingStraightSelection({ game, selection });
      return;
    }

    if (mode === 'parlay') {
      setParlayLegs((current) => addBuilderLeg(current, makeSlipLeg(game, selection), 6));
      return;
    }

    if (selection.market === 'moneyline') {
      haptics.warning();
      Alert.alert('Moneylines are unavailable for teasers', 'Use spreads or over/unders.');
      return;
    }

    const adjustedLine = getAdjustedTeaserLine(selection, teaserPoints);
    setTeaserLegs((current) => addBuilderLeg(current, makeSlipLeg(game, selection, adjustedLine), 4));
  };

  const handleSaveStraightAmount = (amount: number) => {
    if (!pendingStraightSelection) return;

    const nextBet = makeStraightBet(
      pendingStraightSelection.game,
      pendingStraightSelection.selection,
      amount,
    );
    setSlipBets((current) => [...current.filter((bet) => bet.id !== nextBet.id), nextBet]);
    setPendingStraightSelection(null);
    setSlipSnap(1);
  };

  const addParlayToSlip = () => {
    const amount = Number(parlayAmount);
    if (!Number.isFinite(amount) || amount <= 0 || parlayLegs.length < 2) return;

    const { cappedPayout, rawPayout } = calculateParlayPayout(amount, parlayLegs);
    const bet: SlipBet = {
      amount: Number(amount.toFixed(2)),
      bet_type: 'parlay',
      id: `parlay:${parlayLegs.map((leg) => leg.id).join('|')}`,
      label: `${parlayLegs.length}-leg Parlay`,
      legs: parlayLegs,
      odds: getParlayOdds(parlayLegs),
      potential_payout: cappedPayout,
      rawPotentialPayout: rawPayout,
      teaser_points: null,
    };

    setSlipBets((current) => [...current.filter((item) => item.id !== bet.id), bet]);
    setParlayLegs([]);
    setParlayAmount('');
    setSlipSnap(1);
  };

  const addTeaserToSlip = () => {
    const amount = Number(teaserAmount);
    const odds = getTeaserOdds(teaserLegs.length, teaserPoints);
    if (!odds || !Number.isFinite(amount) || amount <= 0) return;

    const bet: SlipBet = {
      amount: Number(amount.toFixed(2)),
      bet_type: 'teaser',
      id: `teaser:${teaserPoints}:${teaserLegs.map((leg) => leg.id).join('|')}`,
      label: `${teaserLegs.length}-leg ${teaserPoints}pt Teaser`,
      legs: teaserLegs,
      odds,
      potential_payout: calculatePotentialPayout(amount, odds),
      teaser_points: teaserPoints,
    };

    setSlipBets((current) => [...current.filter((item) => item.id !== bet.id), bet]);
    setTeaserLegs([]);
    setTeaserAmount('');
    setSlipSnap(1);
  };

  const handleSubmit = () => {
    if (validation.errors.length > 0) return;
    setIsConfirmOpen(true);
  };

  const handleConfirm = async () => {
    try {
      await submitBets.mutateAsync(slipBets);
      setIsConfirmOpen(false);
      setSlipSnap(0);
      setSlipBets([]);
      haptics.success();
      Alert.alert('Bets locked in', 'Your card is set at the selected odds.');
    } catch (error) {
      haptics.error();
      Alert.alert('Could not submit bets', error instanceof Error ? error.message : 'Try again.');
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
            Bet Board
          </Text>
          <Text className="px-2 text-center text-base font-semibold text-white/55">
            Join or create a league before building your weekly card.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  const sheetVisible = !isReadOnly;
  const slipBottomPadding = sheetVisible ? 140 : 32;

  return (
    <View style={{ backgroundColor: THEME_COLORS.background, flex: 1 }}>
      <ScreenWrapper className="pb-0">
        <FlatList
          contentContainerStyle={{ paddingBottom: slipBottomPadding }}
          data={isReadOnly ? [] : oddsQuery.data ?? []}
          keyExtractor={(game) => game.id}
          ListHeaderComponent={
            <View className="gap-5 pb-5">
              <BoardHeader league={selectedLeague} />

              {!isReadOnly ? (
                <View className="gap-2">
                  <Text
                    className="text-[10px] font-black uppercase text-white/50"
                    style={{ letterSpacing: 2 }}>
                    Bet Type
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

              {!isReadOnly && mode === 'parlay' ? (
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

              {!isReadOnly && mode === 'teaser' ? (
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
              {isReadOnly ? <PlacedBetsView bets={placedBets} userId={user?.id} /> : null}

              {!isReadOnly && oddsQuery.isError ? (
                <Card>
                  <View className="flex-row items-center gap-2">
                    <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={16} />
                    <Text className="flex-1 text-sm font-semibold text-coral-red">
                      {oddsQuery.error instanceof Error
                        ? oddsQuery.error.message
                        : 'Unable to load odds right now.'}
                    </Text>
                  </View>
                </Card>
              ) : null}
              {!isReadOnly && oddsQuery.isLoading ? <OddsSkeletons /> : null}
            </View>
          }
          ListEmptyComponent={
            !isReadOnly && !oddsQuery.isLoading && !oddsQuery.isError ? (
              <Card>
                <View className="items-center gap-2 py-2">
                  <Ionicons color={THEME_COLORS.electricGreen} name="football" size={26} />
                  <Text className="text-center text-base font-semibold text-white/55">
                    No upcoming NFL odds available yet. Pull to refresh.
                  </Text>
                </View>
              </Card>
            ) : null
          }
          refreshControl={
            <RefreshControl
              tintColor={THEME_COLORS.electricGreen}
              refreshing={oddsQuery.isRefetching || placedBetsQuery.isRefetching}
              onRefresh={() => {
                void oddsQuery.refetch();
                void placedBetsQuery.refetch();
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
              />
            </StaggeredItem>
          )}
          showsVerticalScrollIndicator={false}
        />
      </ScreenWrapper>

      <AmountModal
        onClose={() => setPendingStraightSelection(null)}
        onSave={handleSaveStraightAmount}
        pendingSelection={pendingStraightSelection}
      />

      <BetSlipSheet
        isSubmitting={submitBets.isPending}
        onRemove={(id) => {
          haptics.light();
          setSlipBets((current) => current.filter((bet) => bet.id !== id));
        }}
        onSnapChange={setSlipSnap}
        onSubmit={handleSubmit}
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
