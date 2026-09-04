/**
 * The right pane: the Lineup rail.
 *
 * On the phone this is a bottom sheet the player drags up between picks. On the
 * desktop it never leaves the screen — budget, the active parlay/teaser builder,
 * every staged pick with its own coin field, the single Pick of the Week choice
 * and the submit gate all stay in view while the left pane is scrolled.
 *
 * Every number here comes from ./pick-board-model, which mirrors the rules
 * `public.submit_bets` enforces. Nothing in this file decides a rule.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Layers,
  Link2,
  Star,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

import { Button, Card, SegmentedToggle, TextInput, type SegmentedOption } from '@/components/ui';
import {
  LOCK_OF_THE_WEEK_MULTIPLIER,
  MAX_SINGLE_BET,
  MINIMUM_BETS_PER_WEEK,
  TEASER_MAX_LEGS,
  TEASER_MIN_LEGS,
  TEASER_ODDS_LOOKUP,
  WEEKLY_BUDGET,
} from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';
import {
  calculatePotentialPayout,
  formatAmericanOdds,
  formatCurrency,
  formatProfit,
} from '@/lib/format';
import type { TeaserLegCount, TeaserPoints } from '@/types/database';

import {
  AnimatedNumber,
  ARENA_SPRING,
  BetTypeBadge,
  MeterBar,
  Pill,
  TeamLogo,
  TotalDirectionChip,
} from './atoms';
import {
  calculateParlayReward,
  formatTeaserMovement,
  getDisplayedPotentialPayout,
  getParlayOdds,
  getPickAmountError,
  getTeaserOdds,
  isCappedParlay,
  marketLabel,
  modeAccentHex,
  PARLAY_MAX_LEGS,
  PARLAY_MIN_LEGS,
  QUICK_AMOUNTS,
  type BetMode,
  type SlipBet,
  type SlipLeg,
  type ValidationState,
} from './pick-board-model';

const TEASER_POINT_OPTIONS: SegmentedOption<TeaserPoints>[] = [
  { accent: 'cyan', label: '6 PT', value: 6 },
  { accent: 'cyan', label: '6.5 PT', value: 6.5 },
  { accent: 'cyan', label: '7 PT', value: 7 },
];

function isOverLeg(leg: SlipLeg) {
  return leg.selection.toLowerCase().startsWith('over');
}

// ============================================================
// Coin field
// ============================================================

/**
 * The coin amount field, plus one-click amounts.
 *
 * A number input rather than a stepper-free text field on purpose: this is a
 * keyboard-first surface, so arrow keys nudge the stake and Tab walks the
 * lineup. Uses the shared TextInput so the field keeps `arena-field-input` and
 * the global focus ring stays outside its border.
 */
