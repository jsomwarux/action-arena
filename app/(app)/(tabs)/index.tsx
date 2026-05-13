import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  LivePulse,
  PressableScale,
  ScreenWrapper,
  SkeletonLoader,
  StaggeredItem,
} from '@/components/ui';
import { MINIMUM_BETS_PER_WEEK } from '@/constants/rules';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  type BetWithLegs,
  type HomeLeagueCard,
  remainingBetsNeeded,
  useHomeDashboard,
} from '@/hooks/use-matchups';
import type { WeeklyAward } from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import {
  formatAmericanOdds,
  formatCurrency,
  formatLeagueType,
  formatProfit,
  formatRecord,
  getProfitTone,
} from '@/lib/format';
import { formatBetLegLabel, formatPickTitle } from '@/lib/pick-labels';
import { isParentPickLocked } from '@/lib/pick-locking';

function bestBet(bets: BetWithLegs[], direction: 'best' | 'worst') {
  const settled = bets.filter((bet) => bet.profit !== null);

  if (settled.length === 0) {
    return null;
  }

  return settled.sort((left, right) =>
    direction === 'best'
      ? (right.profit ?? 0) - (left.profit ?? 0)
      : (left.profit ?? 0) - (right.profit ?? 0),
  )[0];
}

function hasLiveBets(bets: BetWithLegs[]) {
  return bets.some((bet) => bet.result === 'pending' && isParentPickLocked(bet));
}

function Header() {
  const router = useRouter();

  return (
    <View className="gap-4">
      <View>
        <View className="flex-row items-center gap-2">
          <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
          <Text
            className="text-xs font-semibold uppercase text-electric-green"
            style={{ letterSpacing: 1.2 }}>
            Command Center
          </Text>
        </View>
        <Text
          className="mt-1 text-3xl font-extrabold text-white"
          style={{ letterSpacing: -0.5 }}>
          Home
        </Text>
        <Text className="mt-1.5 text-base font-medium text-white/60">
          Track the week, spot urgent leagues, and jump into picks.
        </Text>
      </View>

      <PressableScale onPress={() => router.push('/bet-board')}>
        <View
          className="flex-row items-center gap-3 rounded-2xl border border-electric-green bg-electric-green p-3"
          style={{
            shadowColor: THEME_COLORS.electricGreen,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.45,
            shadowRadius: 16,
          }}>
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-arena-bg/15">
            <Ionicons color={THEME_COLORS.background} name="flash" size={22} />
          </View>
          <View className="flex-1">
            <Text
              className="text-[11px] font-bold uppercase text-arena-bg/75"
              style={{ letterSpacing: 0.8 }}>
              Quick Action
            </Text>
            <Text
              className="text-lg font-black text-arena-bg"
              style={{ letterSpacing: -0.2 }}>
              Open Pick Board
            </Text>
          </View>
          <Ionicons color={THEME_COLORS.background} name="arrow-forward" size={22} />
        </View>
      </PressableScale>
    </View>
  );
}

