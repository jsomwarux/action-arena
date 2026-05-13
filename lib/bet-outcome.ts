import type { BetResult } from '@/types/database';

export type SettledBetOutcome = {
  amount: number;
  profit: number | null;
  result: BetResult;
};

export function isSettledResult(result: BetResult) {
  return result !== 'pending';
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
