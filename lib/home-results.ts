import { getSettledBets, sumSettledProfit } from '@/lib/settled-bets';
import type { BetWithLegs } from '@/types/database';

export type RecentResultSummary = {
  biggestLoss: BetWithLegs | null;
  biggestWin: BetWithLegs | null;
  hasSettledPicks: boolean;
  profit: number | null;
  settledBets: BetWithLegs[];
};

function bestSettledBet(bets: BetWithLegs[], direction: 'best' | 'worst') {
  const settled = getSettledBets(bets);

  if (settled.length === 0) {
    return null;
  }

  return [...settled].sort((left, right) =>
    direction === 'best' ? right.profit - left.profit : left.profit - right.profit,
  )[0];
}

export function summarizeRecentResults(bets: BetWithLegs[]): RecentResultSummary {
  const settledBets = getSettledBets(bets);

  return {
    biggestLoss: bestSettledBet(settledBets, 'worst'),
    biggestWin: bestSettledBet(settledBets, 'best'),
    hasSettledPicks: settledBets.length > 0,
    profit: settledBets.length > 0 ? sumSettledProfit(settledBets) : null,
    settledBets,
  };
}
