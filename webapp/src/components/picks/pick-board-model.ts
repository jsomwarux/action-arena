/**
 * Every rule and every number the Pick Board depends on, with no React in it.
 *
 * This is a direct port of the pure logic in the mobile board
 * (app/(app)/(tabs)/bet-board.tsx) and components/picks/post-submit-edit-modal.tsx.
 * It is deliberately a mirror rather than a rewrite: `public.submit_bets` and
 * `public.update_submitted_bet` validate all of it again server-side, so any
 * client rule that drifts from mobile turns into a Postgres exception the player
 * never saw coming. When a rule changes, change it in both places.
 *
 * Shared helpers (odds conversion, conflict detection, leg labels, lock state)
 * come from src/lib — those files are already the ported platform-agnostic
 * layer and are not duplicated here.
 */

import {
  MAX_SINGLE_BET,
  MINIMUM_BETS_PER_WEEK,
  PARLAY_PAYOUT_CAP,
  TEASER_MAX_LEGS,
  TEASER_MIN_LEGS,
  TEASER_ODDS_LOOKUP,
  WEEKLY_BUDGET,
} from '@/constants/rules';
import {
  BET_TYPE_THEME,
  betTypeHex,
  betTypeTone,
  type BetTone,
} from '@/lib/bet-type-theme';
import type {
  BetEditSubmissionLeg,
  BetSubmissionLeg,
  MixedBetSubmission,
  PlacedBet,
} from '@/hooks/use-straight-bets';
import {
  getDisplayedPotentialReward,
  getRealizedReward,
  isSettledResult,
} from '@/lib/bet-outcome';
import {
  americanOddsToDecimal,
  calculatePotentialPayout,
  decimalOddsToAmerican,
  formatAmericanOdds,
  formatCurrency,
} from '@/lib/format';
import { getNflTeamShortName } from '@/lib/nfl-teams';
import type { OddsGame, OddsSelection } from '@/lib/odds-api';
import {
  areConflictingPicks,
  areDuplicatePickLegs,
  formatPickConflictReason,
  getPickConflictSide,
} from '@/lib/pick-conflicts';
import {
  formatBetLegLabel,
  formatOddsSelectionLabel,
  formatPickLineValue,
  getPickLegBaseLabel,
} from '@/lib/pick-labels';
import { isBetLegLocked, isParentPickLocked } from '@/lib/pick-locking';
import type { BetMarket, BetType, TeaserLegCount, TeaserPoints } from '@/types/database';

/** Parlay leg bounds. AGENTS.md "Bet Types"; enforced again in submit_bets. */
export const PARLAY_MIN_LEGS = 2;
export const PARLAY_MAX_LEGS = 6;

/** NFL regular season length, matching the mobile week navigator's ceiling. */

/** One-click amounts offered beside every coin field. */
export const QUICK_AMOUNTS = [5, 10, 20, MAX_SINGLE_BET] as const;

export type BetMode = BetType;

/**
 * A staged leg. `BetSubmissionLeg` is exactly what the RPC wants; the extra
 * fields are display state that never has to be re-derived from the slate.
 */
export type SlipLeg = BetSubmissionLeg & {
  awayTeam: string;
  homeTeam: string;
  id: string;
  label: string;
  selectionKey: string;
};

/**
 * A staged pick.
 *
 * `amountText` is the raw contents of the rail's coin field so a half-typed
 * value survives a re-render; `amount` is the parsed number every rule reads.
 * Extra keys ride along in the submit payload harmlessly — submit_bets reads
 * named keys out of the jsonb and ignores the rest, exactly as on mobile.
 */
export type SlipBet = Omit<MixedBetSubmission, 'legs'> & {
  amountText: string;
  id: string;
  label: string;
  legs: SlipLeg[];
  rawPotentialReward?: number;
};

export type EditingPlacedLeg = SlipLeg & {
  betLegId: string;
  locked: boolean;
};