function CoinField({
  amountText,
  disabled,
  id,
  label = 'Coins',
  onChange,
}: {
  amountText: string;
  disabled?: boolean;
  id: string;
  label?: string;
  onChange: (next: string) => void;
}) {
  const error = getPickAmountError(amountText);

  return (
    <div className="flex flex-col gap-2">
      <TextInput
        error={error}
        id={id}
        inputMode="decimal"
        label={label}
        max={MAX_SINGLE_BET}
        min={1}
        onChange={(event) => onChange(event.target.value)}
        placeholder="20"
        step={1}
        type="number"
        value={amountText}
      />
      <div className="flex gap-1.5">
        {QUICK_AMOUNTS.map((value) => {
          const isActive = Number(amountText) === value;

          return (
            <button
              className={cn(
                'min-w-0 flex-1 rounded-xl border px-1 py-1.5 text-xs font-black transition duration-150 ease-arena',
                'disabled:pointer-events-none disabled:opacity-40',
                isActive
                  ? 'border-electric-green bg-electric-green/15 text-electric-green'
                  : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-electric-green/50 hover:text-white',
              )}
              disabled={disabled}
              key={value}
              onClick={() => onChange(String(value))}
              type="button">
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Budget meter
// ============================================================

export function BudgetMeter({
  pickCount,
  totalAllocated,
}: {
  pickCount: number;
  totalAllocated: number;
}) {
  const remaining = WEEKLY_BUDGET - totalAllocated;
  const overBudget = remaining < 0;
  const fullyAllocated = totalAllocated === WEEKLY_BUDGET;
  const minimumMet = pickCount >= MINIMUM_BETS_PER_WEEK;
  const progress = Math.min(Math.max(totalAllocated / WEEKLY_BUDGET, 0), 1);

  const barColor = overBudget
    ? THEME_COLORS.coralRed
    : fullyAllocated
      ? THEME_COLORS.electricGreen
      : progress > 0.95
        ? THEME_COLORS.coralRed
        : progress > 0.65
          ? THEME_COLORS.amberAccent
          : THEME_COLORS.electricGreen;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
            Weekly Budget
          </p>
          <p className="mt-1 flex items-baseline gap-1">
            <AnimatedNumber
              className="text-3xl font-black tracking-[-0.02em] text-white"
              suffix=" coins"
              value={totalAllocated}
            />
            <span className="text-sm font-black text-white/40">
              / {formatCurrency(WEEKLY_BUDGET)}
            </span>
          </p>
        </div>
        <Pill
          icon={minimumMet ? CheckCircle2 : AlertCircle}
          tone={minimumMet ? 'green' : 'amber'}>
          {pickCount}/{MINIMUM_BETS_PER_WEEK} picks
        </Pill>
      </div>

      <MeterBar color={barColor} progress={progress} />

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
          {overBudget ? 'Over Budget' : fullyAllocated ? 'Fully Allocated' : 'Remaining'}
        </p>
        <AnimatedNumber
          className={cn(
            'text-base font-black',
            overBudget
              ? 'text-coral-red'
              : fullyAllocated
                ? 'text-electric-green'
                : remaining > 50
                  ? 'text-electric-green'
                  : remaining > 20
                    ? 'text-gold'
                    : 'text-amber-accent',
          )}
          prefix={remaining < 0 ? '-' : ''}
          suffix=" coins"
          value={Math.abs(remaining)}
        />
      </div>
    </div>
  );
}

// ============================================================
// Builder leg rows
// ============================================================

function BuilderLegRow({
  index,
  leg,
  onRemove,
  teaserPoints,
}: {
  index?: number;
  leg: SlipLeg;
  onRemove: (id: string) => void;
  teaserPoints?: TeaserPoints;
}) {
  const isTotal = leg.market === 'over_under';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {index === undefined ? null : (
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-black',
                'border-amber-accent/40 bg-amber-accent/15 text-amber-accent',
              )}>
              {index + 1}
            </span>
          )}
          {isTotal ? (
            <TotalDirectionChip isOver={isOverLeg(leg)} size={24} />
          ) : (
            <TeamLogo size={24} teamName={leg.label} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">{leg.label}</p>
            <p className="truncate text-[11px] font-semibold text-white/45">
              {leg.awayTeam} at {leg.homeTeam}
            </p>
          </div>
        </div>
        <button
          aria-label={`Remove ${leg.label}`}
          className="shrink-0 rounded-lg p-1 text-coral-red/80 transition hover:bg-coral-red/10 hover:text-coral-red"
          onClick={() => onRemove(leg.id)}
          type="button">
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>

      {teaserPoints ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-black text-cyan-accent">
          <span>{formatTeaserMovement(leg)}</span>
          <span className="text-[10px] font-semibold text-white/40">({teaserPoints}pt teaser)</span>
        </p>
      ) : (
        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.1em] text-white/50">
          {marketLabel(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Parlay builder
// ============================================================

export function ParlayBuilder({
  amountText,
  legs,
  onAdd,
  onAmountChange,
  onRemoveLeg,
}: {
  amountText: string;
  legs: SlipLeg[];
  onAdd: () => void;
  onAmountChange: (next: string) => void;
  onRemoveLeg: (id: string) => void;
}) {
  const amount = Number(amountText);
  const amountError = getPickAmountError(amountText);
  const odds = legs.length > 0 ? getParlayOdds(legs) : 0;
  const { cappedReward, rawReward } =
    legs.length > 0 && Number.isFinite(amount)
      ? calculateParlayReward(amount || 0, legs)
      : { cappedReward: 0, rawReward: 0 };
  const canAdd =
    legs.length >= PARLAY_MIN_LEGS &&
    legs.length <= PARLAY_MAX_LEGS &&
    !amountError &&
    Number.isFinite(amount) &&
    amount > 0;

  return (
    <Card
      className="flex flex-col gap-4 border-amber-accent/30 bg-amber-accent/[0.05]"
      tone="default">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-accent">
            <Link2 aria-hidden className="h-3.5 w-3.5" />
            Parlay Builder
          </p>
          <h3 className="arena-heading mt-1 text-2xl leading-none">Stack the Chain</h3>
        </div>
        <Pill tone="amber">
          {legs.length}/{PARLAY_MAX_LEGS} legs
        </Pill>
      </div>

      <div className="flex items-end justify-between gap-3 rounded-2xl border border-amber-accent/30 bg-amber-accent/10 p-3.5 shadow-[0_0_16px_rgba(255,165,2,0.18)]">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-accent">
            Combo Value
          </p>
          <p className="text-4xl font-black tracking-[-0.03em] text-amber-accent">
            {legs.length > 0 ? formatAmericanOdds(odds) : '—'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Reward</p>
          <AnimatedNumber
            className="text-2xl font-black tracking-[-0.02em] text-white"
            suffix=" coins"
            value={cappedReward}
          />
        </div>
      </div>

      {rawReward > cappedReward ? (
        <p className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-xs font-semibold text-white/65">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-accent" />
          Payout capped at 500 coins to keep leagues competitive.
        </p>
      ) : null}

      {legs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-3 py-5 text-center text-sm font-semibold text-white/55">
          Click prices on the slate to add non-conflicting legs. Two to six games, no repeats.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {legs.map((leg, index) => (
            <BuilderLegRow index={index} key={leg.id} leg={leg} onRemove={onRemoveLeg} />
          ))}
        </div>
      )}

      <CoinField
        amountText={amountText}
        id="parlay-amount"
        label="Parlay amount"
        onChange={onAmountChange}
      />

      <Button disabled={!canAdd} onClick={onAdd} title="Add Parlay to Lineup" variant="secondary" />
    </Card>
  );
}

// ============================================================
// Teaser builder
// ============================================================

export function TeaserBuilder({
  amountText,
  legs,
  onAdd,
  onAmountChange,
  onRemoveLeg,
  onTeaserPointsChange,
  teaserPoints,
}: {
  amountText: string;
  legs: SlipLeg[];
  onAdd: () => void;
  onAmountChange: (next: string) => void;
  onRemoveLeg: (id: string) => void;
  onTeaserPointsChange: (points: TeaserPoints) => void;
  teaserPoints: TeaserPoints;
}) {
  const amount = Number(amountText);
  const amountError = getPickAmountError(amountText);
  const odds = getTeaserOdds(legs.length, teaserPoints);
  const reward = odds && Number.isFinite(amount) ? calculatePotentialPayout(amount || 0, odds) : 0;
  const canAdd = Boolean(
    legs.length >= TEASER_MIN_LEGS &&
      legs.length <= TEASER_MAX_LEGS &&
      odds &&
      !amountError &&
      Number.isFinite(amount) &&
      amount > 0,
  );

  return (
    <Card className="flex flex-col gap-4 border-cyan-accent/30 bg-cyan-accent/[0.05]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-accent">
            <TrendingUp aria-hidden className="h-3.5 w-3.5" />
            Teaser Builder
          </p>
          <h3 className="arena-heading mt-1 text-2xl leading-none">Buy the Points</h3>
        </div>
        <Pill tone="cyan">
          {legs.length}/{TEASER_MAX_LEGS} legs
        </Pill>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
          Teaser Size
        </p>
        <SegmentedToggle
          accent="cyan"
          onChange={onTeaserPointsChange}
          options={TEASER_POINT_OPTIONS}
          value={teaserPoints}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10 p-3.5 shadow-[0_0_16px_rgba(24,220,255,0.18)]">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-accent">
              Boost Value
            </p>
            <p className="text-4xl font-black tracking-[-0.03em] text-cyan-accent">
              {odds ? formatAmericanOdds(odds) : '—'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
              Reward
            </p>
            <AnimatedNumber
              className="text-2xl font-black tracking-[-0.02em] text-white"
              suffix=" coins"
              value={reward}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([2, 3, 4] as TeaserLegCount[]).map((legCount) => {
            const isActive = legCount === legs.length;

            return (
              <div
                className={cn(
                  'rounded-xl border px-2 py-2 text-center',
                  isActive
                    ? 'border-cyan-accent/50 bg-cyan-accent/15'
                    : 'border-white/[0.08] bg-white/[0.04]',
                )}
                key={legCount}>
                <p
                  className={cn(
                    'text-[10px] font-black uppercase tracking-[0.1em]',
                    isActive ? 'text-cyan-accent' : 'text-white/45',
                  )}>
                  {legCount}-leg
                </p>
                <p className={cn('mt-1 text-sm font-black', isActive ? 'text-white' : 'text-white/65')}>
                  {formatAmericanOdds(TEASER_ODDS_LOOKUP[legCount][teaserPoints])}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {legs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-3 py-5 text-center text-sm font-semibold text-white/55">
          Click spreads or totals on the slate. Teasers move every line your way — no moneylines.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {legs.map((leg) => (
            <BuilderLegRow
              key={leg.id}
              leg={leg}
              onRemove={onRemoveLeg}
              teaserPoints={teaserPoints}
            />
          ))}
        </div>
      )}

      <CoinField
        amountText={amountText}
        id="teaser-amount"
        label="Teaser amount"
        onChange={onAmountChange}
      />

      <Button disabled={!canAdd} onClick={onAdd} title="Add Teaser to Lineup" variant="secondary" />
    </Card>
  );
}

// ============================================================
// Staged pick card
// ============================================================

function StagedPickCard({
  bet,
  hasAnyLock,
  onAmountChange,
  onRemove,
  onToggleLock,
}: {
  bet: SlipBet;
  hasAnyLock: boolean;
  onAmountChange: (betId: string, next: string) => void;
  onRemove: (betId: string) => void;
  onToggleLock: (betId: string) => void;
}) {
  const accentHex = modeAccentHex(bet.bet_type);
  const isLock = bet.is_lock;
  const displayedReward = getDisplayedPotentialPayout(bet);
  const capped = isCappedParlay(bet);
  const firstLeg = bet.legs[0];

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white/[0.04] p-3.5 transition-opacity duration-150',
        isLock && 'bg-gold/[0.10]',
        hasAnyLock && !isLock && 'opacity-70',
      )}
      style={{
        borderColor: isLock ? THEME_COLORS.gold : `${accentHex}66`,
        borderWidth: isLock ? 2 : 1,
        boxShadow: isLock ? `0 6px 18px ${THEME_COLORS.gold}44` : undefined,
      }}>
      {isLock ? (
        <p className="mb-2 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-gold">
          <Star aria-hidden className="h-3 w-3 fill-current" />
          Pick of the Week — {LOCK_OF_THE_WEEK_MULTIPLIER}x on profit and loss
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BetTypeBadge betType={bet.bet_type} />
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
              {formatAmericanOdds(bet.odds)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {bet.legs.length === 1 && firstLeg && firstLeg.market !== 'over_under' ? (
              <TeamLogo size={22} teamName={firstLeg.label} />
            ) : null}
            {bet.legs.length === 1 && firstLeg && firstLeg.market === 'over_under' ? (
              <TotalDirectionChip isOver={isOverLeg(firstLeg)} size={22} />
            ) : null}
            <p className="min-w-0 flex-1 text-[15px] font-black leading-tight text-white">
              {bet.label}
            </p>
          </div>
        </div>
        <button
          aria-label={`Remove ${bet.label}`}
          className="shrink-0 rounded-lg p-1 text-coral-red/80 transition hover:bg-coral-red/10 hover:text-coral-red"
          onClick={() => onRemove(bet.id)}
          type="button">
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>

      {bet.legs.length === 1 && firstLeg ? (
        <p className="mt-2 truncate text-[11px] font-semibold text-white/50">
          {firstLeg.awayTeam} at {firstLeg.homeTeam}
        </p>
      ) : (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {bet.legs.map((leg) => (
            <div className="rounded-xl bg-white/[0.04] p-2" key={leg.id}>
              <div className="flex items-center gap-2">
                {leg.market === 'over_under' ? (
                  <TotalDirectionChip isOver={isOverLeg(leg)} size={20} />
                ) : (
                  <TeamLogo size={20} teamName={leg.label} />
                )}
                <p className="min-w-0 flex-1 truncate text-xs font-black text-white">{leg.label}</p>
              </div>
              {bet.bet_type === 'teaser' ? (
                <p className="mt-1 truncate text-[10px] font-black text-cyan-accent">
                  {formatTeaserMovement(leg)}
                  <span className="font-semibold text-white/40">
                    {' '}
                    · {leg.awayTeam} at {leg.homeTeam}
                  </span>
                </p>
              ) : (
                <p className="mt-1 truncate text-[10px] font-semibold text-white/45">
                  {formatAmericanOdds(leg.leg_odds)} · {leg.awayTeam} at {leg.homeTeam}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-white/[0.08] pt-3">
        <CoinField
          amountText={bet.amountText}
          id={`amount-${bet.id}`}
          onChange={(next) => onAmountChange(bet.id, next)}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Reward</p>
        <p
          className="text-base font-black tracking-[-0.01em]"
          style={{ color: isLock ? THEME_COLORS.gold : accentHex }}>
          {formatCurrency(displayedReward)}
          {capped ? ' (capped)' : ''}
        </p>
      </div>

      <button
        aria-pressed={isLock}
        className={cn(
          'mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2.5',
          'text-[11px] font-black uppercase tracking-[0.14em] transition duration-150 ease-arena',
          isLock
            ? 'border-gold/55 bg-gold/15 text-gold shadow-[0_0_10px_rgba(255,215,0,0.35)]'
            : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-gold/45 hover:text-gold',
        )}
        onClick={() => onToggleLock(bet.id)}
        type="button">
        <Star aria-hidden className={cn('h-3.5 w-3.5', isLock && 'fill-current')} />
        {isLock ? 'Clear Pick of the Week' : `Make Pick of the Week (${LOCK_OF_THE_WEEK_MULTIPLIER}x)`}
      </button>
    </div>
  );
}

// ============================================================
// The rail
// ============================================================

export function LineupRail({
  isSubmitting,
  mode,
  onAmountChange,
  onClearAll,
  onRemove,
  onSubmit,
  onToggleLock,
  parlay,
  slipBets,
  teaser,
  validation,
}: {
  isSubmitting: boolean;
  mode: BetMode;
  onAmountChange: (betId: string, next: string) => void;
  onClearAll: () => void;
  onRemove: (betId: string) => void;
  onSubmit: () => void;
  onToggleLock: (betId: string) => void;
  parlay: {
    amountText: string;
    legs: SlipLeg[];
    onAdd: () => void;
    onAmountChange: (next: string) => void;
    onRemoveLeg: (id: string) => void;
  };
  slipBets: SlipBet[];
  teaser: {
    amountText: string;
    legs: SlipLeg[];
    onAdd: () => void;
    onAmountChange: (next: string) => void;
    onRemoveLeg: (id: string) => void;
    onTeaserPointsChange: (points: TeaserPoints) => void;
    teaserPoints: TeaserPoints;
  };
  validation: ValidationState;
}) {
  const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
  const totalReward = slipBets.reduce((sum, bet) => sum + getDisplayedPotentialPayout(bet), 0);
  const lockBet = slipBets.find((bet) => bet.is_lock);
  const hasAnyLock = Boolean(lockBet);
  const ready = validation.errors.length === 0 && slipBets.length > 0;

  return (
    <div className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-arena-surface/70 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <header className="shrink-0 border-b border-white/[0.08] p-4">
        <div className="mb-3.5 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-electric-green">
            <Wallet aria-hidden className="h-3.5 w-3.5" />
            Lineup
          </p>
          {slipBets.length > 0 ? (
            <button
              className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/45 transition hover:bg-coral-red/10 hover:text-coral-red"
              onClick={onClearAll}
              type="button">
              <Trash2 aria-hidden className="h-3 w-3" />
              Clear all
            </button>
          ) : null}
        </div>
        <BudgetMeter pickCount={slipBets.length} totalAllocated={totalAllocated} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {mode === 'parlay' ? (
            <ParlayBuilder
              amountText={parlay.amountText}
              legs={parlay.legs}
              onAdd={parlay.onAdd}
              onAmountChange={parlay.onAmountChange}
              onRemoveLeg={parlay.onRemoveLeg}
            />
          ) : null}

          {mode === 'teaser' ? (
            <TeaserBuilder
              amountText={teaser.amountText}
              legs={teaser.legs}
              onAdd={teaser.onAdd}
              onAmountChange={teaser.onAmountChange}
              onRemoveLeg={teaser.onRemoveLeg}
              onTeaserPointsChange={teaser.onTeaserPointsChange}
              teaserPoints={teaser.teaserPoints}
            />
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
              <Layers aria-hidden className="h-3.5 w-3.5" />
              Staged picks
            </p>
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
              {slipBets.length}
            </span>
          </div>

          {slipBets.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-3 py-6 text-center text-sm font-semibold text-white/55">
              {mode === 'straight'
                ? 'Click any price on the slate to stage a straight pick, then set its coins here.'
                : 'Build a pick on the left, then add it to your lineup.'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {slipBets.map((bet) => (
                  <motion.div
                    animate={{ y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    initial={{ y: 10 }}
                    key={bet.id}
                    transition={ARENA_SPRING}>
                    <StagedPickCard
                      bet={bet}
                      hasAnyLock={hasAnyLock}
                      onAmountChange={onAmountChange}
                      onRemove={onRemove}
                      onToggleLock={onToggleLock}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-white/[0.08] bg-arena-bg/40 p-4">
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-3 py-2',
              lockBet ? 'border-gold/45 bg-gold/[0.08]' : 'border-white/10 bg-white/[0.03]',
            )}>
            <p
              className={cn(
                'flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]',
                lockBet ? 'text-gold' : 'text-white/55',
              )}>
              <Star aria-hidden className={cn('h-3 w-3', lockBet && 'fill-current')} />
              Pick of the Week
            </p>
            <p
              className={cn(
                'min-w-0 truncate text-right text-sm font-black',
                lockBet ? 'text-white' : 'text-white/40',
              )}>
              {lockBet ? lockBet.label : 'Choose one pick'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
              Potential Reward
            </p>
            <p className="text-sm font-black text-electric-green">{formatCurrency(totalReward)}</p>
          </div>

          {validation.errors.length > 0 ? (
            <ul className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-2xl border border-amber-accent/30 bg-amber-accent/10 p-2.5">
              {validation.errors.map((message) => (
                <li className="flex gap-2 text-xs font-semibold text-amber-accent" key={message}>
                  <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {validation.warnings.length > 0 ? (
            <ul className="flex flex-col gap-2 rounded-2xl border border-gold/30 bg-gold/10 p-2.5">
              {validation.warnings.map((message) => (
                <li className="flex gap-2 text-xs font-semibold text-gold" key={message}>
                  <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {ready ? (
            <p className="flex items-center gap-2 rounded-2xl border border-electric-green/30 bg-electric-green/10 p-2.5 text-xs font-black uppercase tracking-[0.14em] text-electric-green">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5 shrink-0" />
              Lineup is ready to submit
            </p>
          ) : null}

          <Button
            disabled={!ready}
            loading={isSubmitting}
            onClick={onSubmit}
            title="Review & Submit"
          />
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
            {formatProfit(totalReward - totalAllocated)} if every pick lands
          </p>
        </div>
      </footer>
    </div>
  );
}