function LoadingState() {
  return (
    <View className="gap-4">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <View className="gap-4">
            <SkeletonLoader height={22} width="60%" />
            <SkeletonLoader height={86} radius={16} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function EmptyState() {
  const router = useRouter();

  return (
    <Card>
      <View className="items-center gap-5 py-4">
        <View className="h-20 w-20 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
          <Ionicons color={THEME_COLORS.electricGreen} name="shield" size={36} />
        </View>
        <View className="items-center gap-2.5">
          <Text
            className="text-2xl font-black uppercase text-white"
            style={{ letterSpacing: -0.4 }}>
            No Leagues Yet
          </Text>
          <Text className="px-2 text-center text-base font-semibold leading-snug text-white/65">
            Join a league to see your weekly matchups and results here.
          </Text>
        </View>
        <Button title="Find a League" variant="secondary" onPress={() => router.push('/leagues/join')} />
      </View>
    </Card>
  );
}

function ActionNeeded({ cards }: { cards: HomeLeagueCard[] }) {
  const router = useRouter();
  const urgentCards = cards.filter((card) => remainingBetsNeeded(card.betsPlaced) > 0);

  if (urgentCards.length === 0) {
    return null;
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons color={THEME_COLORS.amberAccent} name="alert-circle" size={16} />
        <Text
          className="text-[11px] font-black uppercase text-amber-accent"
          style={{ letterSpacing: 2 }}>
          Action Needed
        </Text>
      </View>
      {urgentCards.map((card, index) => {
        const needed = remainingBetsNeeded(card.betsPlaced);
        return (
          <StaggeredItem key={card.league.id} index={index} perItemDelay={70}>
            <PressableScale onPress={() => router.push('/bet-board')}>
              <LivePulse color={THEME_COLORS.amberAccent} intensity={0.55}>
                <View
                  className="rounded-2xl border border-amber-accent/55 bg-amber-accent/10 p-4"
                  style={{
                    shadowColor: THEME_COLORS.amberAccent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                  }}>
                  <View className="flex-row items-center gap-3">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-2xl border border-amber-accent/55 bg-amber-accent/20"
                      style={{
                        shadowColor: THEME_COLORS.amberAccent,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.4,
                        shadowRadius: 10,
                      }}>
                      <Ionicons color={THEME_COLORS.amberAccent} name="flash" size={22} />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text
                        className="text-base font-black uppercase text-white"
                        numberOfLines={1}
                        style={{ letterSpacing: -0.3 }}>
                        {card.league.name}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-semibold text-white/70">
                          {needed} more {needed === 1 ? 'pick' : 'picks'} until lineup is ready
                        </Text>
                      </View>
                    </View>
                    <View className="items-center gap-1.5">
                      <View className="rounded-full border border-amber-accent/45 bg-amber-accent/15 px-2 py-0.5">
                        <Text
                          className="text-[10px] font-black uppercase text-amber-accent"
                          style={{ letterSpacing: 1.2 }}>
                          {card.betsPlaced}/{MINIMUM_BETS_PER_WEEK}
                        </Text>
                      </View>
                      <Text
                        className="text-[10px] font-black uppercase text-amber-accent"
                        style={{ letterSpacing: 1.4 }}>
                        Submit Picks
                      </Text>
                    </View>
                  </View>
                </View>
              </LivePulse>
            </PressableScale>
          </StaggeredItem>
        );
      })}
    </View>
  );
}

function SectionHeading({ caption, count, title }: { caption?: string; count?: number; title: string }) {
  return (
    <View className="flex-row items-end justify-between">
      <View className="flex-row items-center gap-2">
        <View className="h-0.5 w-4 rounded-full bg-electric-green" />
        <Text
          className="text-[11px] font-semibold uppercase text-electric-green"
          style={{ letterSpacing: 0.8 }}>
          {title}
        </Text>
      </View>
      {caption ? (
        <Text className="text-[11px] font-medium text-white/45">{caption}</Text>
      ) : count !== undefined ? (
        <Text className="text-[11px] font-medium text-white/45">
          {count} {count === 1 ? 'league' : 'leagues'}
        </Text>
      ) : null}
    </View>
  );
}

function ThisWeekCard({ card }: { card: HomeLeagueCard }) {
  const router = useRouter();
  const isH2H = card.league.type === 'h2h';
  const needed = remainingBetsNeeded(card.betsPlaced);
  const currentMatchup = card.currentMatchup;
  const opponentLabel =
    card.opponent?.display_name ?? (card.currentMatchup ? 'Bye Week' : 'Schedule Pending');
  const live = hasLiveBets(card.thisWeekBets);

  return (
    <Card>
      <View className="gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-2">
            <Text
              className="text-xl font-black uppercase text-white"
              numberOfLines={1}
              style={{ letterSpacing: -0.3 }}>
              {card.league.name}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Badge label={formatLeagueType(card.league.type)} tone={isH2H ? 'cyan' : 'gold'} />
              <Badge label={`Week ${card.league.current_week}`} tone="green" />
              {live ? (
                <View className="flex-row items-center gap-1 rounded-full border border-gold/45 bg-gold/15 px-2 py-0.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-gold" />
                  <Text
                    className="text-[10px] font-black uppercase text-gold"
                    style={{ letterSpacing: 1.4 }}>
                    Live
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View className="items-end">
            <Text
              className="text-[10px] font-black uppercase text-white/45"
              style={{ letterSpacing: 1.4 }}>
              Profit
            </Text>
            <AnimatedNumber
              className={cn('mt-1 text-2xl font-black', getProfitTone(card.weeklyProfit))}
              decimals={0}
              prefix={card.weeklyProfit < 0 ? '-' : '+'}
              suffix=" coins"
              style={{ letterSpacing: -0.5 }}
              value={Math.abs(card.weeklyProfit)}
            />
          </View>
        </View>

        <View className="rounded-2xl border border-white/[0.07] bg-white/[0.04]">
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-1 flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl border border-electric-green/45 bg-electric-green/15">
                <Ionicons color={THEME_COLORS.electricGreen} name="person" size={16} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[10px] font-black uppercase text-white/45"
                  style={{ letterSpacing: 1.4 }}>
                  You
                </Text>
                <Text
                  className="text-sm font-black text-white"
                  numberOfLines={1}
                  style={{ letterSpacing: -0.2 }}>
                  {isH2H && card.currentStanding
                    ? formatRecord(
                        card.currentStanding.wins,
                        card.currentStanding.losses,
                        card.currentStanding.ties,
                      )
                    : card.currentStanding
                      ? `Rank #${card.currentStanding.rank}`
                      : `${card.memberCount} members`}
                </Text>
              </View>
            </View>
            {isH2H ? (
              <View className="px-2">
                <View className="h-7 w-7 items-center justify-center rounded-full border border-gold/40 bg-gold/15">
                  <Text
                    className="text-[10px] font-black text-gold"
                    style={{ letterSpacing: 0.4 }}>
                    VS
                  </Text>
                </View>
              </View>
            ) : null}
            {isH2H ? (
              <View className="flex-1 flex-row items-center gap-3">
                <View className="flex-1 items-end">
                  <Text
                    className="text-[10px] font-black uppercase text-white/45"
                    style={{ letterSpacing: 1.4 }}>
                    Opponent
                  </Text>
                  <Text
                    className="text-sm font-black text-white"
                    numberOfLines={1}
                    style={{ letterSpacing: -0.2 }}>
                    {opponentLabel}
                  </Text>
                </View>
                <View className="h-10 w-10 items-center justify-center rounded-2xl border border-coral-red/35 bg-coral-red/10">
                  <Ionicons color={THEME_COLORS.coralRed} name="person-outline" size={16} />
                </View>
              </View>
            ) : (
              <View className="items-end">
                <Text
                  className="text-[10px] font-black uppercase text-white/45"
                  style={{ letterSpacing: 1.4 }}>
                  Field
                </Text>
                <Text className="text-sm font-black text-white">
                  {card.memberCount} players
                </Text>
              </View>
            )}
          </View>

          {currentMatchup ? (
            <View className="border-t border-white/[0.06]">
              <PressableScale
                onPress={() =>
                  router.push({
                    pathname: '/matchups/[matchupId]',
                    params: { matchupId: currentMatchup.id },
                  })
                }>
                <View className="flex-row items-center justify-center gap-1.5 py-3">
                  <Text
                    className="text-[10px] font-black uppercase text-electric-green"
                    style={{ letterSpacing: 1.5 }}>
                    Open Matchup
                  </Text>
                  <Ionicons color={THEME_COLORS.electricGreen} name="arrow-forward" size={12} />
                </View>
              </PressableScale>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Ionicons
              color={needed > 0 ? THEME_COLORS.amberAccent : THEME_COLORS.electricGreen}
              name={needed > 0 ? 'time-outline' : 'checkmark-circle'}
              size={14}
            />
            <Text
              className={cn(
                'text-[11px] font-black uppercase',
                needed > 0 ? 'text-amber-accent' : 'text-electric-green',
              )}
              style={{ letterSpacing: 1.4 }}>
              {card.betsPlaced}/{MINIMUM_BETS_PER_WEEK} picks submitted
            </Text>
          </View>
          <PressableScale onPress={() => router.push('/bet-board')}>
            <View
              className={cn(
                'flex-row items-center gap-1 rounded-full border px-3 py-1.5',
                needed > 0
                  ? 'border-electric-green/55 bg-electric-green/15'
                  : 'border-white/15 bg-white/[0.05]',
              )}>
              <Text
                className={cn(
                  'text-[10px] font-black uppercase',
                  needed > 0 ? 'text-electric-green' : 'text-white/65',
                )}
                style={{ letterSpacing: 1.2 }}>
                {needed > 0 ? `Place ${needed}` : 'Card Ready'}
              </Text>
              <Ionicons
                color={needed > 0 ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.55)'}
                name="chevron-forward"
                size={11}
              />
            </View>
          </PressableScale>
        </View>
      </View>
    </Card>
  );
}

function NotableBet({
  bet,
  label,
  tone,
}: {
  bet: BetWithLegs;
  label: string;
  tone: 'green' | 'red';
}) {
  const profit = bet.profit ?? 0;

  return (
    <View
      className={cn(
        'flex-row items-center justify-between gap-3 rounded-xl border px-3 py-2.5',
        tone === 'green'
          ? 'border-electric-green/25 bg-electric-green/[0.06]'
          : 'border-coral-red/25 bg-coral-red/[0.06]',
      )}>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-1.5">
          <Ionicons
            color={tone === 'green' ? THEME_COLORS.electricGreen : THEME_COLORS.coralRed}
            name={tone === 'green' ? 'trending-up' : 'trending-down'}
            size={11}
          />
          <Text
            className={cn(
              'text-[10px] font-black uppercase',
              tone === 'green' ? 'text-electric-green' : 'text-coral-red',
            )}
            style={{ letterSpacing: 1.3 }}>
            {label}
          </Text>
        </View>
        <Text
          className="text-sm font-black text-white"
          numberOfLines={1}
          style={{ letterSpacing: -0.2 }}>
          {formatPickTitle(bet)} · {formatAmericanOdds(bet.odds)}
        </Text>
      </View>
      <Text
        className={cn(
          'text-sm font-black',
          tone === 'green' ? 'text-electric-green' : 'text-coral-red',
        )}>
        {formatProfit(profit)}
      </Text>
    </View>
  );
}

function RecentResultCard({ card }: { card: HomeLeagueCard }) {
  const router = useRouter();
  const lastWeekMatchup = card.lastWeekMatchup;
  const lastProfit =
    card.lastWeekStanding?.weekly_profit ??
    card.lastWeekBets.reduce((sum, bet) => sum + (bet.profit ?? 0), 0);
  const biggestWin = bestBet(card.lastWeekBets, 'best');
  const biggestLoss = bestBet(card.lastWeekBets, 'worst');
  const won =
    Boolean(lastWeekMatchup?.winner_id) &&
    lastWeekMatchup?.winner_id === card.lastWeekStanding?.user_id;
  const lost =
    Boolean(lastWeekMatchup?.winner_id) &&
    Boolean(card.lastWeekStanding) &&
    lastWeekMatchup?.winner_id !== card.lastWeekStanding?.user_id;
  const isWin = won || (!lastWeekMatchup && lastProfit > 0);
  const isLoss = lost || (!lastWeekMatchup && lastProfit < 0);
  const outcome = won ? 'Win' : lost ? 'Loss' : lastWeekMatchup ? 'Tie' : lastProfit !== 0 ? (lastProfit > 0 ? 'Profit' : 'Loss') : 'Settled';

  return (
    <View>
      <View
        className={cn(
          'overflow-hidden rounded-2xl border bg-white/[0.04]',
          isWin
            ? 'border-electric-green/30'
            : isLoss
              ? 'border-coral-red/25'
              : 'border-white/[0.08]',
        )}
        style={
          isWin
            ? {
                shadowColor: THEME_COLORS.electricGreen,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 14,
              }
            : undefined
        }>
        <View
          className={cn(
            'h-[3px] w-full',
            isWin ? 'bg-electric-green' : isLoss ? 'bg-coral-red/60' : 'bg-white/10',
          )}
        />
        <View className="gap-4 p-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Ionicons
                  color={
                    isWin
                      ? THEME_COLORS.electricGreen
                      : isLoss
                        ? THEME_COLORS.coralRed
                        : 'rgba(255,255,255,0.55)'
                  }
                  name={isWin ? 'trophy' : isLoss ? 'remove-circle' : 'newspaper'}
                  size={14}
                />
                <Text
                  className={cn(
                    'text-[10px] font-black uppercase',
                    isWin
                      ? 'text-electric-green'
                      : isLoss
                        ? 'text-coral-red'
                        : 'text-white/55',
                  )}
                  style={{ letterSpacing: 1.6 }}>
                  Week {Math.max(1, card.league.current_week - 1)} · {outcome}
                </Text>
              </View>
              <Text
                className="mt-1 text-base font-black text-white"
                numberOfLines={1}
                style={{ letterSpacing: -0.3 }}>
                {card.league.name}
              </Text>
            </View>
            <Text
              className={cn('text-2xl font-black', getProfitTone(lastProfit))}
              style={{ letterSpacing: -0.5 }}>
              {formatProfit(lastProfit)}
            </Text>
          </View>

          <View className="gap-2">
            {biggestWin ? <NotableBet label="Biggest win" bet={biggestWin} tone="green" /> : null}
            {biggestLoss && biggestLoss.id !== biggestWin?.id ? (
              <NotableBet label="Biggest loss" bet={biggestLoss} tone="red" />
            ) : null}
            {!biggestWin && !biggestLoss ? (
              <Text className="text-sm font-semibold text-white/45">
                No settled picks from last week yet.
              </Text>
            ) : null}
          </View>

          {lastWeekMatchup ? (
            <PressableScale
              onPress={() =>
                router.push({
                  pathname: '/matchups/[matchupId]',
                  params: { matchupId: lastWeekMatchup.id },
                })
              }>
              <View className="flex-row items-center gap-1.5 self-start rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5">
                <Text
                  className="text-[10px] font-black uppercase text-white"
                  style={{ letterSpacing: 1.4 }}>
                  Open Matchup
                </Text>
                <Ionicons color={THEME_COLORS.textPrimary} name="arrow-forward" size={11} />
              </View>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </View>
  );
}

type AwardKind = 'sharpest' | 'coldStreak' | 'lock';

const AWARD_THEME: Record<
  AwardKind,
  {
    accent: string;
    barClass: string;
    bgClass: string;
    borderClass: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    subtitle: string;
    textClass: string;
    title: string;
  }
> = {
  coldStreak: {
    accent: THEME_COLORS.coralRed,
    barClass: 'bg-coral-red/55',
    bgClass: 'bg-coral-red/[0.07]',
    borderClass: 'border-coral-red/35',
    icon: 'flame',
    subtitle: 'A tough week with plenty of room for a comeback.',
    textClass: 'text-coral-red',
    title: 'Cold Streak',
  },
  lock: {
    accent: THEME_COLORS.electricGreen,
    barClass: 'bg-electric-green',
    bgClass: 'bg-electric-green/[0.08]',
    borderClass: 'border-electric-green/40',
    icon: 'lock-closed',
    subtitle: 'Biggest single profit of the week.',
    textClass: 'text-electric-green',
    title: 'Pick of the Week',
  },
  sharpest: {
    accent: THEME_COLORS.gold,
    barClass: 'bg-gold',
    bgClass: 'bg-gold/[0.08]',
    borderClass: 'border-gold/40',
    icon: 'trophy',
    subtitle: 'Best ROI across the league.',
    textClass: 'text-gold',
    title: 'Top Performer',
  },
};

function awardBetSummary(award: WeeklyAward) {
  const bet = award.bet;
  if (!bet) return null;

  return { betType: bet.bet_type, label: formatPickTitle(bet), odds: bet.odds, played: bet.amount };
}

function AwardTrophy({ award, kind }: { award: WeeklyAward; kind: AwardKind }) {
  const theme = AWARD_THEME[kind];
  const winnerName = award.user?.display_name ?? 'No winner yet';
  const summary = awardBetSummary(award);

  const trophy = (
    <View
      className={cn('overflow-hidden rounded-2xl border', theme.borderClass, theme.bgClass)}
      style={{
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
      }}>
      <View className={cn('h-[3px] w-full', theme.barClass)} />
      <View className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <View
            className={cn('h-11 w-11 items-center justify-center rounded-2xl border', theme.borderClass)}
            style={{
              backgroundColor: `${theme.accent}26`,
              shadowColor: theme.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 10,
            }}>
            <Ionicons color={theme.accent} name={theme.icon} size={22} />
          </View>
          <View className="flex-1">
            <Text
              className={cn('text-[10px] font-black uppercase', theme.textClass)}
              style={{ letterSpacing: 2 }}>
              {theme.title}
            </Text>
            <Text
              className="text-base font-black text-white"
              numberOfLines={1}
              style={{ letterSpacing: -0.3 }}>
              {winnerName}
            </Text>
          </View>
          {kind === 'sharpest' ? (
            <View className="items-end">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.4 }}>
                ROI
              </Text>
              <Text
                className="text-base font-black text-gold"
                style={{ letterSpacing: -0.3 }}>
                {award.roi >= 0 ? '+' : ''}
                {award.roi.toFixed(1)}%
              </Text>
            </View>
          ) : (
            <View className="items-end">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.4 }}>
                Profit
              </Text>
              <AnimatedNumber
                className={cn('text-base font-black', getProfitTone(award.profit))}
                decimals={0}
                prefix={award.profit < 0 ? '-' : '+'}
                suffix=" coins"
                style={{ letterSpacing: -0.3 }}
                value={Math.abs(award.profit)}
              />
            </View>
          )}
        </View>

        <Text className="text-[11px] font-semibold text-white/55">{theme.subtitle}</Text>

        {kind === 'lock' && summary ? (
          <View className="rounded-xl border border-electric-green/25 bg-arena-bg/40 p-3">
            <View className="flex-row items-center justify-between gap-2">
              <Badge betType={summary.betType} />
              <Text
                className="text-[10px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 1.4 }}>
                {formatAmericanOdds(summary.odds)}
              </Text>
            </View>
            <Text
              className="mt-2 text-sm font-black text-white"
              numberOfLines={2}
              style={{ letterSpacing: -0.2 }}>
              {summary.label}
            </Text>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-[11px] font-semibold text-white/55">
                Played {formatCurrency(summary.played)}
              </Text>
              <Text className="text-[11px] font-black text-electric-green">
                Profit {formatProfit(award.profit)}
              </Text>
            </View>
            {award.bet && award.bet.bet_legs.length > 1 ? (
              <View className="mt-3 gap-1.5">
                {award.bet.bet_legs.map((leg, index) => (
                  <View
                    className="flex-row items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2 py-1.5"
                    key={leg.id}>
                    <Text className="flex-1 text-[10px] font-semibold text-white/65" numberOfLines={1}>
                      {index + 1}. {formatBetLegLabel(leg, { betType: award.bet?.bet_type })}
                    </Text>
                    <Text className={cn('text-[9px] font-black uppercase', getProfitTone(leg.result === 'win' ? 1 : leg.result === 'loss' ? -1 : 0))}>
                      {leg.result}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (kind === 'sharpest') {
    return (
      <LivePulse color={THEME_COLORS.gold} intensity={0.32}>
        {trophy}
      </LivePulse>
    );
  }
  return trophy;
}

function WeeklyAwardsSection({ cards }: { cards: HomeLeagueCard[] }) {
  const cardsWithAwards = cards.filter(
    (card) => card.weeklyAwards.sharpest || card.weeklyAwards.coldStreak || card.weeklyAwards.lock,
  );

  if (cardsWithAwards.length === 0) {
    return null;
  }

  return (
    <View className="gap-3">
      <SectionHeading title="Weekly Awards" caption="Settled weeks" />
      {cardsWithAwards.map((card, index) => (
        <StaggeredItem index={index} key={card.league.id} perItemDelay={70}>
          <Card>
          <View className="gap-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-2">
                <Ionicons color={THEME_COLORS.gold} name="ribbon" size={14} />
                <Text
                  className="text-[10px] font-black uppercase text-gold"
                  style={{ letterSpacing: 2 }}>
                  Trophy Case
                </Text>
              </View>
              <Text
                className="text-sm font-black text-white"
                numberOfLines={1}
                style={{ letterSpacing: -0.3 }}>
                {card.league.name}
              </Text>
            </View>
            <View className="gap-2">
              {card.weeklyAwards.sharpest ? (
                <AwardTrophy award={card.weeklyAwards.sharpest} kind="sharpest" />
              ) : null}
              {card.weeklyAwards.lock ? (
                <AwardTrophy award={card.weeklyAwards.lock} kind="lock" />
              ) : null}
              {card.weeklyAwards.coldStreak ? (
                <AwardTrophy award={card.weeklyAwards.coldStreak} kind="coldStreak" />
              ) : null}
            </View>
          </View>
        </Card>
        </StaggeredItem>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const dashboardQuery = useHomeDashboard(user?.id);
  const cards = dashboardQuery.data?.cards ?? [];

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 22, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={dashboardQuery.isRefetching}
            onRefresh={dashboardQuery.refetch}
          />
        }
        showsVerticalScrollIndicator={false}>
        <Header />

        {dashboardQuery.isLoading ? (
          <LoadingState />
        ) : cards.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ActionNeeded cards={cards} />

            <View className="gap-3">
              <SectionHeading title="This Week" count={cards.length} />
              {cards.map((card, index) => (
                <StaggeredItem index={index} key={card.league.id} perItemDelay={70}>
                  <ThisWeekCard card={card} />
                </StaggeredItem>
              ))}
            </View>

            <WeeklyAwardsSection cards={cards} />

            <View className="gap-3">
              <SectionHeading title="Recent Results" caption="Last week" />
              {cards.map((card, index) => (
                <StaggeredItem index={index} key={card.league.id} perItemDelay={70}>
                  <RecentResultCard card={card} />
                </StaggeredItem>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
