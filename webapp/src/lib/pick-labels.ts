import type { BetLegRow, BetMarket, BetType } from '@/types/database';

export type PickLabelLeg = Pick<
  BetLegRow,
  'adjusted_line' | 'market' | 'original_line' | 'selection'
>;

export type PickTitleBet = {
  bet_legs: PickLabelLeg[];
  bet_type: BetType;
};

export type PickChronologyBet = {
  bet_legs: Pick<BetLegRow, 'game_start_time'>[];
  created_at?: string;
};

export type OddsSelectionLabel = {
  line: number | null;
  market: BetMarket;
  selection: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripEmbeddedLine(selection: string, market: BetMarket) {
  const trimmed = normalizeWhitespace(selection);

  if (market === 'moneyline') {
    return trimmed;
  }

  if (market === 'over_under') {
    const side = trimmed.match(/^(over|under)\b/i)?.[1];
    return side ? side.charAt(0).toUpperCase() + side.slice(1).toLowerCase() : trimmed;
  }

  return trimmed
    .replace(/\s+[+-]\d+(?:\.\d+)?(?:\s+[+-]?\d+(?:\.\d+)?)*$/, '')
    .trim();
}

export function formatPickLineValue(value: number | null | undefined, market: BetMarket) {
  if (value === null || value === undefined) {
    return '';
  }

  if (market === 'spread' && value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

export function getPickLegBaseLabel(leg: PickLabelLeg) {
  return stripEmbeddedLine(leg.selection, leg.market);
}

export function formatBetLegLabel(
  leg: PickLabelLeg,
  options: { betType?: BetType; includeTeaserMovement?: boolean } = {},
) {
  const baseLabel = getPickLegBaseLabel(leg);

  if (leg.market === 'moneyline') {
    return baseLabel || 'Selection unavailable';
  }

  if (
    options.betType === 'teaser' &&
    options.includeTeaserMovement !== false &&
    leg.original_line !== null &&
    leg.adjusted_line !== null
  ) {
    return normalizeWhitespace(
      `${baseLabel} ${formatPickLineValue(leg.original_line, leg.market)} → ${formatPickLineValue(
        leg.adjusted_line,
        leg.market,
      )}`,
    );
  }

  const line = leg.adjusted_line ?? leg.original_line;
  const lineLabel = formatPickLineValue(line, leg.market);
  return normalizeWhitespace(lineLabel ? `${baseLabel} ${lineLabel}` : baseLabel);
}

export function formatOddsSelectionLabel(selection: OddsSelectionLabel) {
  return formatBetLegLabel({
    adjusted_line: selection.line,
    market: selection.market,
    original_line: selection.line,
    selection: selection.selection,
  });
}

export function formatPickTitle(bet: PickTitleBet) {
  const firstLeg = bet.bet_legs[0];

  if (!firstLeg) {
    return 'Selection unavailable';
  }

  if (bet.bet_type !== 'straight') {
    return `${bet.bet_legs.length}-leg ${bet.bet_type}`;
  }

  return formatBetLegLabel(firstLeg, { betType: bet.bet_type });
}

export function getPickLogoLabel(leg: PickLabelLeg) {
  return getPickLegBaseLabel(leg);
}

export function getPickStartTimestamp(bet: PickChronologyBet) {
  const legTimes = bet.bet_legs
    .map((leg) => Date.parse(leg.game_start_time))
    .filter((time) => Number.isFinite(time));

  if (legTimes.length > 0) {
    return Math.min(...legTimes);
  }

  const fallback = bet.created_at ? Date.parse(bet.created_at) : 0;
  return Number.isFinite(fallback) ? fallback : 0;
}

export function comparePicksByStartTimeDesc(left: PickChronologyBet, right: PickChronologyBet) {
  const startDiff = getPickStartTimestamp(right) - getPickStartTimestamp(left);

  if (startDiff !== 0) {
    return startDiff;
  }

  return (right.created_at ?? '').localeCompare(left.created_at ?? '');
}
