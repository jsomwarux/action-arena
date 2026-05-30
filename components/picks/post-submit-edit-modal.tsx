import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  ModalShell,
  NflTeamLogo,
  PressableScale,
  SegmentedToggle,
  type SegmentedOption,
} from '@/components/ui';
import {
  PARLAY_PAYOUT_CAP,
  TEASER_MAX_LEGS,
  TEASER_MIN_LEGS,
  TEASER_ODDS_LOOKUP,
} from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import type { BetEditSubmission, BetEditSubmissionLeg, PlacedBet } from '@/hooks/use-straight-bets';
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
import { formatBetLegLabel, formatOddsSelectionLabel, getPickLogoLabel } from '@/lib/pick-labels';
import { isBetLegLocked } from '@/lib/pick-locking';
import {
  findConflictingPick,
  formatPickConflictReason,
} from '@/lib/pick-conflicts';
import type { BetMarket, BetType, TeaserLegCount, TeaserPoints } from '@/types/database';

type BetMode = BetType;

type SlipLeg = {
  adjusted_line: number | null;
  awayTeam: string;
  game_id: string;
  game_start_time: string;
  homeTeam: string;
  id: string;
  label: string;
  leg_odds: number;
  market: BetMarket;
  original_line: number | null;
  selection: string;
  selectionKey: string;
};

type EditingPlacedLeg = SlipLeg & {
  betLegId: string;
  locked: boolean;
};

const MARKET_OPTIONS: SegmentedOption<BetMarket>[] = [
  { icon: 'trophy', label: 'Winner', value: 'moneyline' },
  { icon: 'swap-horizontal', label: 'Spread', value: 'spread' },
  { icon: 'remove-outline', label: 'Total', value: 'over_under' },
];

function marketLabel(market: BetMarket) {
  if (market === 'moneyline') return 'Winner';
  if (market === 'spread') return 'Spread';
  return 'Over/Under';
}

