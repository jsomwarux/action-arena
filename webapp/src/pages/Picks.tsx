/**
 * /picks — the Pick Board.
 *
 * Two panes. The left is the week's slate: one card per game, all three markets
 * priced at once, started games visibly closed. The right is the Lineup rail,
 * which never leaves the screen — budget against the exact-100 rule, the active
 * parlay or teaser builder, every staged pick with its own coin field, the one
 * Pick of the Week, and the submit gate. Once the card is in, the left pane
 * becomes the submitted card with per-leg lock and live status, and the rail
 * becomes the week's ledger.
 *
 * Every rule this screen enforces is mirrored from `public.submit_bets`,
 * `public.update_submitted_bet` and `public.set_pick_of_week` via
 * components/picks/pick-board-model.ts. The client is deliberately no more
 * permissive than the database: a card that passes here is a card Postgres will
 * accept, and nothing here is relaxed to make submitting easier.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertCircle, CalendarClock, CalendarX, Clock, Receipt } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  BoardModeToggle,
  BoardNotice,
  LeagueSelect,
  type BoardMessage,
  type BoardMessageTone,
} from '@/components/picks/BoardHeader';
import { EmptyState } from '@/components/picks/atoms';
import { GameCardSkeletonGrid, GameGrid } from '@/components/picks/GameBoard';
import { LineupRail } from '@/components/picks/LineupRail';
import { PostSubmitEditModal } from '@/components/picks/PostSubmitEditModal';
import {
  SubmittedPicksGrid,
  SubmittedSummaryPanel,
} from '@/components/picks/SubmittedBoard';
import { ConfirmDialog, ConfirmSubmitDialog } from '@/components/picks/dialogs';
import {
  findDuplicateLegInBet,
  formatAddConflictMessage,
  formatLegConflictLabel,
  formatUpcomingSlateDate,
  getAdjustedTeaserLine,
  getPickAmountError,
  getSelectionKey,
  getSlipLegs,
  getTeaserOdds,
  getUpdatedSlipBetAfterLegRemoval,
  getValidationState,
  makeParlaySlipBet,
  makeSlipLeg,
  makeStraightBet,
  makeSelectionConflict,
  makeTeaserSlipBet,
  PARLAY_MAX_LEGS,
  PARLAY_MIN_LEGS,
  reteaseSlipLeg,
  updateSlipBetAmount,
  type BetMode,
  type ConflictSource,
  type SelectionConflict,
  type SlipBet,
  type SlipLeg,
} from '@/components/picks/pick-board-model';
import { useBoardClock } from '@/components/picks/use-board-clock';
import { Button, Card, WeekNavigator } from '@/components/ui';
import {
  MAX_SINGLE_BET,
  TEASER_MAX_LEGS,
  TEASER_MIN_LEGS,
  WEEKLY_BUDGET,
} from '@/constants/rules';
import { useAuth } from '@/hooks/use-auth';
import { useShareBetToChat } from '@/hooks/use-league-chat';
import { useMyLeagues } from '@/hooks/use-leagues';
import { useLiveScores } from '@/hooks/use-live-scores';
import {
  useLeagueWeekRevealTime,
  useSyncLeagueWeekSlate,
  useUpcomingNflOdds,
} from '@/hooks/use-odds';
import { useBetBoardAccess } from '@/hooks/use-season-pass';
import {
  usePlacedBets,
  useSetPickOfWeekMutation,
  useSubmitBetsMutation,
  useUpdatePlacedBetMutation,
  type BetEditSubmission,
  type PlacedBet,
} from '@/hooks/use-straight-bets';
import { getAppStoreCaptureMode } from '@/lib/league-settings';
import { formatCurrency } from '@/lib/format';
import type { OddsGame, OddsSelection } from '@/lib/odds-api';
import { areConflictingPicks, findConflictingPick, findPickConflict } from '@/lib/pick-conflicts';
import { formatPickTitle } from '@/lib/pick-labels';
import { ROUTES } from '@/lib/routes';
import type { TeaserPoints } from '@/types/database';

export function PicksPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedLeagueId = searchParams.get('leagueId') ?? undefined;

  const leaguesQuery = useMyLeagues(user?.id);
  const leagueSummaries = leaguesQuery.data ?? [];
  const leagues = useMemo(
    () => leagueSummaries.map((summary) => summary.league),
    [leagueSummaries],
  );

  const [selectedLeagueId, setSelectedLeagueId] = useState<string | undefined>();
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>();
  const [mode, setMode] = useState<BetMode>('straight');

  const [slipBets, setSlipBets] = useState<SlipBet[]>([]);
  const [parlayLegs, setParlayLegs] = useState<SlipLeg[]>([]);
  const [parlayAmount, setParlayAmount] = useState('');
  const [teaserLegs, setTeaserLegs] = useState<SlipLeg[]>([]);
  const [teaserAmount, setTeaserAmount] = useState('');
  const [teaserPoints, setTeaserPoints] = useState<TeaserPoints>(6);

  const [message, setMessage] = useState<BoardMessage | null>(null);
  const [pendingSwap, setPendingSwap] = useState<SelectionConflict | null>(null);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingPlacedBet, setEditingPlacedBet] = useState<PlacedBet | null>(null);
  const [sharingBetId, setSharingBetId] = useState<string | null>(null);

  const messageIdRef = useRef(0);
  const lastAppliedRouteLeagueIdRef = useRef<string | null>(null);

  const selectedLeague = leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0];
  const appStoreCaptureMode = getAppStoreCaptureMode(selectedLeague);
  const oddsQuery = useUpcomingNflOdds({ allowMockOdds: Boolean(appStoreCaptureMode) });

  const viewedWeek = selectedWeek ?? selectedLeague?.current_week;
  const isPastWeek =
    selectedLeague !== undefined &&
    viewedWeek !== undefined &&
    viewedWeek < selectedLeague.current_week;
  const isFutureWeek =
    selectedLeague !== undefined &&
    viewedWeek !== undefined &&
    viewedWeek > selectedLeague.current_week;
  const isCurrentWeek = Boolean(
    selectedLeague !== undefined && viewedWeek === selectedLeague.current_week,
  );

  const accessQuery = useBetBoardAccess({
    leagueId: selectedLeague?.id,
    userId: user?.id,
    weekNumber: viewedWeek,
  });
  const hasBetBoardAccessInputs = Boolean(selectedLeague?.id && user?.id && viewedWeek);
  const placedBetsQuery = usePlacedBets(selectedLeague?.id, user?.id, viewedWeek);
  const revealTimeQuery = useLeagueWeekRevealTime(selectedLeague?.id, viewedWeek);
  const submitBets = useSubmitBetsMutation(selectedLeague?.id, user?.id, viewedWeek);
  const updatePlacedBet = useUpdatePlacedBetMutation(selectedLeague?.id, user?.id, viewedWeek);
  const setPickOfWeek = useSetPickOfWeekMutation(selectedLeague?.id, user?.id, viewedWeek);
  const shareBet = useShareBetToChat(user?.id);

  const placedBets = placedBetsQuery.data ?? [];
  const hasLoadedPlacedBets = placedBetsQuery.isSuccess;
  const hasSubmittedLineup = hasLoadedPlacedBets && placedBets.length > 0;
  const isReadOnly = isPastWeek || hasSubmittedLineup;
  const canBuildLineup = isCurrentWeek && hasLoadedPlacedBets && !hasSubmittedLineup;
  const isCheckingBetBoardAccess = hasBetBoardAccessInputs && accessQuery.isLoading;
  const canAccessBetBoard = hasBetBoardAccessInputs ? accessQuery.data === true : true;
  const oddsGames = oddsQuery.data ?? [];
  const hasActiveSlate = oddsGames.length > 0;
  const canBuildLineupWithSlate = canBuildLineup && canAccessBetBoard && hasActiveSlate;
  const potwSwapClosed = revealTimeQuery.data
    ? Date.now() >= new Date(revealTimeQuery.data).getTime()
    : false;

  const now = useBoardClock();
  const validation = useMemo(() => getValidationState(slipBets, now), [now, slipBets]);

  useSyncLeagueWeekSlate(
    selectedLeague?.id,
    canBuildLineupWithSlate ? viewedWeek : undefined,
    oddsQuery.data,
  );

  const liveScoreGameIds = useMemo(
    () => placedBets.flatMap((bet) => bet.bet_legs.map((leg) => leg.game_id)),
    [placedBets],
  );
  const liveScoresQuery = useLiveScores(liveScoreGameIds);

  const notify = useCallback(
    (tone: BoardMessageTone, text: string, extra?: Partial<BoardMessage>) => {
      messageIdRef.current += 1;
      setMessage({ id: `msg-${messageIdRef.current}`, text, tone, ...extra });
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessage(null);
    setPendingSwap(null);
  }, []);

  // Successes are transient; conflicts and errors stay until the player acts.
  useEffect(() => {
    if (message?.tone !== 'success') {
      return undefined;
    }

    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  // Route param wins once, then the picker owns the choice — same precedence as
  // the mobile board's leagueId param.
  useEffect(() => {
    if (leagues.length === 0) {
      return;
    }

    const requestedLeague = requestedLeagueId
      ? leagues.find((league) => league.id === requestedLeagueId)
      : undefined;

    if (requestedLeague && lastAppliedRouteLeagueIdRef.current !== requestedLeagueId) {
      lastAppliedRouteLeagueIdRef.current = requestedLeagueId ?? null;
      setSelectedLeagueId(requestedLeague.id);
      return;
    }

    const selectedIsAvailable = leagues.some((league) => league.id === selectedLeagueId);
    if (!selectedLeagueId || !selectedIsAvailable) {
      setSelectedLeagueId(leagues[0].id);
    }
  }, [leagues, requestedLeagueId, selectedLeagueId]);

  useEffect(() => {
    if (selectedLeague) {
      setSelectedWeek(selectedLeague.current_week);
    }
  }, [selectedLeague?.current_week, selectedLeague?.id]);

  // A staged card belongs to one league-week. Switching either throws it away
  // rather than silently carrying picks onto a different slate.
  useEffect(() => {
    setSlipBets([]);
    setParlayLegs([]);
    setTeaserLegs([]);
    setParlayAmount('');
    setTeaserAmount('');
    setEditingPlacedBet(null);
    setMessage(null);
    setPendingSwap(null);
  }, [selectedLeagueId, viewedWeek]);

  // A pick being edited stops being editable the moment one of its games starts.
  useEffect(() => {
    if (!editingPlacedBet) {
      return;
    }

    const refreshed = placedBets.find((bet) => bet.id === editingPlacedBet.id);
    if (refreshed && refreshed.bet_legs.some((leg) => leg.locked || new Date(leg.game_start_time).getTime() <= now)) {
      setEditingPlacedBet(null);
      notify('warn', 'That pick locked while you were editing it — one of its games has started.');
    }
  }, [editingPlacedBet, notify, now, placedBets]);

  /**
   * Which prices show a check. In straight mode that is the staged straight
   * picks only: a leg living inside a staged parlay is not a straight pick, and
   * the same side may legally appear in both.
   */
  const selectedKeys = useMemo(() => {
    if (mode === 'parlay') {
      return new Set(parlayLegs.map((leg) => leg.selectionKey));
    }

    if (mode === 'teaser') {
      return new Set(teaserLegs.map((leg) => leg.selectionKey));
    }

    return new Set(
      slipBets
        .filter((bet) => bet.bet_type === 'straight')
        .flatMap((bet) => bet.legs.map((leg) => leg.selectionKey)),
    );
  }, [mode, parlayLegs, slipBets, teaserLegs]);

  const getTargetLegForSelection = useCallback(
    (game: OddsGame, selection: OddsSelection): SlipLeg | null => {
      if (mode === 'teaser') {
        if (selection.market === 'moneyline') {
          return null;
        }

        return makeSlipLeg(game, selection, getAdjustedTeaserLine(selection, teaserPoints));
      }

      return makeSlipLeg(game, selection);
    },
    [mode, teaserPoints],
  );

  const getConflictSources = useCallback((): { leg: SlipLeg; source: ConflictSource }[] => {
    return [
      ...parlayLegs.map((leg) => ({
        leg,
        source: { kind: 'builder' as const, mode: 'parlay' as const },
      })),
      ...teaserLegs.map((leg) => ({
        leg,
        source: { kind: 'builder' as const, mode: 'teaser' as const },
      })),
      ...slipBets.flatMap((bet) =>
        bet.legs.map((leg) => ({ leg, source: { bet, kind: 'slip' as const } })),
      ),
    ];
  }, [parlayLegs, slipBets, teaserLegs]);

  const getSelectionConflict = useCallback(
    (game: OddsGame, selection: OddsSelection): SelectionConflict | null => {
      const nextLeg = getTargetLegForSelection(game, selection);
      if (!nextLeg) {
        return null;
      }

      const alreadyInBuilder =
        (mode === 'parlay' && parlayLegs.some((leg) => leg.selectionKey === nextLeg.selectionKey)) ||
        (mode === 'teaser' && teaserLegs.some((leg) => leg.selectionKey === nextLeg.selectionKey));

      if (alreadyInBuilder) {
        return null;
      }

      const conflict = getConflictSources().find((item) => areConflictingPicks(item.leg, nextLeg));
      if (!conflict) {
        return null;
      }

      return makeSelectionConflict({
        existingLeg: conflict.leg,
        game,
        nextLeg,
        selection,
        source: conflict.source,
        targetMode: mode,
      });
    },
    [getConflictSources, getTargetLegForSelection, mode, parlayLegs, teaserLegs],
  );

  const stageStraight = useCallback((game: OddsGame, selection: OddsSelection) => {
    const next = makeStraightBet(game, selection, 0, '');
    setSlipBets((current) =>
      current.some((bet) => bet.id === next.id) ? current : [...current, next],
    );
  }, []);

  const removeSlipBet = useCallback((betId: string) => {
    setSlipBets((current) => current.filter((bet) => bet.id !== betId));
  }, []);

  const removeConflictSource = useCallback((conflict: SelectionConflict) => {
    if (conflict.source.kind === 'builder') {
      const setter = conflict.source.mode === 'parlay' ? setParlayLegs : setTeaserLegs;
      setter((current) =>
        current.filter((leg) => leg.selectionKey !== conflict.existingLeg.selectionKey),
      );
      return;
    }

    const sourceBet = conflict.source.bet;
    setSlipBets((current) =>
      current.flatMap((bet) => {
        if (bet.id !== sourceBet.id) {
          return [bet];
        }

        const updated = getUpdatedSlipBetAfterLegRemoval(bet, conflict.existingLeg.id);
        return updated ? [updated] : [];
      }),
    );
  }, []);

  const addConflictReplacement = useCallback(
    (conflict: SelectionConflict) => {
      if (conflict.targetMode === 'straight') {
        stageStraight(conflict.game, conflict.selection);
        return;
      }

      const maxLegs = conflict.targetMode === 'parlay' ? PARLAY_MAX_LEGS : TEASER_MAX_LEGS;
      const setter = conflict.targetMode === 'parlay' ? setParlayLegs : setTeaserLegs;

      setter((current) => {
        const replacedInCurrent = current.some(
          (leg) => leg.selectionKey === conflict.existingLeg.selectionKey,
        );

        if (replacedInCurrent) {
          return current.map((leg) =>
            leg.selectionKey === conflict.existingLeg.selectionKey ? conflict.nextLeg : leg,
          );
        }

        if (current.some((leg) => leg.selectionKey === conflict.nextLeg.selectionKey)) {
          return current;
        }

        if (current.length >= maxLegs) {
          notify('warn', `This pick can have up to ${maxLegs} legs.`);
          return current;
        }

        return [...current, conflict.nextLeg];
      });
    },
    [notify, stageStraight],
  );

  const applySelectionConflictSwap = useCallback(
    (conflict: SelectionConflict) => {
      const builderIsSource =
        conflict.source.kind === 'builder' && conflict.source.mode === conflict.targetMode;

      if (conflict.targetMode === 'parlay' && !builderIsSource && parlayLegs.length >= PARLAY_MAX_LEGS) {
        notify('warn', `This pick can have up to ${PARLAY_MAX_LEGS} legs.`);
        return;
      }

      if (conflict.targetMode === 'teaser' && !builderIsSource && teaserLegs.length >= TEASER_MAX_LEGS) {
        notify('warn', `This pick can have up to ${TEASER_MAX_LEGS} legs.`);
        return;
      }

      removeConflictSource(conflict);
      addConflictReplacement(conflict);
      clearMessages();
    },
    [addConflictReplacement, clearMessages, notify, parlayLegs.length, removeConflictSource, teaserLegs.length],
  );

  const addBuilderLeg = useCallback(
    (currentLegs: SlipLeg[], nextLeg: SlipLeg, maxLegs: number) => {
      if (currentLegs.some((leg) => leg.selectionKey === nextLeg.selectionKey)) {
        setMessage(null);
        return currentLegs.filter((leg) => leg.selectionKey !== nextLeg.selectionKey);
      }

      const conflictingLeg = findConflictingPick(
        [...getSlipLegs(slipBets), ...currentLegs],
        nextLeg,
      );
      if (conflictingLeg) {
        notify('warn', formatAddConflictMessage(nextLeg, conflictingLeg));
        return currentLegs;
      }

      if (currentLegs.length >= maxLegs) {
        notify('warn', `This pick can have up to ${maxLegs} legs.`);
        return currentLegs;
      }

      setMessage(null);
      return [...currentLegs, nextLeg];
    },
    [notify, slipBets],
  );

  const handleSelectOdds = useCallback(
    (game: OddsGame, selection: OddsSelection) => {
      if (!selectedLeague) {
        notify('warn', 'Join or create a league before building a card.');
        return;
      }

      if (!canAccessBetBoard) {
        notify(
          'warn',
          'Season Pass holders get the first 30 minutes when new matchups are posted. Free access opens automatically after the window ends.',
        );
        return;
      }

      if (new Date(game.commenceTime).getTime() <= now) {
        notify('warn', 'That game has already started, so its lines are closed.');
        return;
      }

      if (mode === 'straight') {
        const straightId = `straight:${getSelectionKey(game.id, selection)}`;
        if (slipBets.some((bet) => bet.id === straightId)) {
          clearMessages();
          removeSlipBet(straightId);
          return;
        }

        const conflict = getSelectionConflict(game, selection);
        if (conflict) {
          setMessage(null);
          setPendingSwap(conflict);
          return;
        }

        clearMessages();
        stageStraight(game, selection);
        return;
      }

      if (mode === 'parlay') {
        const conflict = getSelectionConflict(game, selection);
        if (conflict) {
          setMessage(null);
          setPendingSwap(conflict);
          return;
        }

        setParlayLegs((current) =>
          addBuilderLeg(current, makeSlipLeg(game, selection), PARLAY_MAX_LEGS),
        );
        return;
      }

      if (selection.market === 'moneyline') {
        notify('warn', 'Teasers can only use spreads and over/unders.');
        return;
      }

      const conflict = getSelectionConflict(game, selection);
      if (conflict) {
        setMessage(null);
        setPendingSwap(conflict);
        return;
      }

      const adjustedLine = getAdjustedTeaserLine(selection, teaserPoints);
      setTeaserLegs((current) =>
        addBuilderLeg(current, makeSlipLeg(game, selection, adjustedLine), TEASER_MAX_LEGS),
      );
    },
    [
      addBuilderLeg,
      canAccessBetBoard,
      clearMessages,
      getSelectionConflict,
      mode,
      notify,
      now,
      removeSlipBet,
      selectedLeague,
      slipBets,
      stageStraight,
      teaserPoints,
    ],
  );

  const handleAmountChange = useCallback((betId: string, next: string) => {
    const parsed = Number(next);
    const amount = next.trim() === '' || !Number.isFinite(parsed) || parsed < 0 ? 0 : parsed;

    setSlipBets((current) =>
      current.map((bet) => (bet.id === betId ? updateSlipBetAmount(bet, amount, next) : bet)),
    );
  }, []);

  const toggleLockBet = useCallback((betId: string) => {
    setSlipBets((current) =>
      current.map((bet) => ({ ...bet, is_lock: bet.id === betId ? !bet.is_lock : false })),
    );
  }, []);

  const addParlayToLineup = useCallback(() => {
    const amount = Number(parlayAmount);
    if (parlayLegs.length < PARLAY_MIN_LEGS) {
      notify('warn', 'Parlays need at least two legs.');
      return;
    }

    if (getPickAmountError(parlayAmount) || !Number.isFinite(amount) || amount <= 0) {
      notify('warn', `Set a parlay amount between 1 and ${formatCurrency(MAX_SINGLE_BET)}.`);
      return;
    }

    const bet = makeParlaySlipBet(parlayLegs, amount, parlayAmount);
    const conflict = findPickConflict(getSlipLegs(slipBets), bet.legs);
    if (conflict) {
      notify('warn', formatAddConflictMessage(conflict.nextLeg, conflict.existingLeg));
      return;
    }

    const duplicate = findDuplicateLegInBet(bet);
    if (duplicate) {
      notify(
        'warn',
        `${bet.label} already includes ${formatLegConflictLabel(duplicate.left)}. Remove the duplicate leg.`,
      );
      return;
    }

    setSlipBets((current) => {
      const existing = current.find((item) => item.id === bet.id);
      return [
        ...current.filter((item) => item.id !== bet.id),
        { ...bet, is_lock: existing?.is_lock ?? false },
      ];
    });
    clearMessages();
    setParlayLegs([]);
    setParlayAmount('');
  }, [clearMessages, notify, parlayAmount, parlayLegs, slipBets]);

  const addTeaserToLineup = useCallback(() => {
    const amount = Number(teaserAmount);
    if (teaserLegs.length < TEASER_MIN_LEGS) {
      notify('warn', 'Teasers need at least two legs.');
      return;
    }

    const odds = getTeaserOdds(teaserLegs.length, teaserPoints);
    if (!odds) {
      notify('warn', `Teasers take between ${TEASER_MIN_LEGS} and ${TEASER_MAX_LEGS} legs.`);
      return;
    }

    if (getPickAmountError(teaserAmount) || !Number.isFinite(amount) || amount <= 0) {
      notify('warn', `Set a teaser amount between 1 and ${formatCurrency(MAX_SINGLE_BET)}.`);
      return;
    }

    const bet = makeTeaserSlipBet(teaserLegs, teaserPoints, odds, amount, teaserAmount);
    const conflict = findPickConflict(getSlipLegs(slipBets), bet.legs);
    if (conflict) {
      notify('warn', formatAddConflictMessage(conflict.nextLeg, conflict.existingLeg));
      return;
    }

    const duplicate = findDuplicateLegInBet(bet);
    if (duplicate) {
      notify(
        'warn',
        `${bet.label} already includes ${formatLegConflictLabel(duplicate.left)}. Remove the duplicate leg.`,
      );
      return;
    }

    setSlipBets((current) => {
      const existing = current.find((item) => item.id === bet.id);
      return [
        ...current.filter((item) => item.id !== bet.id),
        { ...bet, is_lock: existing?.is_lock ?? false },
      ];
    });
    clearMessages();
    setTeaserLegs([]);
    setTeaserAmount('');
  }, [clearMessages, notify, slipBets, teaserAmount, teaserLegs, teaserPoints]);

  const handleTeaserPointsChange = useCallback((points: TeaserPoints) => {
    setTeaserPoints(points);
    setPendingSwap(null);
    setTeaserLegs((current) => current.map((leg) => reteaseSlipLeg(leg, points)));
  }, []);

  const handleConfirmSubmit = useCallback(async () => {
    if (submitBets.isPending) {
      return;
    }

    try {
      await submitBets.mutateAsync(slipBets);
      setIsConfirmOpen(false);
      setSlipBets([]);
      setParlayLegs([]);
      setTeaserLegs([]);
      setParlayAmount('');
      setTeaserAmount('');
      notify('success', 'Card submitted. Your picks are set at the values you chose.');
    } catch (error) {
      setIsConfirmOpen(false);
      notify('error', error instanceof Error ? error.message : 'Could not submit picks. Try again.');
    }
  }, [notify, slipBets, submitBets]);

  const handleOpenPlacedBetEdit = useCallback(
    (bet: PlacedBet) => {
      if (!isCurrentWeek) {
        notify('warn', 'Past weeks can be reviewed but not edited.');
        return;
      }

      if (bet.bet_legs.some((leg) => leg.locked || new Date(leg.game_start_time).getTime() <= now)) {
        notify('warn', 'This pick is locked because one of its games has started.');
        return;
      }

      setMessage(null);
      setEditingPlacedBet(bet);
      void oddsQuery.refetch();
    },
    [isCurrentWeek, notify, now, oddsQuery],
  );

  const handleSavePlacedBetEdit = useCallback(
    async (edit: BetEditSubmission) => {
      try {
        await updatePlacedBet.mutateAsync(edit);
        setEditingPlacedBet(null);
        notify('success', 'Pick updated.');
      } catch (error) {
        notify('error', error instanceof Error ? error.message : 'Could not update pick. Try again.');
      }
    },
    [notify, updatePlacedBet],
  );

  const handleSetPlacedPotw = useCallback(
    async (bet: PlacedBet) => {
      if (!isCurrentWeek || bet.is_lock || setPickOfWeek.isPending) {
        return;
      }

      if (potwSwapClosed) {
        notify('warn', 'Pick of the Week can no longer be changed after first kickoff.');
        return;
      }

      if (bet.bet_legs.some((leg) => leg.locked || new Date(leg.game_start_time).getTime() <= now)) {
        notify('warn', 'This pick is locked and cannot become Pick of the Week.');
        return;
      }

      try {
        await setPickOfWeek.mutateAsync(bet.id);
        notify('success', `${formatPickTitle(bet)} is now your Pick of the Week.`);
      } catch (error) {
        notify(
          'error',
          error instanceof Error ? error.message : 'Could not change Pick of the Week.',
        );
      }
    },
    [isCurrentWeek, notify, now, potwSwapClosed, setPickOfWeek],
  );

  const handleShare = useCallback(
    async (bet: PlacedBet) => {
      setSharingBetId(bet.id);
      try {
        await shareBet.mutateAsync(bet);
        notify('success', 'This pick is now in league chat.');
      } catch (error) {
        notify('error', error instanceof Error ? error.message : 'Could not share pick.');
      } finally {
        setSharingBetId(null);
      }
    },
    [notify, shareBet],
  );

  const refreshBoard = useCallback(() => {
    void oddsQuery.refetch();
    void placedBetsQuery.refetch();
    void accessQuery.refetch();
    void revealTimeQuery.refetch();
  }, [accessQuery, oddsQuery, placedBetsQuery, revealTimeQuery]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (leaguesQuery.isLoading) {
    return (
      <section className="flex flex-col gap-6">
        <div className="h-12 w-64 animate-pulse rounded-xl bg-white/[0.07]" />
        <GameCardSkeletonGrid />
      </section>
    );
  }

  if (leagues.length === 0) {
    return (
      <section className="flex flex-col gap-6">
        <Card>
          <EmptyState icon={Receipt} title="Pick Board">
            Join or create a league before building your weekly card.
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link to={ROUTES.leagueCreate}>
                <Button fullWidth={false} title="Create a League" />
              </Link>
              <Link to={ROUTES.leagueJoin}>
                <Button fullWidth={false} title="Join a League" variant="secondary" />
              </Link>
            </div>
          </EmptyState>
        </Card>
      </section>
    );
  }

  const showSubmittedBoard = isPastWeek || hasSubmittedLineup;
  const nextSlateLabel = formatUpcomingSlateDate(revealTimeQuery.data);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-electric-green">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            {viewedWeek ? `Week ${viewedWeek}` : 'Week —'}
          </p>
          <h1 className="arena-heading mt-1 text-5xl leading-none">Pick Board</h1>
          <p className="mt-2 max-w-2xl text-textMuted">
            Stack straights, parlays and teasers across the slate. Allocate all{' '}
            {formatCurrency(WEEKLY_BUDGET)} across at least 5 picks, with one Pick of the Week.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <LeagueSelect
            leagues={leagues}
            onSelect={setSelectedLeagueId}
            selectedLeagueId={selectedLeague?.id}
          />
          {viewedWeek ? (
            <WeekNavigator
              onChange={setSelectedWeek}
              week={viewedWeek}
            />
          ) : null}
        </div>
      </header>

      {message ? <BoardNotice message={message} onDismiss={() => setMessage(null)} /> : null}

      {isFutureWeek && viewedWeek ? (
        <Card>
          <EmptyState icon={CalendarClock} title="Odds Release Monday" tone="cyan">
            Week {viewedWeek} is not open yet. The card builder unlocks when the slate is released.
          </EmptyState>
        </Card>
      ) : null}

      {canBuildLineup && isCheckingBetBoardAccess ? (
        <Card>
          <EmptyState icon={Clock} title="Checking Access" tone="cyan">
            Confirming whether this slate is inside the Season Pass early-access window.
          </EmptyState>
        </Card>
      ) : null}

      {canBuildLineup && !isCheckingBetBoardAccess && !canAccessBetBoard ? (
        <Card tone="highlight">
          <EmptyState icon={Clock} title="Early Access Window" tone="cyan">
            Season Pass holders can build cards for the first 30 minutes after new matchups are
            posted. Free access opens automatically after the window ends.
          </EmptyState>
        </Card>
      ) : null}

      {showSubmittedBoard && viewedWeek ? (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0">
            {placedBetsQuery.isLoading ? (
              <GameCardSkeletonGrid count={2} />
            ) : (
              <SubmittedPicksGrid
                bets={placedBets}
                liveScoresByGameId={liveScoresQuery.scoresByGameId}
                now={now}
                onEdit={handleOpenPlacedBetEdit}
                onSetPotw={(bet) => {
                  void handleSetPlacedPotw(bet);
                }}
                onShare={(bet) => {
                  void handleShare(bet);
                }}
                potwSwapClosed={potwSwapClosed}
                potwSwapPendingBetId={setPickOfWeek.isPending ? setPickOfWeek.variables ?? null : null}
                readOnly={isPastWeek}
                sharingBetId={sharingBetId}
                weekNumber={viewedWeek}
              />
            )}
          </div>

          <aside className="xl:sticky xl:top-20">
            <SubmittedSummaryPanel
              bets={placedBets}
              isRefreshing={placedBetsQuery.isRefetching}
              onRefresh={refreshBoard}
              potwSwapClosed={potwSwapClosed}
              readOnly={isPastWeek}
              weekNumber={viewedWeek}
            />
          </aside>
        </div>
      ) : null}

      {!showSubmittedBoard && !isFutureWeek ? (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-5">
            {canBuildLineupWithSlate ? <BoardModeToggle onChange={setMode} value={mode} /> : null}

            {placedBetsQuery.isLoading || (canBuildLineup && canAccessBetBoard && oddsQuery.isLoading) ? (
              <GameCardSkeletonGrid />
            ) : null}

            {canBuildLineup && canAccessBetBoard && oddsQuery.isError ? (
              <Card className="flex items-center gap-2">
                <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-coral-red" />
                <p className="flex-1 text-sm font-semibold text-coral-red">
                  {oddsQuery.error instanceof Error
                    ? oddsQuery.error.message
                    : 'Unable to load lines right now.'}
                </p>
                <Button fullWidth={false} onClick={refreshBoard} title="Retry" variant="secondary" />
              </Card>
            ) : null}

            {canBuildLineup &&
            canAccessBetBoard &&
            !oddsQuery.isLoading &&
            !oddsQuery.isError &&
            !hasActiveSlate ? (
              <Card>
                <EmptyState
                  icon={CalendarX}
                  title={nextSlateLabel ? 'Next Slate Opens Soon' : 'Season Starts Soon'}
                  tone="cyan">
                  {nextSlateLabel
                    ? `Next slate opens ${nextSlateLabel}. No current NFL games are available for picks yet.`
                    : 'No active NFL slate is available right now. When the next week opens, games and lines will appear here.'}
                </EmptyState>
              </Card>
            ) : null}

            {canBuildLineupWithSlate ? (
              <GameGrid
                games={oddsGames}
                getSelectionConflict={getSelectionConflict}
                mode={mode}
                now={now}
                onSelect={handleSelectOdds}
                readOnly={isReadOnly}
                selectedKeys={selectedKeys}
                teaserPoints={teaserPoints}
              />
            ) : null}
          </div>

          <aside className="xl:sticky xl:top-20">
            <LineupRail
              isSubmitting={submitBets.isPending}
              mode={mode}
              onAmountChange={handleAmountChange}
              onClearAll={() => setIsClearAllOpen(true)}
              onRemove={removeSlipBet}
              onSubmit={() => setIsConfirmOpen(true)}
              onToggleLock={toggleLockBet}
              parlay={{
                amountText: parlayAmount,
                legs: parlayLegs,
                onAdd: addParlayToLineup,
                onAmountChange: setParlayAmount,
                onRemoveLeg: (id) =>
                  setParlayLegs((current) => current.filter((leg) => leg.id !== id)),
              }}
              slipBets={slipBets}
              teaser={{
                amountText: teaserAmount,
                legs: teaserLegs,
                onAdd: addTeaserToLineup,
                onAmountChange: setTeaserAmount,
                onRemoveLeg: (id) =>
                  setTeaserLegs((current) => current.filter((leg) => leg.id !== id)),
                onTeaserPointsChange: handleTeaserPointsChange,
                teaserPoints,
              }}
              validation={validation}
            />
          </aside>
        </div>
      ) : null}

      <ConfirmSubmitDialog
        isSubmitting={submitBets.isPending}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          void handleConfirmSubmit();
        }}
        open={isConfirmOpen}
        slipBets={slipBets}
      />

      <ConfirmDialog
        body="This clears every staged pick and its coin amount."
        confirmLabel="Clear All"
        destructive
        onCancel={() => setIsClearAllOpen(false)}
        onConfirm={() => {
          setIsClearAllOpen(false);
          setSlipBets([]);
          clearMessages();
        }}
        open={isClearAllOpen}
        title="Remove all picks from your card?"
      />

      <ConfirmDialog
        body={pendingSwap?.message}
        confirmLabel="Replace"
        onCancel={() => setPendingSwap(null)}
        onConfirm={() => {
          if (pendingSwap) {
            applySelectionConflictSwap(pendingSwap);
          }
          setPendingSwap(null);
        }}
        open={pendingSwap !== null}
        title={pendingSwap?.promptTitle ?? 'Replace this pick?'}
      />

      <PostSubmitEditModal
        bet={editingPlacedBet}
        isSaving={updatePlacedBet.isPending}
        oddsGames={oddsGames}
        onCancel={() => setEditingPlacedBet(null)}
        onRetryReplacementLines={() => {
          void oddsQuery.refetch();
        }}
        onSave={handleSavePlacedBetEdit}
        placedBets={placedBets}
        replacementLinesError={oddsQuery.error instanceof Error ? oddsQuery.error : null}
        replacementLinesLoading={oddsQuery.isLoading || oddsQuery.isRefetching}
      />
    </section>
  );
}
