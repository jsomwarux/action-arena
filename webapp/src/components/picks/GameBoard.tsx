/**
 * The left pane: the slate.
 *
 * Where the phone shows one market at a time behind a segmented control, the
 * desktop card shows moneyline, spread and total at once — six live prices per
 * game, which is the whole reason a player keeps this window open next to their
 * research. Teaser mode drops the Winner row because teasers cannot take a
 * moneyline (AGENTS.md "Teasers", enforced again in submit_bets), and shows the
 * teased line on the face of the button with the raw line beneath it.
 */

import { Fragment, useMemo } from 'react';

import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';

import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatAmericanOdds } from '@/lib/format';
import type { OddsGame, OddsSelection } from '@/lib/odds-api';
import type { BetMarket } from '@/types/database';
import type { TeaserPoints } from '@/types/database';

import { ARENA_SPRING, Pill, TeamLogo, TotalDirectionChip } from './atoms';
import {
  formatLine,
  getGameDateParts,
  getGameDayGroupKey,
  getGameDayGroupLabel,
  getModeTone,
  getOddsButtonLabel,
  getSelectionKey,
  getTeaserOddsButtonLabel,
  modeAccentHex,
  type BetMode,
  type SelectionConflict,
} from './pick-board-model';

/** Short row labels — "Over/Under" does not fit a 4rem gutter. */
const MARKET_ROWS: { label: string; market: BetMarket }[] = [
  { label: 'Winner', market: 'moneyline' },
  { label: 'Spread', market: 'spread' },
  { label: 'Total', market: 'over_under' },
];

function isOverSelection(selection: OddsSelection) {
  return selection.selection.toLowerCase().startsWith('over');
}

function OddsButton({
  conflict,
  disabled,
  isSelected,
  lockedReason,
  mode,
  onSelect,
  selection,
  teaserPoints,
}: {
  conflict: SelectionConflict | null;
  disabled: boolean;
  isSelected: boolean;
  lockedReason: string | null;
  mode: BetMode;
  onSelect: () => void;
  selection: OddsSelection;
  teaserPoints: TeaserPoints;
}) {
  const accentHex = modeAccentHex(mode);
  const tone = getModeTone(mode);
  const isTeaserMode = mode === 'teaser';
  const primaryLabel = isTeaserMode
    ? getTeaserOddsButtonLabel(selection, teaserPoints)
    : getOddsButtonLabel(selection);
  const hasConflict = Boolean(conflict) && !isSelected;
  const teasedFrom =
    isTeaserMode && selection.line !== null
      ? `from ${selection.market === 'spread' ? formatLine(selection.line) : selection.line}`
      : null;

  const idleBorderClass =
    tone === 'amber'
      ? 'border-amber-accent/20 hover:border-amber-accent/60'
      : tone === 'cyan'
        ? 'border-cyan-accent/20 hover:border-cyan-accent/60'
        : 'border-white/[0.10] hover:border-electric-green/60';

  return (
    <motion.button
      aria-label={
        isTeaserMode ? primaryLabel : `${primaryLabel} ${formatAmericanOdds(selection.odds)}`
      }
      aria-pressed={isSelected}
      className={cn(
        'group relative flex min-h-[68px] w-full min-w-0 items-center gap-2 rounded-2xl border px-2.5 py-2.5 text-left',
        'transition-colors duration-150 ease-arena',
        'disabled:pointer-events-none',
        isSelected
          ? 'bg-white/[0.03]'
          : hasConflict
            ? 'border-white/[0.18] bg-white/[0.03] opacity-70'
            : cn('bg-white/[0.04] hover:bg-white/[0.07]', idleBorderClass),
        disabled && 'opacity-40',
      )}
      disabled={disabled}
      onClick={onSelect}
      style={
        isSelected
          ? {
              backgroundColor: `${accentHex}2E`,
              borderColor: accentHex,
              borderWidth: 2,
              boxShadow: `0 0 14px ${accentHex}66`,
            }
          : undefined
      }
      title={lockedReason ?? conflict?.message ?? undefined}
      transition={ARENA_SPRING}
      type="button"
      whileHover={disabled ? undefined : { scale: 1.015 }}
      whileTap={disabled ? undefined : { scale: 0.975 }}>
      {selection.market === 'over_under' ? (
        <TotalDirectionChip isOver={isOverSelection(selection)} />
      ) : (
        <TeamLogo teamName={selection.selection || selection.shortName} />
      )}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[15px] font-black leading-tight',
            hasConflict ? 'text-white/60' : 'text-white',
          )}>
          {primaryLabel}
        </span>
        {isTeaserMode ? (
          teasedFrom ? (
            <span className="mt-1 block truncate text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-accent/80">
              {teasedFrom}
            </span>
          ) : null
        ) : (
          <span
            className="mt-1 block truncate text-[13px] font-black leading-tight"
            style={{ color: isSelected ? accentHex : hasConflict ? 'rgba(255,255,255,0.5)' : undefined }}>
            <span className={cn(!isSelected && !hasConflict && 'text-electric-green')}>
              {formatAmericanOdds(selection.odds)}
            </span>
          </span>
        )}
      </span>

      {isSelected ? (
        <span
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border"
          style={{ backgroundColor: `${accentHex}24`, borderColor: `${accentHex}99` }}>
          <Check aria-hidden className="h-3 w-3" style={{ color: accentHex }} />
        </span>
      ) : hasConflict || lockedReason ? (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/[0.08]">
          <Lock aria-hidden className="h-2.5 w-2.5 text-white/65" />
        </span>
      ) : null}
    </motion.button>
  );
}

