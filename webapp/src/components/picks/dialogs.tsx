/**
 * The board's two dialogs: the final submit review, and the small yes/no
 * confirm the phone shows as an Alert (swap an opposing pick, clear the card).
 *
 * Both use the shared ui Modal — a centred dialog with a scrim, Escape to
 * close and scroll locking. Nothing here is a bottom sheet.
 */

import { Lock, Star } from 'lucide-react';

import { Badge, Button, Modal } from '@/components/ui';
import { LOCK_OF_THE_WEEK_MULTIPLIER } from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';
import { formatAmericanOdds, formatCurrency } from '@/lib/format';
import type { BetType } from '@/types/database';

import { Pill } from './atoms';
import {
  BET_TYPE_GROUP_LABEL,
  BET_TYPE_TEXT_CLASS,
  formatTeaserMovement,
  getAllocatedCents,
  getDisplayedPotentialPayout,
  isCappedParlay,
  modeAccentHex,
  type SlipBet,
} from './pick-board-model';

const BET_TYPE_ORDER: BetType[] = ['straight', 'parlay', 'teaser'];

function ConfirmRow({ bet }: { bet: SlipBet }) {
  const accentHex = modeAccentHex(bet.bet_type);
  const displayedReward = getDisplayedPotentialPayout(bet);
  const capped = isCappedParlay(bet);

  return (
    <div
      className="rounded-2xl border bg-white/[0.04] p-3"
      style={{ borderColor: `${accentHex}55` }}>
      {bet.is_lock ? (
        <div className="mb-2">
          <Pill icon={Star} tone="gold">
            Pick of the Week {LOCK_OF_THE_WEEK_MULTIPLIER}x
          </Pill>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge betType={bet.bet_type} />
          <span className="truncate arena-label text-white/45">
            {formatAmericanOdds(bet.odds)}
          </span>
        </div>
        <p
          className="shrink-0 text-sm font-black tracking-[-0.01em]"
          style={{ color: bet.is_lock ? THEME_COLORS.gold : accentHex }}>
          {formatCurrency(bet.amount)} → {formatCurrency(displayedReward)}
          {capped ? ' (capped)' : ''}
        </p>
      </div>

      <ul className="mt-2 flex flex-col gap-1">
        {bet.legs.map((leg) => (
          <li className="truncate text-[11px] font-semibold text-white/65" key={leg.id}>
            {bet.bet_type === 'teaser'
              ? `${leg.label}: ${formatTeaserMovement(leg)}`
              : `${leg.label} (${formatAmericanOdds(leg.leg_odds)})`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConfirmSubmitDialog({
  isSubmitting,
  onCancel,
  onConfirm,
  open,
  slipBets,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  slipBets: SlipBet[];
}) {
  // Cents, so the review dialog's "Allocated" line is the same figure the
  // submit gate compared — see WEEKLY_BUDGET_CENTS in pick-board-model.
  const totalAllocated = getAllocatedCents(slipBets) / 100;
  const totalReward = slipBets.reduce((sum, bet) => sum + getDisplayedPotentialPayout(bet), 0);

  return (
    <Modal
      className="max-w-2xl"
      footer={
        <>
          <Button
            disabled={isSubmitting}
            fullWidth={false}
            onClick={onCancel}
            title="Back"
            variant="secondary"
          />
          <Button
            fullWidth={false}
            loading={isSubmitting}
            onClick={onConfirm}
            title="Submit Card"
          />
        </>
      }
      onClose={isSubmitting ? () => undefined : onCancel}
      open={open}
      subtitle="Coin amounts and lines are frozen at submit. Picks stay editable until their own game kicks off."
      title="Submit Your Card">
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 arena-eyebrow text-electric-green">
          <Lock aria-hidden className="h-3.5 w-3.5" />
          Final review
        </p>

        <div className="flex max-h-[45vh] flex-col gap-4 overflow-y-auto pr-1">
          {BET_TYPE_ORDER.map((type) => {
            const items = slipBets.filter((bet) => bet.bet_type === type);
            if (items.length === 0) {
              return null;
            }

            return (
              <div className="flex flex-col gap-2" key={type}>
                <p
                  className={cn(
                    'text-[10px] font-black uppercase tracking-[0.18em]',
                    BET_TYPE_TEXT_CLASS[type],
                  )}>
                  {BET_TYPE_GROUP_LABEL[type]} · {items.length}
                </p>
                {items.map((bet) => (
                  <ConfirmRow bet={bet} key={bet.id} />
                ))}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
              Allocated
            </p>
            <p className="text-sm font-black text-white">{formatCurrency(totalAllocated)}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
              Potential Reward
            </p>
            <p className="text-base font-black text-electric-green">
              {formatCurrency(totalReward)}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  body,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <Modal
      className="max-w-md"
      footer={
        <>
          <Button fullWidth={false} onClick={onCancel} title="Cancel" variant="secondary" />
          <Button
            fullWidth={false}
            onClick={onConfirm}
            title={confirmLabel}
            variant={destructive ? 'destructive' : 'primary'}
          />
        </>
      }
      onClose={onCancel}
      open={open}
      title={title}>
      <p className="text-sm font-semibold leading-6 text-white/70">
        {body ?? 'This cannot be undone from here.'}
      </p>
    </Modal>
  );
}
