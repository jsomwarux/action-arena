import type { LeagueSport, LeagueType } from '@/types/database';

export function formatLeagueType(type: LeagueType) {
  return type === 'h2h' ? 'Head-to-Head' : 'Cumulative';
}

export function formatSport(sport: LeagueSport) {
  return sport.toUpperCase();
}

export function formatRecord(wins: number, losses: number, ties: number) {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function formatWholeCoins(value: number) {
  return Math.round(Math.abs(value)).toLocaleString();
}

export function formatProfit(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatWholeCoins(value)} coins`;
}

export function formatCurrency(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}${formatWholeCoins(value)} coins`;
}

/**
 * Past this, an odds figure stops being information and starts being noise.
 *
 * `makeParlaySlipBet` stores true combined odds alongside a payout the $500 cap
 * has already cut, so a six-leg +900 parlay carried `odds: 99999900` next to
 * `potential_payout: 500` and the board printed both. Clamping the *display*
 * leaves the stored value alone — nothing downstream reads this string — and
 * real NFL parlays never come near the ceiling.
 */
const ODDS_DISPLAY_CEILING = 99999;

export function formatAmericanOdds(odds: number) {
  if (odds > ODDS_DISPLAY_CEILING) {
    return `+${ODDS_DISPLAY_CEILING}+`;
  }

  if (odds < -ODDS_DISPLAY_CEILING) {
    return `-${ODDS_DISPLAY_CEILING}+`;
  }

  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function americanOddsToDecimal(odds: number) {
  return odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
}

export function decimalOddsToAmerican(decimalOdds: number) {
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100);
  }

  return Math.round(-100 / (decimalOdds - 1));
}

export function calculatePotentialPayout(amount: number, odds: number) {
  return Number((amount * americanOddsToDecimal(odds)).toFixed(2));
}

export function formatGameTime(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

export function getProfitTone(value: number) {
  if (value > 0) {
    return 'text-electric-green';
  }

  if (value < 0) {
    return 'text-coral-red';
  }

  return 'text-white/70';
}
