import { Lock } from 'lucide-react';

import { Card, Modal } from '@/components/ui';
import {
  getDisplayedPotentialReward,
  getOutcomeRewardTone,
  getRealizedReward,
  isSettledResult,
} from '@/lib/bet-outcome';
import { cn } from '@/lib/cn';
import { formatAmericanOdds, formatCurrency, formatGameTime, formatProfit, getProfitTone } from '@/lib/format';
import { evaluateLiveBetStatus } from '@/lib/live-pick-status';
import type { BetWithLegs } from '@/hooks/use-matchups';
import { formatBetLegLabel, formatPickTitle, getPickLogoLabel } from '@/lib/pick-labels';
import { isBetLegLocked } from '@/lib/pick-locking';
import type { LiveGameStateRow } from '@/types/database';

import {
  LegResultPill,
  LockPill,
  ResultPill,
  betTypeAccent,
  isInProgress,
  marketCopy,
  resultLabel,
} from './bet-card';
import { LiveBetStatusSummary, LiveLegScoreLine } from '@/components/picks/live-pick-status';
import { Badge, NflTeamLogo } from '@/components/ui';

/**
 * Read-only view of one pick. Mirrors mobile's ReadOnlyPickDetailModal — this
 * screen never edits a pick, on either side of the matchup. Editing a submitted
 * pick lives on the Pick Board.
 */
export function ReadOnlyPickDetailModal({
  bet,
  liveScoresByGameId,
  onClose,
  ownerLabel,
}: {
  bet: BetWithLegs | null;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  onClose: () => void;
  ownerLabel: string;
}) {
  if (!bet) {
    return null;
  }

  const accent = betTypeAccent(bet.bet_type);
  const isMultiLeg = bet.bet_type !== 'straight';
  const inProgress = isInProgress(bet);
  const outcomeLabel = inProgress ? 'Live' : resultLabel[bet.result];
  const liveStatus = evaluateLiveBetStatus(bet, liveScoresByGameId);
  const isSettled = isSettledResult(bet.result);
  // The Lock multiplies profit, so a pending Pick of the Week pays 1.5x. The
  // badge above says so; the number has to agree. Shared rule, one definition.
  const displayedReward = isSettled
    ? getRealizedReward(bet)
    : getDisplayedPotentialReward(bet);
  const rewardLabel = isSettled ? 'Outcome' : 'Reward';
  const rewardTone = isSettled ? getOutcomeRewardTone(bet.result) : '';

  return (
    <Modal
      className="max-w-2xl"
      onClose={onClose}
      open
      subtitle="Read-only view"
      title={ownerLabel}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge betType={bet.bet_type} />
                  {bet.is_lock ? <LockPill /> : null}
                </div>
                <p className="text-xl font-black text-white">{formatPickTitle(bet)}</p>
                <LiveBetStatusSummary status={liveStatus} />
              </div>
              <ResultPill bet={bet} />
            </div>

            <div className="flex justify-between rounded-xl bg-white/[0.04] px-3 py-3">
              <div>
                <p className="arena-label text-white/40">
                  Played
                </p>
                <p className="mt-1 text-sm font-black text-white">{formatCurrency(bet.amount)}</p>
              </div>
              <div className="text-center">
                <p className="arena-label text-white/40">
                  {rewardLabel}
                </p>
                <p
                  className={cn('mt-1 text-sm font-black text-white', rewardTone)}
                  style={isSettled ? undefined : { color: accent.hex }}>
                  {formatCurrency(displayedReward)}
                </p>
              </div>
              <div className="text-right">
                <p className="arena-label text-white/40">
                  Profit
                </p>
                <p className={cn('mt-1 text-sm font-black', getProfitTone(bet.profit ?? 0))}>
                  {bet.profit === null ? outcomeLabel : formatProfit(bet.profit)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <p className="arena-eyebrow text-white/50">
            {isMultiLeg ? 'Legs' : 'Selection'}
          </p>
          {bet.bet_legs.map((leg, index) => {
            const legLocked = isBetLegLocked(leg);

            return (
              <div
                className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"
                key={leg.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {leg.market !== 'over_under' ? (
                      <NflTeamLogo size={28} teamName={getPickLogoLabel(leg)} />
                    ) : (
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-black"
                        style={{
                          backgroundColor: `${accent.hex}1a`,
                          borderColor: `${accent.hex}66`,
                          color: accent.hex,
                        }}>
                        {index + 1}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-black text-white">
                        {formatBetLegLabel(leg, { betType: bet.bet_type })}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase text-white/40">
                        {marketCopy(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-white/40">
                        {formatGameTime(leg.game_start_time)}
                      </p>
                      <LiveLegScoreLine leg={leg} score={liveScoresByGameId[leg.game_id]} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <LegResultPill result={leg.result} />
                    {legLocked ? (
                      <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2 py-[2px]">
                        <Lock aria-hidden className="h-2.5 w-2.5 text-white/55" />
                        <span className="text-[9px] font-black uppercase tracking-[1px] text-white/55">
                          Locked
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