export type ValidationState = {
  errors: string[];
  warnings: string[];
};

export type ConflictSource =
  | {
      kind: 'builder';
      mode: Extract<BetMode, 'parlay' | 'teaser'>;
    }
  | {
      bet: SlipBet;
      kind: 'slip';
    };

export type SelectionConflict = {
  actionLabel: string;
  existingLeg: SlipLeg;
  game: OddsGame;
  id: string;
  message: string;
  nextLeg: SlipLeg;
  promptTitle: string;
  selection: OddsSelection;
  source: ConflictSource;
  summary: string;
  targetMode: BetMode;
};

// ============================================================
// Labels and formatting
// ============================================================

export function marketLabel(market: BetMarket) {
  if (market === 'moneyline') return 'Winner';
  if (market === 'spread') return 'Spread';
  return 'Over/Under';
}

export function formatLine(value: number | null) {
  if (value === null) {
    return '-';
  }

  return value > 0 ? `+${value}` : `${value}`;
}

/**
 * Weekday/date and clock time as two strings, so a game card can stack them
 * instead of running one long timestamp across its header.
 */
export function getGameDateParts(isoDate: string) {
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

/** Long-form day header for the slate's day groups. */
export function getGameDayGroupLabel(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date(isoDate));
}

export function getGameDayGroupKey(isoDate: string) {
  const date = new Date(isoDate);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatUpcomingSlateDate(isoDate: string | null | undefined) {
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

/**
 * The "x → y" line a teaser leg moved through.
 *
 * Market-aware because a spread carries its sign and a total does not: a
 * teased Over reads "49.5 → 43.5", never "+49.5 → +43.5".
 */
export function formatTeaserMovement(
  leg: Pick<SlipLeg, 'adjusted_line' | 'market' | 'original_line'>,
) {
  return `${formatPickLineValue(leg.original_line, leg.market)} → ${formatPickLineValue(
    leg.adjusted_line,
    leg.market,
  )}`;
}

export function getSelectionLabel(selection: OddsSelection) {
  return formatOddsSelectionLabel(selection);
}

export function getOddsButtonLabel(selection: OddsSelection) {
  if (selection.market === 'spread' && selection.line !== null) {
    return `${selection.shortName} ${formatLine(selection.line)}`;
  }

  if (selection.market === 'over_under' && selection.line !== null) {
    return `${selection.selection} ${selection.line}`;
  }

  return selection.shortName;
}

export function getTeaserOddsButtonLabel(selection: OddsSelection, teaserPoints: TeaserPoints) {
  const adjustedLine = getAdjustedTeaserLine(selection, teaserPoints);

  if (selection.market === 'spread' && adjustedLine !== null) {
    return `${selection.shortName} ${formatLine(adjustedLine)}`;
  }

  if (selection.market === 'over_under' && adjustedLine !== null) {
    return `${selection.selection} ${adjustedLine}`;
  }

  return getOddsButtonLabel(selection);
}

export function getSelectionKey(gameId: string, selection: OddsSelection) {
  return `${gameId}:${selection.market}:${selection.selection}:${selection.line ?? 'na'}`;
}

export function getLegSelectionKey(
  leg: Pick<SlipLeg, 'game_id' | 'market' | 'original_line' | 'selection'>,
) {
  return `${leg.game_id}:${leg.market}:${leg.selection}:${leg.original_line ?? 'na'}`;
}

// ============================================================
// Bet-type colour language (AGENTS.md Design System)
// ============================================================
//
// The table itself lives in `lib/bet-type-theme` — one definition read by the
// pick board, matchup detail, profile stats and league chat alike. What stays
// here are the board's own names for it, so its call sites keep reading in the
// board's vocabulary ("mode") rather than the shared one.

export type { BetTone };

export function getModeTone(mode: BetMode): BetTone {
  return betTypeTone(mode);
}

export function modeAccentHex(mode: BetMode) {
  return betTypeHex(mode);
}

/** Tailwind text colour per bet type, for the places a class beats a hex. */
export const BET_TYPE_TEXT_CLASS: Record<BetType, string> = {
  parlay: BET_TYPE_THEME.parlay.textClass,
  straight: BET_TYPE_THEME.straight.textClass,
  teaser: BET_TYPE_THEME.teaser.textClass,
};

export const BET_TYPE_LABEL: Record<BetType, string> = {
  parlay: BET_TYPE_THEME.parlay.label,
  straight: BET_TYPE_THEME.straight.label,
  teaser: BET_TYPE_THEME.teaser.label,
};

export const BET_TYPE_GROUP_LABEL: Record<BetType, string> = {
  parlay: BET_TYPE_THEME.parlay.groupLabel,
  straight: BET_TYPE_THEME.straight.groupLabel,
  teaser: BET_TYPE_THEME.teaser.groupLabel,
};

// ============================================================
// Building staged picks
// ============================================================

export function makeSlipLeg(
  game: OddsGame,
  selection: OddsSelection,
  adjustedLine = selection.line,
): SlipLeg {
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

export function makeStraightBet(
  game: OddsGame,
  selection: OddsSelection,
  amount: number,
  amountText = amount > 0 ? String(amount) : '',
): SlipBet {
  const leg = makeSlipLeg(game, selection);

  return {
    amount,
    amountText,
    bet_type: 'straight',
    id: `straight:${leg.id}`,
    is_lock: false,
    label: leg.label,
    legs: [leg],
    odds: selection.odds,
    potential_payout: calculatePotentialPayout(amount, selection.odds),
    teaser_points: null,
  };
}

export function calculateParlayDecimalOdds(legs: Pick<SlipLeg, 'leg_odds'>[]) {
  return legs.reduce((product, leg) => product * americanOddsToDecimal(leg.leg_odds), 1);
}

export function getParlayOdds(legs: Pick<SlipLeg, 'leg_odds'>[]) {
  return decimalOddsToAmerican(calculateParlayDecimalOdds(legs));
}

export function calculateParlayReward(amount: number, legs: Pick<SlipLeg, 'leg_odds'>[]) {
  const rawReward = Number((amount * calculateParlayDecimalOdds(legs)).toFixed(2));
  return {
    cappedReward: Math.min(rawReward, PARLAY_PAYOUT_CAP),
    rawReward,
  };
}

export function getTeaserOdds(legCount: number, teaserPoints: TeaserPoints) {
  if (legCount < TEASER_MIN_LEGS || legCount > TEASER_MAX_LEGS) {
    return null;
  }

  return TEASER_ODDS_LOOKUP[legCount as TeaserLegCount][teaserPoints];
}

/**
 * Teaser points always move a line in the bettor's favour: spreads up, Overs
 * down, Unders up. AGENTS.md "Teasers".
 */
export function getAdjustedTeaserLine(selection: OddsSelection, teaserPoints: TeaserPoints) {
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

/** Re-teases a staged leg after the point size changes under it. */
export function reteaseSlipLeg(leg: SlipLeg, teaserPoints: TeaserPoints): SlipLeg {
  if (leg.market === 'moneyline') {
    return leg;
  }

  return {
    ...leg,
    adjusted_line: getAdjustedTeaserLine(
      {
        label: leg.label,
        line: leg.original_line,
        market: leg.market,
        odds: leg.leg_odds,
        selection: getPickLegBaseLabel(leg),
        shortName: leg.label,
      },
      teaserPoints,
    ),
  };
}

export function makeParlaySlipBet(legs: SlipLeg[], amount: number, amountText: string): SlipBet {
  const { cappedReward, rawReward } = calculateParlayReward(amount, legs);

  return {
    amount: Number(amount.toFixed(2)),
    amountText,
    bet_type: 'parlay',
    id: `parlay:${legs.map((leg) => leg.id).join('|')}`,
    is_lock: false,
    label: `${legs.length}-leg Parlay`,
    legs,
    odds: getParlayOdds(legs),
    potential_payout: cappedReward,
    rawPotentialReward: rawReward,
    teaser_points: null,
  };
}

export function makeTeaserSlipBet(
  legs: SlipLeg[],
  teaserPoints: TeaserPoints,
  odds: number,
  amount: number,
  amountText: string,
): SlipBet {
  return {
    amount: Number(amount.toFixed(2)),
    amountText,
    bet_type: 'teaser',
    id: `teaser:${teaserPoints}:${legs.map((leg) => leg.id).join('|')}`,
    is_lock: false,
    label: `${legs.length}-leg ${teaserPoints}pt Teaser`,
    legs,
    odds,
    potential_payout: calculatePotentialPayout(amount, odds),
    teaser_points: teaserPoints,
  };
}

export function getSlipBetPayoutForAmount(bet: SlipBet, amount: number) {
  if (bet.bet_type === 'parlay') {
    return calculateParlayReward(amount, bet.legs).cappedReward;
  }

  return calculatePotentialPayout(amount, bet.odds);
}

export function updateSlipBetAmount(bet: SlipBet, amount: number, amountText: string): SlipBet {
  const roundedAmount = Number(amount.toFixed(2));

  if (bet.bet_type === 'parlay') {
    const { cappedReward, rawReward } = calculateParlayReward(roundedAmount, bet.legs);
    return {
      ...bet,
      amount: roundedAmount,
      amountText,
      potential_payout: cappedReward,
      rawPotentialReward: rawReward,
    };
  }

  return {
    ...bet,
    amount: roundedAmount,
    amountText,
    potential_payout: calculatePotentialPayout(roundedAmount, bet.odds),
  };
}

/**
 * Drops one leg out of a staged pick, returning null when what is left is no
 * longer a legal bet (a straight loses its only leg, a parlay or teaser falls
 * under two legs).
 */
export function getUpdatedSlipBetAfterLegRemoval(
  bet: SlipBet,
  removedLegId: string,
): SlipBet | null {
  const legs = bet.legs.filter((leg) => leg.id !== removedLegId);

  if (bet.bet_type === 'straight' || legs.length === 0) {
    return null;
  }

  if (bet.bet_type === 'parlay') {
    if (legs.length < PARLAY_MIN_LEGS) {
      return null;
    }

    return {
      ...makeParlaySlipBet(legs, bet.amount, bet.amountText),
      is_lock: bet.is_lock,
    };
  }

  if (legs.length < TEASER_MIN_LEGS || !bet.teaser_points) {
    return null;
  }

  const odds = getTeaserOdds(legs.length, bet.teaser_points);
  if (!odds) {
    return null;
  }

  return {
    ...makeTeaserSlipBet(legs, bet.teaser_points, odds, bet.amount, bet.amountText),
    is_lock: bet.is_lock,
  };
}

// ============================================================
// Payout display
// ============================================================

/**
 * The Pick of the Week pays and costs 1.5x, so the rail shows the boosted
 * number. One definition, in `lib/bet-outcome`, shared with the matchup card
 * and the bet detail — those two used to print the raw payout under a 1.5x
 * badge.
 */
export function getDisplayedPotentialPayout(
  bet: Pick<SlipBet, 'amount' | 'is_lock' | 'potential_payout'>,
) {
  return getDisplayedPotentialReward(bet);
}

/**
 * Was this parlay's payout actually cut by the $500 cap?
 *
 * "Capped" means the true payout *exceeded* the cap — a parlay that pays
 * exactly $500 was never capped. The staged and placed predicates used to
 * disagree on that boundary (`>` while staging, `>=` after submitting), so the
 * "capped" label appeared on submit for a bet that had not been capped.
 *
 * The staged bet still knows its raw reward. A placed one does not — the stored
 * `potential_payout` is already the capped figure — so it is recomputed from
 * the stake and the combined odds, which is what produced the raw figure in the
 * first place.
 */
function exceedsParlayCap(rawPayout: number) {
  return rawPayout > PARLAY_PAYOUT_CAP;
}

export function isCappedParlay(
  bet: Pick<SlipBet, 'bet_type' | 'potential_payout' | 'rawPotentialReward'>,
) {
  return (
    bet.bet_type === 'parlay' && exceedsParlayCap(bet.rawPotentialReward ?? bet.potential_payout)
  );
}

export function getDisplayedPlacedPayout(
  bet: Pick<PlacedBet, 'amount' | 'is_lock' | 'potential_payout'>,
) {
  return getDisplayedPotentialReward(bet);
}

export function isCappedPlacedParlay(bet: Pick<PlacedBet, 'amount' | 'bet_type' | 'odds'>) {
  return bet.bet_type === 'parlay' && exceedsParlayCap(calculatePotentialPayout(bet.amount, bet.odds));
}

export function isSettledPick(
  result: PlacedBet['result'],
): result is Exclude<PlacedBet['result'], 'pending'> {
  return isSettledResult(result);
}

export function getSettledReward(bet: Pick<PlacedBet, 'amount' | 'profit' | 'result'>) {
  return getRealizedReward(bet);
}

// ============================================================
// Conflicts
// ============================================================

export function getSlipLegs(slipBets: SlipBet[]) {
  return slipBets.flatMap((bet) => bet.legs);
}

export function formatMatchupLabel(leg: SlipLeg) {
  return `${leg.awayTeam} @ ${leg.homeTeam}`;
}

export function formatLegConflictLabel(leg: SlipLeg) {
  return `${leg.label} ${formatAmericanOdds(leg.leg_odds)}`;
}

function formatConflictShortLabel(leg: SlipLeg) {
  if (leg.market === 'moneyline') {
    return `${getNflTeamShortName(getPickConflictSide(leg))} to win`;
  }

  return leg.label;
}

function formatSelectedPickReference(leg: SlipLeg) {
  if (leg.market === 'moneyline') {
    return `${getNflTeamShortName(getPickConflictSide(leg))} to win`;
  }

  return leg.label;
}

export function formatAddConflictMessage(nextLeg: SlipLeg, existingLeg: SlipLeg) {
  return `Cannot add ${formatLegConflictLabel(
    nextLeg,
  )}. It directly conflicts with ${formatLegConflictLabel(existingLeg)} on ${formatMatchupLabel(
    nextLeg,
  )} because ${formatPickConflictReason(nextLeg, existingLeg)}.`;
}

export function makeSelectionConflict({
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
  const existingLabel = formatSelectedPickReference(existingLeg);

  return {
    actionLabel: `Swap to ${nextLabel}`,
    existingLeg,
    game,
    id: `${targetMode}:${nextLeg.selectionKey}:${existingLeg.selectionKey}`,
    message: `This is the opposite of your pick, ${existingLabel}. Remove that pick or swap to this side.`,
    nextLeg,
    promptTitle: `Replace your ${existingLabel} pick with ${nextLabel}?`,
    selection,
    source,
    summary: 'Opposite of your pick',
    targetMode,
  };
}

function getBetTypeLabel(type: BetType) {
  if (type === 'straight') return 'straight pick';
  return type;
}

/** Every contradiction across the whole staged lineup, phrased for the rail. */
export function getConflictSummaries(slipBets: SlipBet[]) {
  const legsWithBet = slipBets.flatMap((bet) => bet.legs.map((leg) => ({ bet, leg })));
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

        const sources = `${getBetTypeLabel(left.bet.bet_type)} and ${getBetTypeLabel(
          right.bet.bet_type,
        )}`;
        contradictorySelections.push(
          `${formatLegConflictLabel(left.leg)} conflicts with ${formatLegConflictLabel(
            right.leg,
          )} between your ${sources} on ${formatMatchupLabel(
            left.leg,
          )} because ${formatPickConflictReason(left.leg, right.leg)}. Remove one.`,
        );
      });
    });
  });

  return { contradictorySelections };
}

