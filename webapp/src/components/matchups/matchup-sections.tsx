import {
  CalendarClock,
  CalendarX,
  CircleUser,
  PauseCircle,
  Star,
  User,
  UserCheck,
} from 'lucide-react';

import { CosmeticAvatar } from '@/components/cosmetics';
import { Card } from '@/components/ui';
import { LOCK_OF_THE_WEEK_MULTIPLIER } from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import type { BetWithLegs, MatchupDetail, MatchupPickVisibility } from '@/hooks/use-matchups';
import { cn } from '@/lib/cn';
import { formatLeagueType, formatProfit, formatRecord, getProfitTone } from '@/lib/format';
import { getLeagueMemberPrimaryName } from '@/lib/league-member-display';
import {
  getMatchupSideStatus,
  getProfitSwingHeadline,
  type MatchupSideStatus,
} from '@/lib/matchup-language';
import type { EquippedCosmeticsByCategory, LiveGameStateRow } from '@/types/database';

import {
  BetCard,
  DidNotSubmitPlaceholder,
  EmptyBets,
  HiddenPicksPlaceholder,
  NoLockFiledPlaceholder,
  revealMessage,
} from './bet-card';
import { AnimatedNumber, Badge, StaggeredItem } from './primitives';

export type Side = 'home' | 'away';

export function matchupSideName(detail: MatchupDetail, side: Side) {
  if (side === 'home') {
    return getLeagueMemberPrimaryName(detail.homeMember, detail.homeUser, 'Home');
  }

  return detail.matchup.away_user_id
    ? getLeagueMemberPrimaryName(detail.awayMember, detail.awayUser, 'Opponent')
    : 'Bye Week';
}

function PlayerSide({
  cosmetics,
  isUser,
  name,
  profit,
  record,
  side,
  status,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  isUser: boolean;
  name: string;
  profit: number;
  record: string;
  side: Side;
  status: MatchupSideStatus;
}) {
  const isWinningStatus = status === 'leading' || status === 'won';
  const isLosingStatus = status === 'trailing' || status === 'lost';
  const accentBorder = isUser
    ? 'border-electric-green/60 bg-electric-green/15'
    : isWinningStatus
      ? 'border-gold/55 bg-gold/15'
      : isLosingStatus
        ? 'border-coral-red/35 bg-coral-red/10'
        : 'border-white/15 bg-white/[0.05]';
  const statusTone = isWinningStatus
    ? 'border-gold/50 bg-gold/15 text-gold'
    : isLosingStatus
      ? 'border-coral-red/45 bg-coral-red/15 text-coral-red'
      : null;
  const glow = isUser ? THEME_COLORS.electricGreen : isWinningStatus ? THEME_COLORS.gold : null;

  return (
    <div
      className="flex flex-1 flex-col items-center gap-3 transition-transform duration-300 ease-arena"
      style={{ transform: isWinningStatus ? 'scale(1.06)' : undefined }}>
      <div
        className={cn(
          'flex h-24 w-24 items-center justify-center rounded-2xl border',
          accentBorder,
        )}
        style={glow ? { boxShadow: `0 0 18px ${glow}80` } : undefined}>
        <CosmeticAvatar cosmetics={cosmetics} name={name} size="lg" />
      </div>

      <div className="flex w-full flex-col items-center gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[1.5px] text-white/45">
            {isUser ? 'You' : side === 'home' ? 'Home' : 'Opponent'}
          </span>
          {statusTone && status ? (
            <span
              className={cn(
                'rounded-full border px-2 py-[1px] text-[9px] font-black uppercase tracking-[1.2px]',
                statusTone,
              )}>
              {status}
            </span>
          ) : null}
        </div>
        <p className="w-full truncate text-center text-lg font-black tracking-[-0.3px] text-white">
          {name}
        </p>
        <p className="text-[11px] font-semibold text-white/45">{record}</p>
        <AnimatedNumber
          className={cn('text-4xl font-black tracking-[-0.6px]', getProfitTone(profit))}
          decimals={0}
          prefix={profit < 0 ? '-' : '+'}
          suffix=" coins"
          value={Math.abs(profit)}
        />
      </div>
    </div>
  );
}

