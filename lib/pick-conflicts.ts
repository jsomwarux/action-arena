import { formatPickLineValue, getPickLegBaseLabel } from '@/lib/pick-labels';

export type PickConflictMarket = 'moneyline' | 'spread' | 'over_under';

export type PickConflictLeg = {
  adjusted_line: number | null;
  game_id: string;
  market: PickConflictMarket;
  original_line: number | null;
  selection: string;
};

export type PickConflictKind = 'direct_contradiction' | 'same_team_moneyline_spread';

export type PickConflict<TLeg extends PickConflictLeg> = {
  existingLeg: TLeg;
  kind: PickConflictKind;
  nextLeg: TLeg;
};

export type PickContradiction<TLeg extends PickConflictLeg> = PickConflict<TLeg>;

const LINE_EPSILON = 0.001;

export function getPickConflictSide(leg: PickConflictLeg) {
  if (leg.market === 'spread') {
    return getPickLegBaseLabel(leg);
  }

  if (leg.market === 'over_under') {
    return getPickLegBaseLabel(leg);
  }

  return leg.selection;
}

export function getPickEffectiveLine(leg: PickConflictLeg) {
  return leg.adjusted_line ?? leg.original_line;
}

function areLinesEqual(leftLine: number | null, rightLine: number | null) {
  if (leftLine === null || rightLine === null) {
    return true;
  }

  return Math.abs(leftLine - rightLine) < LINE_EPSILON;
}

function areSpreadLinesOpposed(left: PickConflictLeg, right: PickConflictLeg) {
  const leftLine = getPickEffectiveLine(left);
  const rightLine = getPickEffectiveLine(right);

  if (leftLine === null || rightLine === null) {
    return true;
  }

  return Math.abs(Math.abs(leftLine) - Math.abs(rightLine)) < LINE_EPSILON;
}

function areMoneylineSpreadPair(left: PickConflictLeg, right: PickConflictLeg) {
  return (
    (left.market === 'moneyline' && right.market === 'spread') ||
    (left.market === 'spread' && right.market === 'moneyline')
  );
}

export function areDirectlyContradictingPicks(left: PickConflictLeg, right: PickConflictLeg) {
  if (left.game_id !== right.game_id || left.market !== right.market) {
    return false;
  }

  if (getPickConflictSide(left) === getPickConflictSide(right)) {
    return false;
  }

  if (left.market === 'moneyline') {
    return true;
  }

  if (left.market === 'spread') {
    return areSpreadLinesOpposed(left, right);
  }

  return areLinesEqual(getPickEffectiveLine(left), getPickEffectiveLine(right));
}

export function areSameTeamMoneylineSpreadPicks(left: PickConflictLeg, right: PickConflictLeg) {
  if (left.game_id !== right.game_id || !areMoneylineSpreadPair(left, right)) {
    return false;
  }

  const leftSide = getPickConflictSide(left);
  return leftSide.length > 0 && leftSide === getPickConflictSide(right);
}

export function getPickConflictKind(
  left: PickConflictLeg,
  right: PickConflictLeg,
): PickConflictKind | null {
  if (areDirectlyContradictingPicks(left, right)) {
    return 'direct_contradiction';
  }

  if (areSameTeamMoneylineSpreadPicks(left, right)) {
    return 'same_team_moneyline_spread';
  }

  return null;
}

export function areConflictingPicks(left: PickConflictLeg, right: PickConflictLeg) {
  return getPickConflictKind(left, right) !== null;
}

export function findConflictingPick<TLeg extends PickConflictLeg>(
  legs: TLeg[],
  nextLeg: TLeg,
) {
  return legs.find((leg) => areConflictingPicks(leg, nextLeg));
}

export function findContradictingPick<TLeg extends PickConflictLeg>(
  legs: TLeg[],
  nextLeg: TLeg,
) {
  return findConflictingPick(legs, nextLeg);
}

export function findPickConflict<TLeg extends PickConflictLeg>(
  existingLegs: TLeg[],
  nextLegs: TLeg[],
): PickConflict<TLeg> | null {
  const checkedLegs = [...existingLegs];

  for (const nextLeg of nextLegs) {
    const existingLeg = findConflictingPick(checkedLegs, nextLeg);
    const kind = existingLeg ? getPickConflictKind(existingLeg, nextLeg) : null;
    if (existingLeg && kind) {
      return { existingLeg, kind, nextLeg };
    }
    checkedLegs.push(nextLeg);
  }

  return null;
}

export function findPickContradiction<TLeg extends PickConflictLeg>(
  existingLegs: TLeg[],
  nextLegs: TLeg[],
): PickContradiction<TLeg> | null {
  return findPickConflict(existingLegs, nextLegs);
}

export function formatPickConflictReason(left: PickConflictLeg, right: PickConflictLeg) {
  if (getPickConflictKind(left, right) === 'same_team_moneyline_spread') {
    return "same-team moneyline and spread can't be combined";
  }

  if (left.market === 'moneyline') {
    return 'both teams cannot win the same game';
  }

  const line = getPickEffectiveLine(left) ?? getPickEffectiveLine(right);

  if (left.market === 'spread') {
    return line === null
      ? 'they are opposite sides of the same spread'
      : `they are opposite sides of the same ${formatPickLineValue(line, left.market)} spread`;
  }

  return line === null
    ? 'they are opposite sides of the same total'
    : `they are opposite sides of the same ${formatPickLineValue(line, left.market)} total`;
}