function formatLine(value: number | null) {
  if (value === null) {
    return '-';
  }

  return value > 0 ? `+${value}` : `${value}`;
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

function getLegSelectionKey(leg: Pick<SlipLeg, 'game_id' | 'market' | 'original_line' | 'selection'>) {
  return `${leg.game_id}:${leg.market}:${leg.selection}:${leg.original_line ?? 'na'}`;
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
    locked: isBetLegLocked(leg),
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

function calculateParlayDecimalOdds(legs: Pick<SlipLeg, 'leg_odds'>[]) {
  return legs.reduce((product, leg) => product * americanOddsToDecimal(leg.leg_odds), 1);
}

function getParlayOdds(legs: Pick<SlipLeg, 'leg_odds'>[]) {
  return decimalOddsToAmerican(calculateParlayDecimalOdds(legs));
}

function calculateParlayReward(amount: number, legs: Pick<SlipLeg, 'leg_odds'>[]) {
  const rawReward = Number((amount * calculateParlayDecimalOdds(legs)).toFixed(2));
  return {
    cappedReward: Math.min(rawReward, PARLAY_PAYOUT_CAP),
    rawReward,
  };
}

function getTeaserOdds(legCount: number, teaserPoints: TeaserPoints) {
  if (legCount < TEASER_MIN_LEGS || legCount > TEASER_MAX_LEGS) {
    return null;
  }

  return TEASER_ODDS_LOOKUP[legCount as TeaserLegCount][teaserPoints];
}

function getEditedPlacedBetMetrics(bet: PlacedBet, legs: EditingPlacedLeg[]) {
  if (bet.bet_type === 'parlay') {
    const { cappedReward } = calculateParlayReward(bet.amount, legs);
    return {
      odds: getParlayOdds(legs),
      potential_payout: cappedReward,
      teaser_points: null,
    };
  }

  if (bet.bet_type === 'teaser') {
    const odds = bet.teaser_points ? getTeaserOdds(legs.length, bet.teaser_points) : null;
    return {
      odds: odds ?? bet.odds,
      potential_payout: odds ? calculatePotentialPayout(bet.amount, odds) : bet.potential_payout,
      teaser_points: bet.teaser_points,
    };
  }

  const odds = legs[0]?.leg_odds ?? bet.odds;
  return {
    odds,
    potential_payout: calculatePotentialPayout(bet.amount, odds),
    teaser_points: null,
  };
}

function formatMatchupLabel(leg: SlipLeg) {
  return `${leg.awayTeam} @ ${leg.homeTeam}`;
}

function formatLegConflictLabel(leg: SlipLeg) {
  return `${leg.label} ${formatAmericanOdds(leg.leg_odds)}`;
}

function formatAddConflictMessage(nextLeg: SlipLeg, existingLeg: SlipLeg) {
  return `Cannot add ${formatLegConflictLabel(nextLeg)}. It directly conflicts with ${formatLegConflictLabel(
    existingLeg,
  )} on ${formatMatchupLabel(nextLeg)} because ${formatPickConflictReason(
    nextLeg,
    existingLeg,
  )}.`;
}

function getPlacedBetConflictLegs(placedBets: PlacedBet[], editingBetId: string, oddsGames: OddsGame[]) {
  return placedBets
    .filter((bet) => bet.id !== editingBetId)
    .flatMap((bet) => makeEditablePlacedLegs(bet, oddsGames));
}

function getSelectedTeamLogoName(leg: SlipLeg) {
  return getPickLogoLabel(leg);
}

function PickConflictNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <View className="rounded-2xl border border-coral-red/35 bg-coral-red/10 p-3">
      <View className="flex-row items-start gap-2">
        <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={16} />
        <Text className="flex-1 text-sm font-semibold leading-5 text-coral-red">{message}</Text>
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

function EditOddsButton({
  isSelected,
  mode,
  onPress,
  selection,
  teaserPoints,
}: {
  isSelected: boolean;
  mode: BetMode;
  onPress: () => void;
  selection: OddsSelection;
  teaserPoints?: TeaserPoints;
}) {
  const accent = modeAccentHex(mode);
  const isTeaser = mode === 'teaser' && teaserPoints !== undefined;
  const primaryLabel = isTeaser ? getTeaserOddsButtonLabel(selection, teaserPoints) : getOddsButtonLabel(selection);

  return (
    <PressableScale
      accessibilityLabel={isTeaser ? primaryLabel : `${primaryLabel} ${formatAmericanOdds(selection.odds)}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      pressedScale={0.96}
      style={{ flex: 1, minWidth: 0 }}>
      <View
        className="min-h-[68px] flex-row items-center gap-2 rounded-2xl border px-2.5 py-3"
        style={{
          backgroundColor: isSelected ? `${accent}2E` : 'rgba(255,255,255,0.04)',
          borderColor: isSelected ? accent : 'rgba(255,255,255,0.08)',
          borderWidth: isSelected ? 2 : 1,
        }}>
        {selection.market === 'over_under' ? (
          <View className="h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
            <Ionicons
              color="rgba(255,255,255,0.92)"
              name={selection.selection.toLowerCase().startsWith('over') ? 'arrow-up' : 'arrow-down'}
              size={14}
            />
          </View>
        ) : (
          <NflTeamLogo size={28} teamName={selection.selection || selection.shortName} />
        )}
        <View className="flex-1">
          <Text className="text-base font-black text-white" numberOfLines={1}>
            {primaryLabel}
          </Text>
          {!isTeaser ? (
            <Text className="mt-1 text-sm font-black text-electric-green" numberOfLines={1}>
              {formatAmericanOdds(selection.odds)}
            </Text>
          ) : null}
        </View>
        {isSelected ? <Ionicons color={accent} name="checkmark-circle" size={14} /> : null}
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
          <Text className="text-[10px] font-black uppercase text-white/45" style={{ letterSpacing: 1.5 }}>
            NFL · {formatGameTime(game.commenceTime)}
          </Text>
          <Text className="mt-1 text-base font-black uppercase text-white" numberOfLines={2}>
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
                  <EditOddsButton
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

export function PostSubmitEditModal({
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
    setMarketByGameId(Object.fromEntries(editableLegs.map((leg) => [leg.game_id, leg.market])));
    setErrorMessage(null);
  }, [bet, oddsGames]);

  if (!bet) {
    return null;
  }

  const mode = bet.bet_type;
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

  const gameList = mode === 'straight' ? (straightGame ? [straightGame] : []) : oddsGames;
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
              <Text className="text-[10px] font-black uppercase" style={{ color: accent, letterSpacing: 2.5 }}>
                Edit Submitted Pick
              </Text>
              <Text className="mt-2 text-2xl font-black uppercase text-white">
                {mode === 'straight' ? 'Swap Side' : `Edit ${mode}`}
              </Text>
            </View>
            <Pressable accessibilityLabel="Close edit flow" accessibilityRole="button" hitSlop={8} onPress={onCancel}>
              <View className="h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                <Ionicons color="rgba(255,255,255,0.72)" name="close" size={18} />
              </View>
            </Pressable>
          </View>

          <Card>
            <View className="gap-3">
              <View className="flex-row items-center justify-between gap-2">
                <Badge betType={mode} />
                <Text className="text-[11px] font-black uppercase text-white/55" style={{ letterSpacing: 1.5 }}>
                  {formatCurrency(bet.amount)} fixed
                </Text>
              </View>
              <Text className="text-sm font-semibold leading-5 text-white/55">
                {mode === 'straight'
                  ? 'Choose the other side from this same game and market. Coins stay fixed.'
                  : 'Choose an unlocked leg, then tap a replacement line. Coins stay fixed.'}
              </Text>
              <View className="flex-row items-center justify-between border-t border-white/[0.08] pt-3">
                <Text className="text-[10px] font-black uppercase text-white/45" style={{ letterSpacing: 1.5 }}>
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
              <Text className="text-[10px] font-black uppercase text-white/50" style={{ letterSpacing: 2 }}>
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
            <Text className="text-[10px] font-black uppercase text-white/50" style={{ letterSpacing: 2 }}>
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
