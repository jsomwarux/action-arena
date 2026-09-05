import { LOCK_OF_THE_WEEK_MULTIPLIER } from '@/constants/rules';
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

/**
 * What a pending pick pays if it lands.
 *
 * The Pick of the Week multiplies profit, not stake — AGENTS.md: "The Lock bet
 * receives a 1.5x multiplier on profit and loss", with "Win: profit = payout −
 * amount". So $20 at −110 pays 38.18, profit 18.18, Lock profit 27.27, Lock
 * payout 47.27.
 *
 * This lives beside `getRealizedReward` because the two are the same figure
 * either side of settlement, and because three screens each carried their own
 * answer: the Pick Board multiplied, while the matchup card and the bet detail
 * printed the raw `potential_payout` directly underneath a
 * "PICK OF THE WEEK 1.5x" badge — a UI asserting the multiplier and then
 * contradicting it by nine coins.
 */
export function getDisplayedPotentialReward(
  bet: Pick<SettledBetOutcome, 'amount'> & { is_lock: boolean; potential_payout: number },
) {
  if (!bet.is_lock) {
    return bet.potential_payout;
  }

  return bet.amount + (bet.potential_payout - bet.amount) * LOCK_OF_THE_WEEK_MULTIPLIER;
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