function MarketRow({
  game,
  getSelectionConflict,
  isGameLocked,
  label,
  market,
  mode,
  onSelect,
  readOnly,
  selectedKeys,
  teaserPoints,
}: {
  game: OddsGame;
  getSelectionConflict: (game: OddsGame, selection: OddsSelection) => SelectionConflict | null;
  isGameLocked: boolean;
  label: string;
  market: BetMarket;
  mode: BetMode;
  onSelect: (game: OddsGame, selection: OddsSelection) => void;
  readOnly: boolean;
  selectedKeys: Set<string>;
  teaserPoints: TeaserPoints;
}) {
  const selections = game.markets[market];
  const lockedReason = isGameLocked
    ? 'This game has already started, so its lines are closed.'
    : null;

  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-2">
      <p className="flex items-center text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>

      {selections.length === 0 ? (
        <p className="col-span-2 flex min-h-[68px] items-center rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-semibold text-white/45">
          {label} lines aren't published for this game yet.
        </p>
      ) : (
        selections.map((selection) => {
          const key = getSelectionKey(game.id, selection);
          const isSelected = selectedKeys.has(key);

          return (
            <OddsButton
              conflict={isSelected ? null : getSelectionConflict(game, selection)}
              disabled={readOnly || isGameLocked}
              isSelected={isSelected}
              key={`${selection.market}:${selection.selection}:${selection.line ?? 'na'}`}
              lockedReason={lockedReason}
              mode={mode}
              onSelect={() => onSelect(game, selection)}
              selection={selection}
              teaserPoints={teaserPoints}
            />
          );
        })
      )}
    </div>
  );
}