export function FightCardHeader({
  cosmeticsByUserId,
  detail,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory | undefined>;
  detail: MatchupDetail;
  userId: string | undefined;
}) {
  const homeProfit = detail.matchup.home_profit ?? detail.homeStanding?.weekly_profit ?? 0;
  const awayProfit = detail.matchup.away_profit ?? detail.awayStanding?.weekly_profit ?? 0;
  const winnerId = detail.matchup.winner_id;
  const homeStatus = getMatchupSideStatus({
    opposingProfit: awayProfit,
    sideProfit: homeProfit,
    sideUserId: detail.matchup.home_user_id,
    winnerId,
  });
  const awayStatus = getMatchupSideStatus({
    opposingProfit: homeProfit,
    sideProfit: awayProfit,
    sideUserId: detail.matchup.away_user_id,
    winnerId,
  });

  return (
    <Card className="p-6" tone="highlight">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 rounded-full bg-electric-green" />
              <span className="text-[10px] font-black uppercase tracking-[2.5px] text-electric-green">
                Week {detail.matchup.week_number} · Matchup
              </span>
            </div>
            <h1 className="arena-heading mt-2 text-5xl leading-none">Head to Head</h1>
            <p className="mt-1.5 truncate text-sm font-semibold text-white/55">
              {detail.league.name} · {formatLeagueType(detail.league.type)}
            </p>
          </div>
          {detail.matchup.is_championship ? (
            <Badge label="Championship" tone="gold" />
          ) : detail.matchup.is_playoff ? (
            <Badge label="Playoff" tone="cyan" />
          ) : null}
        </div>

        <div className="flex items-center">
          <PlayerSide
            cosmetics={cosmeticsByUserId[detail.matchup.home_user_id]}
            isUser={detail.matchup.home_user_id === userId}
            name={matchupSideName(detail, 'home')}
            profit={homeProfit}
            record={
              detail.homeStanding
                ? formatRecord(
                    detail.homeStanding.wins,
                    detail.homeStanding.losses,
                    detail.homeStanding.ties,
                  )
                : '0-0'
            }
            side="home"
            status={homeStatus}
          />
          <div className="px-6">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 bg-gold/15 text-lg font-black text-gold"
              style={{ boxShadow: `0 0 16px ${THEME_COLORS.gold}80` }}>
              VS
            </span>
          </div>
          <PlayerSide
            cosmetics={
              detail.matchup.away_user_id
                ? cosmeticsByUserId[detail.matchup.away_user_id]
                : undefined
            }
            isUser={detail.matchup.away_user_id === userId}
            name={matchupSideName(detail, 'away')}
            profit={awayProfit}
            record={
              detail.awayStanding
                ? formatRecord(
                    detail.awayStanding.wins,
                    detail.awayStanding.losses,
                    detail.awayStanding.ties,
                  )
                : detail.matchup.away_user_id
                  ? '0-0'
                  : 'Bye'
            }
            side="away"
            status={awayStatus}
          />
        </div>
      </div>
    </Card>
  );
}