export function findDuplicateLegInBet(bet: SlipBet) {
  if (bet.bet_type === 'straight') {
    return null;
  }

  for (let leftIndex = 0; leftIndex < bet.legs.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < bet.legs.length; rightIndex += 1) {
      const left = bet.legs[leftIndex];
      const right = bet.legs[rightIndex];

      if (left && right && areDuplicatePickLegs(left, right)) {
        return { left, right };
      }
    }
  }

  return null;
}

// ============================================================
// Validation
// ============================================================

/**
 * The exact-$100 rule is decimal, not binary.
 *
 * `public.submit_bets` compares `sum((value ->> 'amount')::numeric) <> 100` in
 * Postgres `numeric`, which is exact decimal. A JS float `reduce` over legal
 * amounts is not: `0.1 + 0.1 + 30.2 + 34.8 + 34.8` lands on
 * 99.999999999999986, so the client refused cards the database accepts and
 * then told the player to "allocate 0 coins more" — a state with no way out.
 *
 * Coins are a two-decimal quantity (`updateSlipBetAmount` stores
 * `Number(amount.toFixed(2))`), so summing in integer cents reproduces the
 * database's semantics exactly. Every budget comparison on the board goes
 * through these two helpers; none of them may compare the float sums.
 */
export const WEEKLY_BUDGET_CENTS = Math.round(WEEKLY_BUDGET * 100);

