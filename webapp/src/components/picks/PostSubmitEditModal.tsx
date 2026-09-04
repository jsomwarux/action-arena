/**
 * Editing a pick that is already in.
 *
 * Port of components/picks/post-submit-edit-modal.tsx, rule for rule:
 *   - the staked coins never move (a player re-staking on a fresher line would
 *     be trading on information nobody else had when they built their card)
 *   - a straight swaps sides inside its own game and market, nothing else
 *   - a parlay or teaser swaps one unlocked leg at a time, and a teaser keeps
 *     the point size it was submitted with
 *   - the replacement is refused if it contradicts another leg of this pick or
 *     any leg of another pick on the same weekly card
 * `public.update_submitted_bet` re-checks all of it.
 */

import { useEffect, useState } from 'react';

import { AlertCircle, Loader2, Lock, X } from 'lucide-react';

import { Button, Card, Modal, SegmentedToggle, type SegmentedOption } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import type { BetEditSubmission, PlacedBet } from '@/hooks/use-straight-bets';
import { cn } from '@/lib/cn';
import { formatAmericanOdds, formatCurrency, formatGameTime } from '@/lib/format';
import type { OddsGame, OddsSelection } from '@/lib/odds-api';
import { findConflictingPick } from '@/lib/pick-conflicts';
import type { BetMarket } from '@/types/database';

import { BetTypeBadge, Pill, TeamLogo, TotalDirectionChip } from './atoms';
import {
  editableLegToSubmissionLeg,
  findOddsGame,
  formatAddConflictMessage,
  formatTeaserMovement,
  getAdjustedTeaserLine,
  getEditedPlacedBetMetrics,
  getEditIneligibleReason,
  getMissingReplacementLinesMessage,
  getModeTone,
  getOddsButtonLabel,
  getPlacedBetConflictLegs,
  getSelectionKey,
  getTeaserOddsButtonLabel,
  makeEditablePlacedLegs,
  makeEditedPlacedLeg,
  marketLabel,
  modeAccentHex,
  type BetMode,
  type EditingPlacedLeg,
} from './pick-board-model';

const MARKET_OPTIONS: SegmentedOption<BetMarket>[] = [
  { label: 'Winner', value: 'moneyline' },
  { label: 'Spread', value: 'spread' },
  { label: 'Total', value: 'over_under' },
];

function EditLegRow({
  isSelected,
  leg,
  onSelect,
  teaserPoints,
}: {
  isSelected: boolean;
  leg: EditingPlacedLeg;
  onSelect: () => void;
  teaserPoints: number | null;
}) {
  const accentColor = teaserPoints ? THEME_COLORS.cyanAccent : THEME_COLORS.amberAccent;

  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        'w-full rounded-2xl border bg-white/[0.04] p-3 text-left transition duration-150 ease-arena',
        'disabled:pointer-events-none disabled:opacity-60',
        !isSelected && 'border-white/[0.08] hover:bg-white/[0.07]',
      )}
      disabled={leg.locked}
      onClick={onSelect}
      style={isSelected ? { borderColor: accentColor, borderWidth: 2 } : undefined}
      type="button">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {leg.market === 'over_under' ? (
            <TotalDirectionChip
              isOver={leg.selection.toLowerCase().startsWith('over')}
              size={24}
            />
          ) : (
            <TeamLogo size={24} teamName={leg.label} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">{leg.label}</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-white/45">
              {marketLabel(leg.market)} · {formatGameTime(leg.game_start_time)}
            </p>
          </div>
        </div>
        <Pill tone={leg.locked ? 'muted' : isSelected ? 'amber' : 'green'}>
          {leg.locked ? 'Locked' : isSelected ? 'Swapping' : 'Open'}
        </Pill>
      </div>

      {teaserPoints ? (
        <p className="mt-2 text-[11px] font-black text-cyan-accent">
          {formatTeaserMovement(leg)}
        </p>
      ) : null}
    </button>
  );
}