export function GameCard({
  game,
  getSelectionConflict,
  mode,
  now,
  onSelect,
  readOnly,
  selectedKeys,
  teaserPoints,
}: {
  game: OddsGame;
  getSelectionConflict: (game: OddsGame, selection: OddsSelection) => SelectionConflict | null;
  mode: BetMode;
  now: number;
  onSelect: (game: OddsGame, selection: OddsSelection) => void;
  readOnly: boolean;
  selectedKeys: Set<string>;
  teaserPoints: TeaserPoints;
}) {
  const { dayLabel, timeLabel } = getGameDateParts(game.commenceTime);
  const isGameLocked = new Date(game.commenceTime).getTime() <= now;
  const accentHex = modeAccentHex(mode);
  // Teasers cannot take a moneyline, so the Winner row is not offered at all.
  const rows = mode === 'teaser' ? MARKET_ROWS.filter((row) => row.market !== 'moneyline') : MARKET_ROWS;

  return (
    <Card className={cn('flex flex-col gap-3.5', isGameLocked && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
            NFL · {dayLabel} · <span className="text-white/60">{timeLabel}</span>
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-[17px] font-black uppercase leading-tight tracking-[-0.01em] text-white">
            <TeamLogo size={22} teamName={game.awayTeam} />
            <span className="truncate">{game.awayTeam}</span>
            <span className="shrink-0" style={{ color: accentHex }}>
              @
            </span>
            <span className="truncate">{game.homeTeam}</span>
            <TeamLogo size={22} teamName={game.homeTeam} />
          </h3>
        </div>
        {isGameLocked ? (
          <Pill icon={Lock} tone="muted">
            Locked
          </Pill>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <MarketRow
            game={game}
            getSelectionConflict={getSelectionConflict}
            isGameLocked={isGameLocked}
            key={row.market}
            label={row.label}
            market={row.market}
            mode={mode}
            onSelect={onSelect}
            readOnly={readOnly}
            selectedKeys={selectedKeys}
            teaserPoints={teaserPoints}
          />
        ))}
      </div>
    </Card>
  );
}

export function GameCardSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <Card className="flex flex-col gap-3.5" key={index}>
          <div className="flex flex-col gap-2">
            <div className="h-3 w-40 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-5 w-64 animate-pulse rounded bg-white/[0.09]" />
          </div>
          {Array.from({ length: 3 }, (_, row) => (
            <div
              className="grid grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-2"
              key={row}>
              <div className="h-3 self-center w-12 animate-pulse rounded bg-white/[0.07]" />
              <div className="h-[68px] animate-pulse rounded-2xl bg-white/[0.05]" />
              <div className="h-[68px] animate-pulse rounded-2xl bg-white/[0.05]" />
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

/**
 * The slate, grouped by kickoff day.
 *
 * Entrance motion moves the card up into place and never touches opacity, so a
 * card that never gets animated is simply a card sitting where it belongs.
 */
export function GameGrid({
  games,
  getSelectionConflict,
  mode,
  now,
  onSelect,
  readOnly,
  selectedKeys,
  teaserPoints,
}: {
  games: OddsGame[];
  getSelectionConflict: (game: OddsGame, selection: OddsSelection) => SelectionConflict | null;
  mode: BetMode;
  now: number;
  onSelect: (game: OddsGame, selection: OddsSelection) => void;
  readOnly: boolean;
  selectedKeys: Set<string>;
  teaserPoints: TeaserPoints;
}) {
  const dayGroups = useMemo(() => {
    const groups = new Map<string, { games: OddsGame[]; label: string }>();

    games.forEach((game) => {
      const key = getGameDayGroupKey(game.commenceTime);
      const existing = groups.get(key);
      if (existing) {
        existing.games.push(game);
        return;
      }
      groups.set(key, { games: [game], label: getGameDayGroupLabel(game.commenceTime) });
    });

    return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
  }, [games]);

  return (
    <div className="flex flex-col gap-6">
      {dayGroups.map((group, groupIndex) => (
        <Fragment key={group.key}>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="arena-heading text-xl leading-none text-white/85">{group.label}</h2>
              <span className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                {group.games.length} game{group.games.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              {group.games.map((game, index) => (
                <motion.div
                  animate={{ y: 0 }}
                  initial={{ y: 12 }}
                  key={game.id}
                  transition={{
                    ...ARENA_SPRING,
                    delay: groupIndex === 0 ? Math.min(index, 8) * 0.035 : 0,
                  }}>
                  <GameCard
                    game={game}
                    getSelectionConflict={getSelectionConflict}
                    mode={mode}
                    now={now}
                    onSelect={onSelect}
                    readOnly={readOnly}
                    selectedKeys={selectedKeys}
                    teaserPoints={teaserPoints}
                  />
                </motion.div>
              ))}
            </div>
          </section>
        </Fragment>
      ))}
    </div>
  );
}
