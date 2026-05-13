import { formatPickLineValue, getPickLegBaseLabel } from '@/lib/pick-labels';

export type PickConflictMarket = 'moneyline' | 'spread' | 'over_under';

export type PickConflictLeg = {
  adjusted_line: number | null;
  game_id: string;
  market: PickConflictMarket;
  original_line: number | null;
  selection: string;
};

export type PickContradiction<TLeg extends PickConflictLeg> = {
  existingLeg: TLeg;
  nextLeg: TLeg;
};

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

export function findContradictingPick<TLeg extends PickConflictLeg>(
  legs: TLeg[],
  nextLeg: TLeg,
) {
  return legs.find((leg) => areDirectlyContradictingPicks(leg, nextLeg));
}

export function findPickContradiction<TLeg extends PickConflictLeg>(
  existingLegs: TLeg[],
  nextLegs: TLeg[],
): PickContradiction<TLeg> | null {
  const checkedLegs = [...existingLegs];

  for (const nextLeg of nextLegs) {
    const existingLeg = findContradictingPick(checkedLegs, nextLeg);
    if (existingLeg) {
      return { existingLeg, nextLeg };
    }
    checkedLegs.push(nextLeg);
  }

  return null;
}

export function formatPickConflictReason(left: PickConflictLeg, right: PickConflictLeg) {
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