export function toCents(amount: number) {
  return Math.round(amount * 100);
}

export function getAllocatedCents(slipBets: Pick<SlipBet, 'amount'>[]) {
  return slipBets.reduce((sum, bet) => sum + toCents(bet.amount), 0);
}

export function isFullyAllocated(slipBets: Pick<SlipBet, 'amount'>[]) {
  return getAllocatedCents(slipBets) === WEEKLY_BUDGET_CENTS;
}

/**
 * `formatCurrency` rounds to whole coins, which is right for a headline figure
 * and wrong for a budget delta: a 40-cent shortfall must not render as
 * "0 coins". Sub-coin remainders keep their two decimals.
 */
function formatCoins(cents: number) {
  return cents % 100 === 0 ? formatCurrency(cents / 100) : `${(cents / 100).toFixed(2)} coins`;
}

export function getPickAmountError(amountText: string) {
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

/**
 * The submit gate, mirroring `public.submit_bets` clause for clause.
 *
 * The one rule stated here that the mobile board leaves to its amount modal is
 * the "every pick needs coins" line: coin amounts are typed inline in the rail,
 * so a pick can sit at zero, and submit_bets rejects `amount <= 0`. Stating it
 * up front is the same rule, surfaced before the round trip.
 */
export function getValidationState(slipBets: SlipBet[], now = Date.now()): ValidationState {
  const allocatedCents = getAllocatedCents(slipBets);
  const lockCount = slipBets.filter((bet) => bet.is_lock).length;
  const { contradictorySelections } = getConflictSummaries(slipBets);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (slipBets.length < MINIMUM_BETS_PER_WEEK) {
    const remaining = MINIMUM_BETS_PER_WEEK - slipBets.length;
    errors.push(
      `Add ${remaining} more pick${remaining === 1 ? '' : 's'} to hit the weekly minimum.`,
    );
  }

  if (lockCount === 0) {
    errors.push('Choose your Pick of the Week — every weekly card needs one 1.5x pick.');
  } else if (lockCount > 1) {
    errors.push('Only one pick can be your Pick of the Week. Click a gold star to swap.');
  }

  if (slipBets.some((bet) => bet.amount <= 0)) {
    errors.push('Every pick needs a coin amount above zero.');
  }

  if (slipBets.some((bet) => bet.amount > MAX_SINGLE_BET)) {
    errors.push(`No single pick can exceed ${formatCurrency(MAX_SINGLE_BET)}.`);
  }

  if (allocatedCents < WEEKLY_BUDGET_CENTS) {
    errors.push(
      `Allocate ${formatCoins(WEEKLY_BUDGET_CENTS - allocatedCents)} more of your weekly budget.`,
    );
  }

  if (allocatedCents > WEEKLY_BUDGET_CENTS) {
    errors.push(`You are ${formatCoins(allocatedCents - WEEKLY_BUDGET_CENTS)} over the weekly budget.`);
  }

  errors.push(...contradictorySelections);

  slipBets.forEach((bet) => {
    const duplicate = findDuplicateLegInBet(bet);
    if (duplicate) {
      errors.push(
        `${bet.label} includes ${formatLegConflictLabel(
          duplicate.left,
        )} twice. Remove the duplicate leg.`,
      );
    }

    if (bet.legs.some((leg) => new Date(leg.game_start_time).getTime() <= now)) {
      errors.push(`${bet.label} includes a game that has already started. Remove it.`);
    }

    if (bet.bet_type === 'parlay') {
      if (bet.legs.length < PARLAY_MIN_LEGS || bet.legs.length > PARLAY_MAX_LEGS) {
        errors.push('Parlays must have between 2 and 6 legs.');
      }
      if ((bet.rawPotentialReward ?? bet.potential_payout) > PARLAY_PAYOUT_CAP) {
        warnings.push('Payout capped at 500 coins to keep leagues competitive.');
      }
    }

    if (bet.bet_type === 'teaser') {
      if (bet.legs.length < TEASER_MIN_LEGS || bet.legs.length > TEASER_MAX_LEGS) {
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
// Submitted picks — lock state and post-submit editing
// ============================================================

export function isPlacedLegLocked(
  leg: Pick<PlacedBet['bet_legs'][number], 'game_start_time' | 'locked'>,
  now?: number,
) {
  return isBetLegLocked(leg, now);
}

export function isPlacedBetLocked(bet: PlacedBet, now?: number) {
  return isParentPickLocked(bet, now);
}

export function findOddsGame(oddsGames: OddsGame[], gameId: string) {
  return oddsGames.find((game) => game.id === gameId);
}

export function makeEditablePlacedLeg(
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

export function makeEditablePlacedLegs(bet: PlacedBet, oddsGames: OddsGame[]) {
  return bet.bet_legs.map((leg) =>
    makeEditablePlacedLeg(leg, findOddsGame(oddsGames, leg.game_id), bet.bet_type),
  );
}

export function makeEditedPlacedLeg(
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

export function editableLegToSubmissionLeg(leg: EditingPlacedLeg): BetEditSubmissionLeg {
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

/**
 * Odds and payout after a swap. The staked amount is deliberately fixed: a
 * player who could re-stake on a newer line would be trading on information
 * the rest of the league did not have when they built their card.
 */
export function getEditedPlacedBetMetrics(bet: PlacedBet, legs: EditingPlacedLeg[]) {
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

export function getEditIneligibleReason(bet: PlacedBet, legs: EditingPlacedLeg[]) {
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

export function getMissingReplacementLinesMessage(
  mode: BetMode,
  selectedLeg: EditingPlacedLeg | null,
) {
  if (!selectedLeg) {
    return 'Choose a pick leg before selecting replacement lines.';
  }

  if (mode === 'straight') {
    return `Current ${marketLabel(
      selectedLeg.market,
    ).toLowerCase()} lines for this pick are not published yet. Refresh to try again.`;
  }

  return 'Replacement lines for this slate are not published yet. Refresh to try again.';
}

export function getPlacedBetConflictLegs(
  placedBets: PlacedBet[],
  editingBetId: string,
  oddsGames: OddsGame[],
) {
  return placedBets
    .filter((bet) => bet.id !== editingBetId)
    .flatMap((bet) => makeEditablePlacedLegs(bet, oddsGames));
}