/** The weekly profit race: who is ahead, by how much, and which way it is moving. */
export function ProfitTug({
  awayName,
  awayProfit,
  awayUserId,
  homeName,
  homeProfit,
  homeUserId,
  winnerId,
}: {
  awayName: string;
  awayProfit: number;
  awayUserId: string | null;
  homeName: string;
  homeProfit: number;
  homeUserId: string;
  winnerId: string | null;
}) {
  const range = Math.max(Math.abs(homeProfit) + Math.abs(awayProfit), 1);
  const homeWidth = Math.max(8, Math.min(92, ((homeProfit + range) / (range * 2)) * 100));
  const diff = homeProfit - awayProfit;
  const headline = getProfitSwingHeadline({
    awayName,
    awayProfit,
    awayUserId,
    homeName,
    homeProfit,
    homeUserId,
    winnerId,
  });
  const compactDiff = formatProfit(diff).replace(' coins', '');

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[1.8px] text-white/45">
              Profit Swing
            </p>
            <p className="mt-1 text-lg font-black tracking-[-0.3px] text-white">{headline}</p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[1.2px]',
              diff > 0
                ? 'border-electric-green/40 bg-electric-green/15 text-electric-green'
                : diff < 0
                  ? 'border-coral-red/40 bg-coral-red/15 text-coral-red'
                  : 'border-white/15 bg-white/[0.04] text-white/55',
            )}>
            {compactDiff}
          </span>
        </div>

        <div className="flex h-3 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
          <div
            className="h-full bg-electric-green transition-[width] duration-650 ease-arena"
            style={{ width: `${homeWidth}%` }}
          />
          <div className="h-full flex-1 bg-coral-red" />
        </div>

        <div className="flex flex-col gap-2">
          {[
            { color: 'bg-electric-green', name: homeName, profit: homeProfit },
            { color: 'bg-coral-red', name: awayName, profit: awayProfit },
          ].map((row) => (
            <div className="flex items-center justify-between gap-3" key={row.name}>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', row.color)} />
                <span className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-[1.2px] text-white/55">
                  {row.name}
                </span>
              </div>
              <span className="shrink-0 text-[11px] font-black uppercase tracking-[1.2px] text-white/55">
                {formatProfit(row.profit)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function LockShowdownSide({
  bet,
  cosmetics,
  isUser,
  liveScoresByGameId,
  name,
  onBetPress,
  sideLabel,
  visibility,
}: {
  bet: BetWithLegs | null;
  cosmetics?: EquippedCosmeticsByCategory;
  isUser: boolean;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  name: string;
  onBetPress?: (bet: BetWithLegs) => void;
  sideLabel: string;
  visibility: MatchupPickVisibility;
}) {
  const hidden = !isUser && !visibility.isVisible;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[1.5px] text-white/55">
          {sideLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-base font-black tracking-[-0.2px] text-white">
          {name}
        </span>
      </div>
      {hidden ? (
        <HiddenPicksPlaceholder revealAt={visibility.revealAt} submitted={visibility.isSubmitted} />
      ) : bet ? (
        <BetCard
          bet={bet}
          cosmetics={cosmetics}
          isUser={isUser}
          liveScoresByGameId={liveScoresByGameId}
          onOpen={onBetPress ? () => onBetPress(bet) : undefined}
        />
      ) : !visibility.isSubmitted && visibility.isVisible ? (
        <DidNotSubmitPlaceholder />
      ) : (
        <NoLockFiledPlaceholder />
      )}
    </div>
  );
}

export function LockShowdown({
  awayBet,
  awayCosmetics,
  awayIsUser,
  awayName,
  awayVisibility,
  homeBet,
  homeCosmetics,
  homeIsUser,
  homeName,
  homeVisibility,
  liveScoresByGameId,
  onAwayBetPress,
  onHomeBetPress,
}: {
  awayBet: BetWithLegs | null;
  awayCosmetics?: EquippedCosmeticsByCategory;
  awayIsUser: boolean;
  awayName: string;
  awayVisibility: MatchupPickVisibility;
  homeBet: BetWithLegs | null;
  homeCosmetics?: EquippedCosmeticsByCategory;
  homeIsUser: boolean;
  homeName: string;
  homeVisibility: MatchupPickVisibility;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  onAwayBetPress?: (bet: BetWithLegs) => void;
  onHomeBetPress?: (bet: BetWithLegs) => void;
}) {
  const showHomeHidden = !homeIsUser && !homeVisibility.isVisible && homeVisibility.isSubmitted;
  const showAwayHidden = !awayIsUser && !awayVisibility.isVisible && awayVisibility.isSubmitted;
  const showHomeDidNotSubmit = homeVisibility.isVisible && !homeVisibility.isSubmitted;
  const showAwayDidNotSubmit = awayVisibility.isVisible && !awayVisibility.isSubmitted;

  if (
    !homeBet &&
    !awayBet &&
    !showHomeHidden &&
    !showAwayHidden &&
    !showHomeDidNotSubmit &&
    !showAwayDidNotSubmit
  ) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Star aria-hidden className="h-3 w-3 text-gold" fill={THEME_COLORS.gold} />
            <span className="text-[10px] font-black uppercase tracking-[2px] text-gold">
              Headline Fight
            </span>
            <Star aria-hidden className="h-3 w-3 text-gold" fill={THEME_COLORS.gold} />
          </div>
          <p className="text-center text-xl font-black tracking-[-0.3px] text-white">
            Pick of the Week Showdown
          </p>
          <p className="text-center text-[11px] font-medium text-white/55">
            Each Pick of the Week rewards or costs {LOCK_OF_THE_WEEK_MULTIPLIER}x. The biggest swing
            of the week.
          </p>
        </div>

        <div className="flex items-stretch gap-5">
          <LockShowdownSide
            bet={homeBet}
            cosmetics={homeCosmetics}
            isUser={homeIsUser}
            liveScoresByGameId={liveScoresByGameId}
            name={homeName}
            onBetPress={onHomeBetPress}
            sideLabel="Home"
            visibility={homeVisibility}
          />
          <div className="flex shrink-0 flex-col items-center justify-center gap-3">
            <span aria-hidden className="w-px flex-1 bg-white/15" />
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-xs font-black text-white/65">
              VS
            </span>
            <span aria-hidden className="w-px flex-1 bg-white/15" />
          </div>
          <LockShowdownSide
            bet={awayBet}
            cosmetics={awayCosmetics}
            isUser={awayIsUser}
            liveScoresByGameId={liveScoresByGameId}
            name={awayName}
            onBetPress={onAwayBetPress}
            sideLabel="Away"
            visibility={awayVisibility}
          />
        </div>
      </div>
    </Card>
  );
}

export function BetColumnSection({
  bets,
  cosmetics,
  emptyVariant,
  isUser,
  liveScoresByGameId,
  onBetPress,
  side,
  subtitle,
  title,
  visibility,
}: {
  bets: BetWithLegs[];
  cosmetics?: EquippedCosmeticsByCategory;
  emptyVariant: 'You' | 'Opponent' | 'Player';
  isUser: boolean;
  liveScoresByGameId: Record<string, LiveGameStateRow | undefined>;
  onBetPress?: (bet: BetWithLegs) => void;
  side: Side;
  subtitle?: string;
  title: string;
  visibility: MatchupPickVisibility;
}) {
  const accentColor = isUser
    ? THEME_COLORS.electricGreen
    : side === 'home'
      ? THEME_COLORS.cyanAccent
      : THEME_COLORS.coralRed;
  const hidden = !isUser && !visibility.isVisible;
  const notSubmittedRevealed = !isUser && visibility.isVisible && !visibility.isSubmitted;
  const statusLabel = hidden
    ? visibility.isSubmitted
      ? 'Submitted'
      : 'Not submitted'
    : notSubmittedRevealed
      ? 'Not submitted'
      : `${bets.length} ${bets.length === 1 ? 'pick' : 'picks'}`;
  const hiddenMessage = hidden ? revealMessage(visibility.revealAt) : null;
  const resolvedSubtitle = hidden || notSubmittedRevealed ? null : subtitle;
  const HeadIcon = isUser ? UserCheck : User;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
            style={{ backgroundColor: `${accentColor}1a`, borderColor: `${accentColor}55` }}>
            <HeadIcon aria-hidden className="h-4 w-4" style={{ color: accentColor }} />
          </span>
          <div className="min-w-0">
            <p
              className="text-[10px] font-black uppercase tracking-[2px]"
              style={{ color: accentColor }}>
              {isUser ? 'Your Card' : 'Opponent Card'}
            </p>
            <p className="truncate text-base font-black tracking-[-0.3px] text-white">{title}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-black uppercase tracking-[1.2px] text-white/65">
          {statusLabel}
        </span>
      </header>

      {resolvedSubtitle ? (
        <p className="text-xs font-semibold text-white/45">{resolvedSubtitle}</p>
      ) : null}

      {hiddenMessage ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-white/55">{hiddenMessage.body}</p>
          <p className="text-[10px] font-black uppercase tracking-[1.2px] text-electric-green">
            {hiddenMessage.time}
          </p>
        </div>
      ) : null}

      {hidden ? (
        <HiddenPicksPlaceholder revealAt={visibility.revealAt} submitted={visibility.isSubmitted} />
      ) : notSubmittedRevealed ? (
        <DidNotSubmitPlaceholder compact />
      ) : bets.length === 0 ? (
        <EmptyBets side={emptyVariant} />
      ) : (
        <div className="flex flex-col gap-3">
          {bets.map((bet, index) => (
            <StaggeredItem index={index} key={bet.id} perItemDelay={45}>
              <BetCard
                bet={bet}
                cosmetics={cosmetics}
                isUser={isUser}
                liveScoresByGameId={liveScoresByGameId}
                onOpen={onBetPress ? () => onBetPress(bet) : undefined}
              />
            </StaggeredItem>
          ))}
        </div>
      )}
    </section>
  );
}

export function WeekUnavailableCard({ weekNumber }: { weekNumber: number }) {
  return (
    <Card className="p-8">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10">
          <CalendarClock aria-hidden className="h-6 w-6 text-cyan-accent" />
        </span>
        <h2 className="arena-heading text-2xl leading-none">Odds Release Monday</h2>
        <p className="max-w-md text-center text-sm font-semibold leading-5 text-white/55">
          Week {weekNumber} will unlock when the slate is posted. No matchup details or picks are
          interactive yet.
        </p>
      </div>
    </Card>
  );
}

export function NoMatchupScheduledCard({ weekNumber }: { weekNumber: number }) {
  return (
    <Card className="p-8">
      <div className="flex flex-col items-center gap-3">
        <CalendarX aria-hidden className="h-7 w-7 text-white/50" />
        <p className="text-center text-lg font-black text-white">
          No matchup scheduled for Week {weekNumber}
        </p>
        <p className="text-center text-sm font-semibold text-white/50">
          This week is not available in the league schedule yet.
        </p>
      </div>
    </Card>
  );
}

export function ByeWeekBanner({ weekNumber }: { weekNumber: number }) {
  return (
    <div className="rounded-2xl border border-cyan-accent/20 bg-cyan-accent/[0.07] p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-accent/25 bg-white/[0.04]">
          <PauseCircle aria-hidden className="h-5 w-5 text-cyan-accent" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[2px] text-cyan-accent">
            Week {weekNumber} · Bye
          </p>
          <h2 className="arena-heading mt-2 text-3xl leading-none">You&rsquo;re on bye this week.</h2>
          <p className="mt-2 text-sm font-semibold leading-5 text-white/60">
            No matchup, no record impact.
          </p>
        </div>
      </div>
    </div>
  );
}

export function MatchupUnavailable() {
  return (
    <div className="flex flex-col items-center gap-4 py-24">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-coral-red/40 bg-coral-red/10">
        <CircleUser aria-hidden className="h-7 w-7 text-coral-red" />
      </span>
      <h1 className="arena-heading text-3xl leading-none">Matchup Unavailable</h1>
      <p className="text-center text-base font-semibold text-white/55">
        This matchup could not be loaded.
      </p>
    </div>
  );
}