function EditOddsButton({
  isSelected,
  mode,
  onSelect,
  selection,
  teaserPoints,
}: {
  isSelected: boolean;
  mode: BetMode;
  onSelect: () => void;
  selection: OddsSelection;
  teaserPoints?: number;
}) {
  const accent = modeAccentHex(mode);
  const isTeaser = mode === 'teaser' && teaserPoints !== undefined;
  const primaryLabel = isTeaser
    ? getTeaserOddsButtonLabel(selection, teaserPoints as 6 | 6.5 | 7)
    : getOddsButtonLabel(selection);

  return (
    <button
      aria-label={
        isTeaser ? primaryLabel : `${primaryLabel} ${formatAmericanOdds(selection.odds)}`
      }
      aria-pressed={isSelected}
      className={cn(
        'flex min-h-[64px] w-full min-w-0 items-center gap-2 rounded-2xl border px-2.5 py-2.5 text-left',
        'transition-colors duration-150 ease-arena',
        isSelected ? '' : 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]',
      )}
      onClick={onSelect}
      style={
        isSelected
          ? { backgroundColor: `${accent}2E`, borderColor: accent, borderWidth: 2 }
          : undefined
      }
      type="button">
      {selection.market === 'over_under' ? (
        <TotalDirectionChip isOver={selection.selection.toLowerCase().startsWith('over')} />
      ) : (
        <TeamLogo teamName={selection.selection || selection.shortName} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-black text-white">{primaryLabel}</span>
        {isTeaser ? null : (
          <span className="mt-1 block truncate text-[13px] font-black text-electric-green">
            {formatAmericanOdds(selection.odds)}
          </span>
        )}
      </span>
    </button>
  );
}

function EditSelectionGrid({
  game,
  market,
  mode,
  onMarketChange,
  onSelect,
  selectedKeys,
  teaserPoints,
}: {
  game: OddsGame;
  market: BetMarket;
  mode: BetMode;
  onMarketChange?: (market: BetMarket) => void;
  onSelect: (game: OddsGame, selection: OddsSelection) => void;
  selectedKeys: Set<string>;
  teaserPoints?: number;
}) {
  const resolvedMarket = mode === 'teaser' && market === 'moneyline' ? 'spread' : market;
  const selections = game.markets[resolvedMarket];
  const accentHex = modeAccentHex(mode);
  const marketOptions = MARKET_OPTIONS.filter(
    (option) => mode !== 'teaser' || option.value !== 'moneyline',
  ).map((option) => ({ ...option, accent: getModeTone(mode) }));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
          NFL · {formatGameTime(game.commenceTime)}
        </p>
        <p className="mt-1 text-base font-black uppercase leading-tight text-white">
          {game.awayTeam}
          <span style={{ color: accentHex }}> @ </span>
          {game.homeTeam}
        </p>
      </div>

      {onMarketChange ? (
        <SegmentedToggle
          accent={getModeTone(mode)}
          compact
          onChange={onMarketChange}
          options={marketOptions}
          value={resolvedMarket}
        />
      ) : null}

      {selections.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm font-semibold text-white/50">
          {marketLabel(resolvedMarket)} lines aren't published for this game yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {selections.map((selection) => (
            <EditOddsButton
              isSelected={selectedKeys.has(getSelectionKey(game.id, selection))}
              key={`${selection.market}:${selection.selection}:${selection.line ?? 'na'}`}
              mode={mode}
              onSelect={() => onSelect(game, selection)}
              selection={selection}
              teaserPoints={teaserPoints}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PostSubmitEditModal({
  bet,
  isSaving,
  oddsGames,
  onCancel,
  onRetryReplacementLines,
  onSave,
  placedBets,
  replacementLinesError,
  replacementLinesLoading = false,
}: {
  bet: PlacedBet | null;
  isSaving: boolean;
  oddsGames: OddsGame[];
  onCancel: () => void;
  onRetryReplacementLines?: () => void;
  onSave: (edit: BetEditSubmission) => Promise<void>;
  placedBets: PlacedBet[];
  replacementLinesError?: Error | null;
  replacementLinesLoading?: boolean;
}) {
  const [legs, setLegs] = useState<EditingPlacedLeg[]>([]);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [marketByGameId, setMarketByGameId] = useState<Record<string, BetMarket>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bet) {
      setLegs([]);
      setSelectedLegId(null);
      setMarketByGameId({});
      setErrorMessage(null);
      return;
    }

    const editableLegs = makeEditablePlacedLegs(bet, oddsGames);
    setLegs(editableLegs);
    setSelectedLegId(editableLegs.find((leg) => !leg.locked)?.id ?? editableLegs[0]?.id ?? null);
    setMarketByGameId(Object.fromEntries(editableLegs.map((leg) => [leg.game_id, leg.market])));
    setErrorMessage(null);
  }, [bet, oddsGames]);

  if (!bet) {
    return null;
  }

  const mode: BetMode = bet.bet_type;
  const accent = modeAccentHex(mode);
  const metrics = getEditedPlacedBetMetrics(bet, legs);
  const selectedLeg = legs.find((leg) => leg.id === selectedLegId) ?? null;
  const selectedKeys = new Set(legs.map((leg) => leg.selectionKey));
  const otherLegs = getPlacedBetConflictLegs(placedBets, bet.id, oddsGames);
  const straightGame = selectedLeg ? findOddsGame(oddsGames, selectedLeg.game_id) : undefined;
  const editIneligibleReason = getEditIneligibleReason(bet, legs);

  const changed = legs.some((leg) => {
    const original = bet.bet_legs.find((item) => item.id === leg.betLegId);
    return Boolean(
      original &&
        (original.game_id !== leg.game_id ||
          original.market !== leg.market ||
          original.selection !== leg.selection ||
          original.original_line !== leg.original_line ||
          original.adjusted_line !== leg.adjusted_line ||
          original.leg_odds !== leg.leg_odds ||
          original.game_start_time !== leg.game_start_time),
    );
  });
  const canSave = changed && !isSaving && !errorMessage && !editIneligibleReason;

  const replaceSelectedLeg = (game: OddsGame, selection: OddsSelection) => {
    if (!selectedLeg) {
      setErrorMessage('Choose a leg to swap first.');
      return;
    }

    if (selectedLeg.locked) {
      setErrorMessage('That leg is locked because its game has started.');
      return;
    }

    if (
      mode === 'straight' &&
      (game.id !== selectedLeg.game_id || selection.market !== selectedLeg.market)
    ) {
      setErrorMessage('Straight pick edits keep the same game and market.');
      return;
    }

    if (mode === 'teaser' && selection.market === 'moneyline') {
      setErrorMessage('Teasers can only use spreads and over/unders.');
      return;
    }

    const adjustedLine =
      mode === 'teaser' && bet.teaser_points
        ? getAdjustedTeaserLine(selection, bet.teaser_points)
        : selection.line;
    const nextLeg = makeEditedPlacedLeg(selectedLeg, game, selection, adjustedLine);
    const draftLegs = legs.filter((leg) => leg.id !== selectedLeg.id);
    const conflict = findConflictingPick([...otherLegs, ...draftLegs], nextLeg);

    if (conflict) {
      setErrorMessage(formatAddConflictMessage(nextLeg, conflict));
      return;
    }

    setErrorMessage(null);
    setLegs((current) => current.map((leg) => (leg.id === selectedLeg.id ? nextLeg : leg)));
  };

  const save = async () => {
    if (!canSave) return;

    await onSave({
      bet_id: bet.id,
      legs: legs.map(editableLegToSubmissionLeg),
      odds: metrics.odds,
      potential_payout: metrics.potential_payout,
      teaser_points: metrics.teaser_points,
    });
  };

  const gameList = mode === 'straight' ? (straightGame ? [straightGame] : []) : oddsGames;
  const showLoading = replacementLinesLoading && gameList.length === 0;
  const showError = !showLoading && Boolean(replacementLinesError) && gameList.length === 0;

  return (
    <Modal
      className="max-w-3xl"
      footer={
        <>
          <Button
            disabled={isSaving}
            fullWidth={false}
            onClick={onCancel}
            title="Cancel"
            variant="secondary"
          />
          <Button
            disabled={!canSave}
            fullWidth={false}
            loading={isSaving}
            onClick={() => {
              void save();
            }}
            title={changed ? (mode === 'straight' ? 'Confirm Swap' : 'Save Changes') : 'Choose a Swap'}
          />
        </>
      }
      onClose={isSaving ? () => undefined : onCancel}
      open
      subtitle={
        mode === 'straight'
          ? 'Choose the other side from this same game and market. Coins stay fixed.'
          : 'Choose an unlocked leg, then click a replacement line. Coins stay fixed.'
      }
      title={mode === 'straight' ? 'Swap Side' : `Edit ${mode}`}>
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <BetTypeBadge betType={mode} />
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
              {formatCurrency(bet.amount)} fixed
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.08] pt-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
              New Reward
            </p>
            <p className="text-base font-black" style={{ color: accent }}>
              {formatAmericanOdds(metrics.odds)} · {formatCurrency(metrics.potential_payout)}
            </p>
          </div>
        </Card>

        {errorMessage ? (
          <div className="flex items-start gap-2 rounded-2xl border border-white/12 bg-white/[0.06] p-3">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-accent" />
            <p className="flex-1 text-sm font-semibold leading-5 text-white/75">{errorMessage}</p>
            <button
              aria-label="Dismiss message"
              className="shrink-0 rounded-lg p-1 text-white/55 transition hover:bg-white/10 hover:text-white"
              onClick={() => setErrorMessage(null)}
              type="button">
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {mode !== 'straight' ? (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
              Pick Leg to Swap
            </p>
            {legs.map((leg) => (
              <EditLegRow
                isSelected={leg.id === selectedLegId}
                key={leg.id}
                leg={leg}
                onSelect={() => {
                  setSelectedLegId(leg.id);
                  setErrorMessage(null);
                }}
                teaserPoints={bet.teaser_points}
              />
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
            Replacement Lines
          </p>

          {editIneligibleReason ? (
            <Card className="flex items-start gap-2">
              <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-white/55" />
              <p className="flex-1 text-sm font-semibold leading-5 text-white/60">
                {editIneligibleReason}
              </p>
            </Card>
          ) : showLoading ? (
            <Card className="flex items-center gap-3">
              <Loader2
                aria-hidden
                className="h-5 w-5 animate-spin"
                style={{ color: accent }}
              />
              <p className="flex-1 text-sm font-semibold text-white/60">
                Loading replacement lines...
              </p>
            </Card>
          ) : showError ? (
            <Card className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-coral-red" />
                <p className="flex-1 text-sm font-semibold leading-5 text-coral-red">
                  {replacementLinesError?.message ??
                    'Unable to load replacement lines right now.'}
                </p>
              </div>
              {onRetryReplacementLines ? (
                <Button
                  onClick={onRetryReplacementLines}
                  title="Try Again"
                  variant="secondary"
                />
              ) : null}
            </Card>
          ) : gameList.length === 0 ? (
            <Card>
              <p className="text-sm font-semibold leading-5 text-white/55">
                {getMissingReplacementLinesMessage(mode, selectedLeg)}
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {gameList.map((game) => {
                const activeMarket =
                  mode === 'straight'
                    ? selectedLeg?.market ?? 'moneyline'
                    : marketByGameId[game.id] ?? (mode === 'teaser' ? 'spread' : 'moneyline');

                return (
                  <EditSelectionGrid
                    game={game}
                    key={game.id}
                    market={activeMarket}
                    mode={mode}
                    onMarketChange={
                      mode === 'straight'
                        ? undefined
                        : (market) =>
                            setMarketByGameId((current) => ({ ...current, [game.id]: market }))
                    }
                    onSelect={replaceSelectedLeg}
                    selectedKeys={selectedKeys}
                    teaserPoints={bet.teaser_points ?? undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
