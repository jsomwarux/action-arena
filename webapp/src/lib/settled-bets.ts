import type { BetRow } from '@/types/database';

export function isSettledBet<T extends Pick<BetRow, 'profit' | 'result'>>(
  bet: T,
): bet is T & { profit: number } {
  return bet.result !== 'pending' && bet.profit !== null;
}

export function getSettledBets<T extends Pick<BetRow, 'profit' | 'result'>>(bets: T[]) {
  return bets.filter(isSettledBet);
}

export function sumSettledProfit<T extends Pick<BetRow, 'profit' | 'result'>>(bets: T[]) {
  return getSettledBets(bets).reduce((sum, bet) => sum + bet.profit, 0);
}
