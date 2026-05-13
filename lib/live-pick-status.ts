import { getNflTeamShortName } from '@/lib/nfl-teams';
import { getPickLegBaseLabel } from '@/lib/pick-labels';
import type { BetLegRow, BetType, LiveGameStateRow } from '@/types/database';

export type LivePickStatus = 'winning' | 'neutral' | 'losing';

type LiveLeg = Pick<
  BetLegRow,
  'adjusted_line' | 'game_id' | 'market' | 'original_line' | 'selection'
>;

type ScoreSide = 'away' | 'home';

const QUARTER_SECONDS = 15 * 60;
const REGULATION_SECONDS = 60 * 60;

export const livePickStatusCopy: Record<LivePickStatus, string> = {
  losing: 'Falling Short',
  neutral: 'Tight',
  winning: 'On Track',
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function selectionTeamName(leg: LiveLeg) {
  if (leg.market === 'over_under') {
    return null;
  }

  return getPickLegBaseLabel(leg);
}

function getSelectedSide(leg: LiveLeg, score: LiveGameStateRow): ScoreSide | null {
  const teamName = selectionTeamName(leg);

  if (!teamName) {
    return null;
  }

  const normalizedTeam = normalizeName(teamName);
  if (normalizedTeam === normalizeName(score.away_team)) {
    return 'away';
  }
  if (normalizedTeam === normalizeName(score.home_team)) {
    return 'home';
  }

  return null;
}

export function isLiveScoreActive(score: LiveGameStateRow | undefined): score is LiveGameStateRow {
  return Boolean(score && (score.status === 'in_progress' || score.status === 'halftime'));
}

export function isLiveScoreFinal(score: LiveGameStateRow | undefined) {
  return score?.status === 'final';
}

function compareMargin(edge: number): LivePickStatus {
  if (edge > 1) {
    return 'winning';
  }

  if (edge < -1) {
    return 'losing';
  }

  return 'neutral';
}

function parseTimeRemainingSeconds(timeRemaining: string | null) {
  if (!timeRemaining) {
    return null;
  }

  const [minutesText, secondsText] = timeRemaining.split(':');
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return Math.max(0, minutes * 60 + seconds);
}

function periodNumber(period: string | null) {
  if (!period) {
    return null;
  }

  const normalized = period.toLowerCase();
  if (normalized === 'q1' || normalized === '1' || normalized === '1st') return 1;
  if (normalized === 'q2' || normalized === '2' || normalized === '2nd') return 2;
  if (normalized === 'q3' || normalized === '3' || normalized === '3rd') return 3;
  if (normalized === 'q4' || normalized === '4' || normalized === '4th') return 4;
  return null;
}

function elapsedGameSeconds(score: LiveGameStateRow) {
  if (score.status === 'halftime' || score.current_period?.toLowerCase() === 'halftime') {
    return QUARTER_SECONDS * 2;
  }

  const period = periodNumber(score.current_period);
  if (!period) {
    return null;
  }

  const remaining = parseTimeRemainingSeconds(score.time_remaining);
  if (remaining === null) {
    return null;
  }

  return Math.min(
    REGULATION_SECONDS,
    (period - 1) * QUARTER_SECONDS + (QUARTER_SECONDS - Math.min(remaining, QUARTER_SECONDS)),
  );
}

function evaluateMoneyline(leg: LiveLeg, score: LiveGameStateRow): LivePickStatus {
  const selectedSide = getSelectedSide(leg, score);

  if (!selectedSide || score.away_score === score.home_score) {
    return 'neutral';
  }

  const selectedScore = selectedSide === 'away' ? score.away_score : score.home_score;
  const opponentScore = selectedSide === 'away' ? score.home_score : score.away_score;
  return selectedScore > opponentScore ? 'winning' : 'losing';
}

function evaluateSpread(leg: LiveLeg, score: LiveGameStateRow): LivePickStatus {
  const selectedSide = getSelectedSide(leg, score);
  const line = leg.adjusted_line ?? leg.original_line;

  if (!selectedSide || line === null) {
    return 'neutral';
  }

  const selectedScore = selectedSide === 'away' ? score.away_score : score.home_score;
  const opponentScore = selectedSide === 'away' ? score.home_score : score.away_score;
  return compareMargin(selectedScore - opponentScore + line);
}

function evaluateTotal(leg: LiveLeg, score: LiveGameStateRow): LivePickStatus {
  const line = leg.adjusted_line ?? leg.original_line;
  const elapsedSeconds = elapsedGameSeconds(score);

  if (line === null || elapsedSeconds === null || elapsedSeconds <= 0) {
    return 'neutral';
  }

  const currentTotal = score.away_score + score.home_score;
  const projectedTotal = (currentTotal / elapsedSeconds) * REGULATION_SECONDS;
  const neutralWindow = Math.max(1, line * 0.05);
  const edge = projectedTotal - line;
  const isOver = leg.selection.toLowerCase().startsWith('over');

  if (Math.abs(edge) <= neutralWindow) {
    return 'neutral';
  }

  if (isOver) {
    return edge > 0 ? 'winning' : 'losing';
  }

  return edge < 0 ? 'winning' : 'losing';
}

export function evaluateLiveLegStatus(
  leg: LiveLeg,
  score: LiveGameStateRow | undefined,
): LivePickStatus | null {
  if (!isLiveScoreActive(score)) {
    return null;
  }

  if (leg.market === 'moneyline') {
    return evaluateMoneyline(leg, score);
  }

  if (leg.market === 'spread') {
    return evaluateSpread(leg, score);
  }

  return evaluateTotal(leg, score);
}

export function evaluateLiveBetStatus(
  bet: { bet_legs: LiveLeg[]; bet_type: BetType; result: string },
  scoresByGameId: Record<string, LiveGameStateRow | undefined>,
): LivePickStatus | null {
  if (bet.result !== 'pending') {
    return null;
  }

  const legStatuses = bet.bet_legs.map((leg) => evaluateLiveLegStatus(leg, scoresByGameId[leg.game_id]));
  const activeStatuses = legStatuses.filter((status): status is LivePickStatus => Boolean(status));

  if (activeStatuses.length === 0) {
    return null;
  }

  if (activeStatuses.some((status) => status === 'losing')) {
    return 'losing';
  }

  if (activeStatuses.length === bet.bet_legs.length && activeStatuses.every((status) => status === 'winning')) {
    return 'winning';
  }

  return 'neutral';
}

function periodLabel(score: LiveGameStateRow) {
  if (score.status === 'halftime') {
    return 'Halftime';
  }

  const period = score.current_period?.toUpperCase();
  return [period, score.time_remaining].filter(Boolean).join(' ');
}

export function formatLiveScore(score: LiveGameStateRow, focusTeam?: string | null) {
  const focus = focusTeam ? normalizeName(focusTeam) : null;
  const awayFirst = !focus || focus !== normalizeName(score.home_team);
  const firstTeam = awayFirst ? score.away_team : score.home_team;
  const secondTeam = awayFirst ? score.home_team : score.away_team;
  const firstScore = awayFirst ? score.away_score : score.home_score;
  const secondScore = awayFirst ? score.home_score : score.away_score;
  const gameClock = periodLabel(score);

  return `${getNflTeamShortName(firstTeam)} ${firstScore} - ${getNflTeamShortName(
    secondTeam,
  )} ${secondScore}${gameClock ? ` · ${gameClock}` : ''}`;
}

export function getLiveLegFocusTeam(leg: LiveLeg) {
  return selectionTeamName(leg);
}
