import type { BetResult } from '@/types/database';

export type SettledBetOutcome = {
  amount: number;
  profit: number | null;
  result: BetResult;
};

export type BetSettlementState = 'unsettled' | 'partially_settled' | 'settled';

export function isSettledResult(result: BetResult): result is Exclude<BetResult, 'pending'> {
  return result !== 'pending';
}

export function getBetSettlementState<T extends { result: BetResult }>(
  bets: T[],
): BetSettlementState {
  if (bets.length === 0 || bets.every((bet) => !isSettledResult(bet.result))) {
    return 'unsettled';
  }

  if (bets.every((bet) => isSettledResult(bet.result))) {
    return 'settled';
  }

  return 'partially_settled';
}

export function getRealizedReward(outcome: SettledBetOutcome) {
  if (outcome.result === 'loss') {
    return 0;
  }

  if (outcome.result === 'push') {
    return outcome.amount;
  }

  return outcome.amount + (outcome.profit ?? 0);
}

export function getOutcomeRewardTone(result: BetResult) {
  if (result === 'win') {
    return 'text-electric-green';
  }

  if (result === 'loss') {
    return 'text-white/70';
  }

  if (result === 'push') {
    return 'text-white/70';
  }

  return 'text-electric-green';
}
