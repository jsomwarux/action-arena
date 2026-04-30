import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CosmeticAvatar } from '@/components/cosmetics';
import { Badge, Card, StaggeredItem } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useEquippedCosmeticsForUsers } from '@/hooks/use-cosmetics';
import { useShareBetToChat } from '@/hooks/use-league-chat';
import {
  buildProfileSummary,
  filterProfileBets,
  type AchievementDisplay,
  type BetTypeBreakdown,
  type LeagueOption,
  type MemberComparison,
  type ProfileData,
  type ProfileSummary,
  type TeaserPointBreakdown,
} from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import {
  formatAmericanOdds,
  formatCurrency,
  formatProfit,
  formatRecord,
  getProfitTone,
} from '@/lib/format';
import type { BetResult, BetType, BetWithLegs, TeaserPoints } from '@/types/database';

type ProfileContentProps = {
  comparison?: MemberComparison;
  data: ProfileData;
  initialLeagueId?: string | 'all';
  readOnlyLeague?: boolean;
  title: string;
};

type FilterState = {
  betType: BetType | 'all';
  result: BetResult | 'all';
  week: number | 'all';
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const RESULT_TONE: Record<BetResult, { bar: string; label: string; pill: string; pillBg: string; pillBorder: string; text: string }> = {
  loss: {
    bar: 'bg-coral-red/55',
    label: 'Loss',
    pill: 'text-coral-red',
    pillBg: 'bg-coral-red/15',
    pillBorder: 'border-coral-red/40',
    text: 'text-coral-red',
  },
  pending: {
    bar: 'bg-gold/55',
    label: 'Pending',
    pill: 'text-gold',
    pillBg: 'bg-gold/15',
    pillBorder: 'border-gold/40',
    text: 'text-gold',
  },
  push: {
    bar: 'bg-white/15',
    label: 'Push',
    pill: 'text-white/65',
    pillBg: 'bg-white/[0.05]',
    pillBorder: 'border-white/15',
    text: 'text-white/65',
  },
  win: {
    bar: 'bg-electric-green',
    label: 'Win',
    pill: 'text-electric-green',
    pillBg: 'bg-electric-green/15',
    pillBorder: 'border-electric-green/40',
    text: 'text-electric-green',
  },
};

const BET_TYPE_META: Record<
  BetType,
  { accent: string; barClass: string; bgClass: string; borderClass: string; icon: IoniconName; label: string; textClass: string }
> = {
  parlay: {
    accent: THEME_COLORS.amberAccent,
    barClass: 'bg-amber-accent',
    bgClass: 'bg-amber-accent/[0.08]',
    borderClass: 'border-amber-accent/35',
    icon: 'link',
    label: 'Parlays',
    textClass: 'text-amber-accent',
  },
  straight: {
    accent: THEME_COLORS.electricGreen,
    barClass: 'bg-electric-green',
    bgClass: 'bg-white/[0.04]',
    borderClass: 'border-white/[0.08]',
    icon: 'flash',
    label: 'Straights',
    textClass: 'text-electric-green',
  },
  teaser: {
    accent: THEME_COLORS.cyanAccent,
    barClass: 'bg-cyan-accent',
    bgClass: 'bg-cyan-accent/[0.08]',
    borderClass: 'border-cyan-accent/35',
    icon: 'trending-up',
    label: 'Teasers',
    textClass: 'text-cyan-accent',
  },
};

const RESULT_FILTER_OPTIONS: {
  accent?: 'green' | 'red' | 'gold' | 'amber' | 'cyan';
  icon?: IoniconName;
  label: string;
  value: BetResult | 'all';
}[] = [
  { label: 'All', value: 'all' },
  { accent: 'green', icon: 'checkmark', label: 'Wins', value: 'win' },
  { accent: 'red', icon: 'close', label: 'Losses', value: 'loss' as BetResult },
  { accent: 'gold', icon: 'remove', label: 'Pushes', value: 'push' as BetResult },
];

const TYPE_FILTER_OPTIONS: {
  accent?: 'green' | 'red' | 'gold' | 'amber' | 'cyan';
  icon?: IoniconName;
  label: string;
  value: BetType | 'all';
}[] = [
  { label: 'All', value: 'all' },
  { accent: 'green', icon: 'flash', label: 'Straight', value: 'straight' },
  { accent: 'amber', icon: 'link', label: 'Parlay', value: 'parlay' },
  { accent: 'cyan', icon: 'trending-up', label: 'Teaser', value: 'teaser' },
];

const FILTER_ACCENTS = {
  amber: THEME_COLORS.amberAccent,
  cyan: THEME_COLORS.cyanAccent,
  gold: THEME_COLORS.gold,
  green: THEME_COLORS.electricGreen,
  red: THEME_COLORS.coralRed,
};

function TapTarget({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

function SimpleButton({
  loading,
  onPress,
  title,
  variant = 'primary',
}: {
  loading?: boolean;
  onPress: () => void | Promise<void>;
  title: string;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: loading ? 0.55 : pressed ? 0.78 : 1 })}>
      <View
        className={cn(
          'min-h-14 items-center justify-center rounded-2xl border px-5 py-3',
          primary ? 'border-electric-green bg-electric-green' : 'border-white/15 bg-white/5',
        )}>
        {loading ? (
          <ActivityIndicator
            color={primary ? THEME_COLORS.background : THEME_COLORS.textPrimary}
          />
        ) : (
          <Text
            className={cn(
              'text-base font-black uppercase',
              primary ? 'text-arena-bg' : 'text-white',
            )}
            style={{ letterSpacing: 1.5 }}>
            {title}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function StaticSegmentedToggle<V extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: V) => void;
  options: {
    accent?: keyof typeof FILTER_ACCENTS;
    icon?: IoniconName;
    label: string;
    value: V;
  }[];
  value: V;
}) {
  return (
    <View className="flex-row rounded-2xl border border-white/10 bg-white/[0.04] p-1">
      {options.map((option) => {
        const active = option.value === value;
        const color = option.accent ? FILTER_ACCENTS[option.accent] : THEME_COLORS.electricGreen;
        return (
          <TapTarget
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{ flex: 1 }}>
            <View
              className={cn(
                'min-h-10 flex-row items-center justify-center gap-1.5 rounded-xl border px-2',
                active ? 'bg-white/[0.08]' : 'border-transparent bg-transparent',
              )}
              style={{ borderColor: active ? `${color}73` : 'transparent' }}>
              {option.icon ? (
                <Ionicons
                  color={active ? color : 'rgba(255,255,255,0.48)'}
                  name={option.icon}
                  size={12}
                />
              ) : null}
              <Text
                className={cn(
                  'text-[10px] font-black uppercase',
                  active ? 'text-white' : 'text-white/50',
                )}
                numberOfLines={1}
                style={{ color: active ? color : undefined, letterSpacing: 0.8 }}>
                {option.label}
              </Text>
            </View>
          </TapTarget>
        );
      })}
    </View>
  );
}

function betLine(bet: BetWithLegs) {
  const firstLeg = bet.bet_legs[0];

  if (!firstLeg) {
    return 'Selection unavailable';
  }

  if (bet.bet_type !== 'straight') {
    return `${bet.bet_legs.length}-leg ${bet.bet_type}`;
  }

  if (firstLeg.market === 'moneyline') {
    return firstLeg.selection;
  }

  return `${firstLeg.selection} ${firstLeg.adjusted_line ?? firstLeg.original_line ?? ''}`;
}

function legDescriptor(bet: BetWithLegs, index: number) {
  const leg = bet.bet_legs[index];
  if (!leg) return null;

  if (bet.bet_type === 'teaser' && leg.original_line !== null && leg.adjusted_line !== null) {
    return `${leg.selection} ${leg.original_line} → ${leg.adjusted_line}`;
  }
  if (leg.market === 'moneyline') {
    return leg.selection;
  }
  return `${leg.selection} ${leg.adjusted_line ?? leg.original_line ?? ''}`;
}

function marketCopy(market: string) {
  if (market === 'moneyline') return 'Winner';
  if (market === 'spread') return 'Spread';
  return 'Over/Under';
}

function LockPill() {
  return (
    <View
      className="flex-row items-center gap-1 rounded-full border border-gold/55 bg-gold/15 px-2.5 py-1"
      style={{
        shadowColor: THEME_COLORS.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      }}>
      <Ionicons color={THEME_COLORS.gold} name="star" size={11} />
      <Text className="text-[10px] font-black uppercase text-gold" style={{ letterSpacing: 1.2 }}>
        Lock 1.5x
      </Text>
    </View>
  );
}

// ============================================================
// League selector chips
// ============================================================

function LeagueSelector({
  options,
  readOnly,
  selectedLeagueId,
  onSelect,
}: {
  onSelect: (leagueId: string | 'all') => void;
  options: LeagueOption[];
  readOnly?: boolean;
  selectedLeagueId: string | 'all';
}) {
  if (readOnly || options.length <= 1) {
    return null;
  }

  return (
    <View className="gap-2">
      <Text
        className="text-[10px] font-black uppercase text-white/45"
        style={{ letterSpacing: 1.6 }}>
        League Scope
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {[{ id: 'all', label: 'All Leagues' }, ...options].map((option) => {
          const active = option.id === selectedLeagueId;
          return (
            <TapTarget key={option.id} onPress={() => onSelect(option.id)}>
              <View
                className={cn(
                  'rounded-full border px-3 py-2',
                  active
                    ? 'border-electric-green/55 bg-electric-green/15'
                    : 'border-white/10 bg-white/[0.04]',
                )}>
                <Text
                  className={cn(
                    'text-[10px] font-black uppercase',
                    active ? 'text-electric-green' : 'text-white/60',
                  )}
                  style={{ letterSpacing: 1.2 }}>
                  {option.label}
                </Text>
              </View>
            </TapTarget>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================
// Hero stats
// ============================================================

function HeroStats({ summary }: { summary: ProfileSummary }) {
  const { stats } = summary;
  const isStreakWin = stats.currentStreak.includes('W');
  const isStreakLoss = stats.currentStreak.includes('L');
  const profitColor =
    stats.totalProfit > 0
      ? THEME_COLORS.electricGreen
      : stats.totalProfit < 0
        ? THEME_COLORS.coralRed
        : THEME_COLORS.textMuted;

  return (
    <Card tone="highlight">
      <View className="gap-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-electric-green" />
            <Text
              className="text-xs font-black uppercase text-electric-green"
              style={{ letterSpacing: 2.5 }}>
              Season Stats
            </Text>
          </View>
          <View
            className={cn(
              'flex-row items-center gap-1.5 rounded-full border px-3 py-1',
              isStreakWin
                ? 'border-electric-green/45 bg-electric-green/15'
                : isStreakLoss
                  ? 'border-coral-red/35 bg-coral-red/10'
                  : 'border-white/15 bg-white/[0.05]',
            )}>
            <Ionicons
              color={
                isStreakWin
                  ? THEME_COLORS.electricGreen
                  : isStreakLoss
                    ? THEME_COLORS.coralRed
                    : THEME_COLORS.textMuted
              }
              name={isStreakWin ? 'flame' : isStreakLoss ? 'snow' : 'remove'}
              size={12}
            />
            <Text
              className={cn(
                'text-[10px] font-black uppercase',
                isStreakWin
                  ? 'text-electric-green'
                  : isStreakLoss
                    ? 'text-coral-red'
                    : 'text-white/65',
              )}
              style={{ letterSpacing: 1.4 }}>
              {stats.currentStreak}
            </Text>
          </View>
        </View>

          <View>
            <Text
              className="text-xs font-black uppercase text-white/55"
              style={{ letterSpacing: 2 }}>
              Total Profit
            </Text>
            <View className="mt-1 flex-row items-baseline gap-3">
            <Text
              style={{
                color: profitColor,
                fontSize: 56,
                fontWeight: '900',
                letterSpacing: -2.2,
                lineHeight: 56,
              }}>
              {formatProfit(stats.totalProfit)}
            </Text>
            <Text className="text-base font-black text-white/55" style={{ letterSpacing: -0.3 }}>
              total
            </Text>
          </View>
          <Text className="mt-2 text-sm font-semibold text-white/65">
            {formatRecord(stats.wins, stats.losses, stats.ties)} record over{' '}
            {stats.totalSettledBets} settled pick{stats.totalSettledBets === 1 ? '' : 's'}
          </Text>
        </View>

        <View className="flex-row gap-3">
          <StatTile
            accent={stats.winRate >= 55 ? 'text-electric-green' : 'text-white'}
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
          />
          <StatTile
            accent={getProfitTone(stats.averageProfitPerBet)}
            label="Avg / Pick"
            value={formatProfit(stats.averageProfitPerBet)}
          />
          <StatTile
            accent={getProfitTone(stats.roi)}
            label="ROI"
            value={`${stats.roi.toFixed(1)}%`}
          />
        </View>
      </View>
    </Card>
  );
}

function StatTile({
  accent,
  label,
  value,
}: {
  accent?: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3 py-3">
      <Text
        className="text-[11px] font-black uppercase text-white/55"
        style={{ letterSpacing: 1.4 }}>
        {label}
      </Text>
      <Text
        className={cn('mt-1.5 text-xl font-black text-white', accent)}
        numberOfLines={1}
        style={{ letterSpacing: -0.4 }}>
        {value}
      </Text>
    </View>
  );
}

// ============================================================
// Best / Worst
// ============================================================

function BestBetCard({ bet }: { bet: BetWithLegs }) {
  const meta = BET_TYPE_META[bet.bet_type];
  const isMultiLeg = bet.bet_type !== 'straight';
  const profit = bet.profit ?? 0;

  return (
    <View>
      <View
        className="overflow-hidden rounded-2xl border border-gold/40 bg-gold/[0.08]"
        style={{
          shadowColor: THEME_COLORS.gold,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
        }}>
        <View className="h-[3px] w-full bg-gold" />
        <View className="gap-4 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-xl border border-gold/55 bg-gold/15">
                <Ionicons color={THEME_COLORS.gold} name="trophy" size={16} />
              </View>
              <View>
                <Text
                  className="text-[10px] font-black uppercase text-gold"
                  style={{ letterSpacing: 2 }}>
                  Best Pick
                </Text>
                <Text
                  className="text-base font-black uppercase text-white"
                  style={{ letterSpacing: -0.3 }}
                  numberOfLines={1}>
                  {betLine(bet)}
                </Text>
              </View>
            </View>
            <View className="items-end gap-1">
              <Badge betType={bet.bet_type} />
              {bet.is_lock ? <LockPill /> : null}
            </View>
          </View>

          <View className="flex-row items-end justify-between">
            <View>
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Profit
              </Text>
              <Text
                className="text-3xl font-black text-electric-green"
                style={{ letterSpacing: -0.8 }}>
                {formatProfit(profit)}
              </Text>
            </View>
            <View className="items-end gap-0.5">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.5 }}>
                Played · Value
              </Text>
              <Text className="text-sm font-black text-white">
                {formatCurrency(bet.amount)} · {formatAmericanOdds(bet.odds)}
              </Text>
              <Text className="text-[11px] font-semibold text-white/55">
                Reward {formatCurrency(bet.potential_payout)}
              </Text>
            </View>
          </View>

          {isMultiLeg ? (
            <View className="gap-2">
              <Text
                className="text-[10px] font-black uppercase text-gold"
                style={{ letterSpacing: 1.4 }}>
                {bet.bet_legs.length}-leg chain · all hit
              </Text>
              <View className="flex-row gap-2">
                <View className="items-center pt-1">
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.accent }}
                  />
                  <View className="mt-0.5 w-[2px] flex-1 rounded-full bg-gold/40" />
                </View>
                <View className="flex-1 gap-2">
                  {bet.bet_legs.map((leg, index) => (
                    <View
                      key={leg.id}
                      className="flex-row items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2.5">
                      <View className="flex-1 flex-row items-center gap-2">
                        <View
                          className="h-6 w-6 items-center justify-center rounded-full border border-gold/45 bg-gold/15">
                          <Text className="text-[10px] font-black text-gold">{index + 1}</Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-xs font-black text-white"
                            numberOfLines={1}
                            style={{ letterSpacing: -0.2 }}>
                            {legDescriptor(bet, index)}
                          </Text>
                          <Text className="mt-0.5 text-[10px] font-semibold uppercase text-white/45">
                            {marketCopy(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
                          </Text>
                        </View>
                      </View>
                      <Ionicons color={THEME_COLORS.electricGreen} name="checkmark-circle" size={14} />
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function WorstBetCard({ bet }: { bet: BetWithLegs }) {
  return (
    <View>
      <View className="rounded-2xl border border-coral-red/20 bg-white/[0.03] p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-xl border border-coral-red/35 bg-coral-red/[0.08]">
              <Ionicons color={THEME_COLORS.coralRed} name="trending-down" size={14} />
            </View>
            <View className="flex-1">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.6 }}>
                Toughest Pick
              </Text>
              <Text
                className="text-sm font-black text-white"
                numberOfLines={1}
                style={{ letterSpacing: -0.2 }}>
                {betLine(bet)}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Badge betType={bet.bet_type} />
            {bet.is_lock ? <LockPill /> : null}
            <Text className="mt-1 text-base font-black text-coral-red">
              {formatProfit(bet.profit ?? 0)}
            </Text>
          </View>
        </View>
        <Text className="mt-2 text-[11px] font-semibold text-white/45">
          Week {bet.week_number} · {formatCurrency(bet.amount)} played · {formatAmericanOdds(bet.odds)}
        </Text>
      </View>
    </View>
  );
}

function BestWorst({ summary }: { summary: ProfileSummary }) {
  if (!summary.bestBet && !summary.worstBet) {
    return (
      <View className="gap-3">
        <SectionLabel title="Highlights" />
        <Card>
          <View className="items-center gap-3 py-4">
            <View className="h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <Ionicons color="rgba(255,255,255,0.4)" name="medal-outline" size={26} />
            </View>
            <Text className="px-2 text-center text-base font-semibold leading-snug text-white/65">
              Best & toughest picks show up once you settle a few cards.
            </Text>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <SectionLabel title="Highlights" />
      {summary.bestBet ? <BestBetCard bet={summary.bestBet} /> : null}
      {summary.worstBet && summary.worstBet.id !== summary.bestBet?.id ? (
        <WorstBetCard bet={summary.worstBet} />
      ) : null}
    </View>
  );
}

// ============================================================
// Pick type breakdown (parlay amber, teaser cyan, straight green)
// ============================================================

function BreakdownRow({ breakdown }: { breakdown: BetTypeBreakdown }) {
  const meta = BET_TYPE_META[breakdown.type];
  const winPercent = Math.max(0, Math.min(breakdown.winRate, 100));

  return (
    <View className={cn('rounded-2xl border p-4', meta.borderClass, meta.bgClass)}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <View
            className="h-9 w-9 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `${meta.accent}1f`,
              borderColor: `${meta.accent}55`,
            }}>
            <Ionicons color={meta.accent} name={meta.icon} size={16} />
          </View>
          <View>
            <Text
              className={cn('text-xs font-black uppercase', meta.textClass)}
              style={{ letterSpacing: 2 }}>
              {meta.label}
            </Text>
            <Text className="text-base font-black text-white" style={{ letterSpacing: -0.2 }}>
              {breakdown.record} · {breakdown.total} placed
            </Text>
          </View>
        </View>
        <Text
          className={cn('text-base font-black', getProfitTone(breakdown.profit))}
          style={{ letterSpacing: -0.3 }}>
          {formatProfit(breakdown.profit)}
        </Text>
      </View>

      <View className="mt-3">
        <View className="h-2 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
          <View
            className={cn('h-full', meta.barClass)}
            style={{ width: `${winPercent}%`, opacity: 0.85 }}
          />
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text
            className="text-[10px] font-black uppercase text-white/45"
            style={{ letterSpacing: 1.4 }}>
            Win Rate
          </Text>
          <Text
            className={cn('text-[11px] font-black uppercase', meta.textClass)}
            style={{ letterSpacing: 1.2 }}>
            {breakdown.winRate.toFixed(1)}%
            {breakdown.type !== 'straight' && breakdown.averageLegs > 0
              ? ` · ${breakdown.averageLegs.toFixed(1)} avg legs`
              : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TeaserSpread({ teasers }: { teasers: TeaserPointBreakdown[] }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Ionicons color={THEME_COLORS.cyanAccent} name="trending-up" size={12} />
        <Text
          className="text-[10px] font-black uppercase text-cyan-accent"
          style={{ letterSpacing: 2 }}>
          Teaser Sizes
        </Text>
      </View>
      <View className="flex-row gap-2">
        {teasers.map((teaser) => {
          const hasBets = teaser.total > 0;
          return (
            <View
              key={teaser.points}
              className={cn(
                'flex-1 rounded-2xl border p-3',
                hasBets
                  ? 'border-cyan-accent/35 bg-cyan-accent/[0.08]'
                  : 'border-white/[0.07] bg-white/[0.03]',
              )}>
              <Text
                className={cn(
                  'text-[10px] font-black uppercase',
                  hasBets ? 'text-cyan-accent' : 'text-white/45',
                )}
                style={{ letterSpacing: 1.5 }}>
                {teaser.points} pts
              </Text>
              <Text className="mt-1 text-base font-black text-white">{teaser.record}</Text>
              <Text className="mt-1 text-[10px] font-semibold text-white/45">
                {teaser.total} placed
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Breakdown({
  breakdowns,
  teasers,
}: {
  breakdowns: BetTypeBreakdown[];
  teasers: TeaserPointBreakdown[];
}) {
  return (
    <View className="gap-3">
      <SectionLabel title="Pick Type Breakdown" />
      <View className="gap-2">
        {breakdowns.map((breakdown) => (
          <BreakdownRow breakdown={breakdown} key={breakdown.type} />
        ))}
      </View>
      <TeaserSpread teasers={teasers} />
    </View>
  );
}

// ============================================================
// Achievements
// ============================================================

const ACHIEVEMENT_ICONS: Record<string, IoniconName> = {
  budget_master: 'wallet',
  hot_streak: 'flame',
  parlay_king: 'link',
  perfect_week: 'sparkles',
  teaser_genius: 'trending-up',
  underdog_hunter: 'skull',
};

function AchievementBadge({ achievement, index }: { achievement: AchievementDisplay; index: number }) {
  const icon = ACHIEVEMENT_ICONS[achievement.key] ?? 'trophy';

  const inner = (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-2xl border p-3',
        achievement.earned
          ? 'border-gold/45 bg-gold/[0.10]'
          : 'border-white/[0.07] bg-white/[0.03]',
      )}>
      <View
        className={cn(
          'h-12 w-12 items-center justify-center rounded-2xl border',
          achievement.earned
            ? 'border-gold/55 bg-gold/15'
            : 'border-white/10 bg-white/[0.04]',
        )}
        style={
          achievement.earned
            ? {
                shadowColor: THEME_COLORS.gold,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 10,
              }
            : undefined
        }>
        <Ionicons
          color={achievement.earned ? THEME_COLORS.gold : 'rgba(255,255,255,0.32)'}
          name={achievement.earned ? icon : 'lock-closed'}
          size={20}
        />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className={cn(
              'text-sm font-black uppercase',
              achievement.earned ? 'text-gold' : 'text-white/55',
            )}
            style={{ letterSpacing: 0.6 }}>
            {achievement.title}
          </Text>
          {achievement.earned ? (
            <Ionicons color={THEME_COLORS.gold} name="checkmark-circle" size={14} />
          ) : null}
        </View>
        <Text
          className={cn(
            'mt-1 text-xs font-semibold',
            achievement.earned ? 'text-white/65' : 'text-white/40',
          )}>
          {achievement.description}
        </Text>
      </View>
      {achievement.earned ? null : (
        <View className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
          <Text
            className="text-[9px] font-black uppercase text-white/45"
            style={{ letterSpacing: 1.3 }}>
            Locked
          </Text>
        </View>
      )}
    </View>
  );

  return <View>{inner}</View>;
}

function Achievements({ achievements }: { achievements: AchievementDisplay[] }) {
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <View className="gap-3">
      <View className="flex-row items-end justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-1 w-6 rounded-full bg-gold" />
          <Text
            className="text-[10px] font-black uppercase text-gold"
            style={{ letterSpacing: 2.2 }}>
            Achievements
          </Text>
        </View>
        <Text className="text-[10px] font-semibold text-white/45">
          {earnedCount}/{achievements.length} unlocked
        </Text>
      </View>
      <View className="gap-2">
        {achievements.map((achievement, index) => (
          <AchievementBadge achievement={achievement} index={index} key={achievement.key} />
        ))}
      </View>
    </View>
  );
}

// ============================================================
// Pick history
// ============================================================

function BetHistoryCard({ bet }: { bet: BetWithLegs }) {
  const { user } = useAuth();
  const shareBet = useShareBetToChat(user?.id);
  const meta = BET_TYPE_META[bet.bet_type];
  const tone = RESULT_TONE[bet.result];
  const profit = bet.profit ?? 0;
  const isMultiLeg = bet.bet_type !== 'straight';
  const isLock = bet.is_lock;

  return (
    <View
      className={cn(
        'overflow-hidden rounded-2xl border',
        isLock ? 'bg-gold/[0.06]' : 'bg-white/[0.04]',
      )}
      style={{
        borderColor: isLock ? THEME_COLORS.gold : `${meta.accent}26`,
        borderWidth: isLock ? 1.5 : 1,
        shadowColor: isLock ? THEME_COLORS.gold : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isLock ? 0.25 : 0,
        shadowRadius: isLock ? 10 : 0,
      }}>
      <View className={cn('h-[3px] w-full', isLock ? 'bg-gold' : tone.bar)} />
      <View className="gap-3 p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <Badge betType={bet.bet_type} />
              {isLock ? <LockPill /> : null}
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 1.4 }}>
                Week {bet.week_number}
              </Text>
            </View>
            <Text
              className="text-base font-black text-white"
              numberOfLines={2}
              style={{ letterSpacing: -0.3 }}>
              {betLine(bet)}
            </Text>
          </View>
          <View className="items-end gap-1">
            <View
              className={cn(
                'flex-row items-center gap-1 rounded-full border px-2.5 py-1',
                tone.pillBg,
                tone.pillBorder,
              )}>
              {bet.result === 'win' ? (
                <Ionicons color={THEME_COLORS.electricGreen} name="checkmark" size={11} />
              ) : bet.result === 'loss' ? (
                <Ionicons color={THEME_COLORS.coralRed} name="close" size={11} />
              ) : bet.result === 'push' ? (
                <Ionicons color={THEME_COLORS.textMuted} name="remove" size={11} />
              ) : (
                <View className="h-1.5 w-1.5 rounded-full bg-gold" />
              )}
              <Text
                className={cn('text-[10px] font-black uppercase', tone.pill)}
                style={{ letterSpacing: 1.4 }}>
                {tone.label}
              </Text>
            </View>
            <Text
              className={cn('text-lg font-black', getProfitTone(profit))}
              style={{ letterSpacing: -0.4 }}>
              {bet.profit === null ? '–' : formatProfit(profit)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between rounded-xl bg-arena-bg/40 px-3 py-2">
          <Text
            className="text-[11px] font-black uppercase text-white/55"
            style={{ letterSpacing: 1.2 }}>
            {formatAmericanOdds(bet.odds)}
          </Text>
          <Text
            className="text-[11px] font-black uppercase text-white/55"
            style={{ letterSpacing: 1.2 }}>
            {formatCurrency(bet.amount)} played
          </Text>
          <Text
            className="text-[11px] font-black uppercase text-white/55"
            style={{ letterSpacing: 1.2 }}>
            Reward {formatCurrency(bet.potential_payout)}
          </Text>
        </View>

        {isMultiLeg ? (
          <View className="gap-1.5">
            {bet.bet_legs.map((leg, index) => {
              const legTone = RESULT_TONE[leg.result];
              return (
                <View
                  key={leg.id}
                  className="flex-row items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                  <View className="flex-1 flex-row items-center gap-2">
                    <View
                      className="h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${meta.accent}26` }}>
                      <Text
                        className="text-[10px] font-black"
                        style={{ color: meta.accent, letterSpacing: -0.2 }}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text
                      className="flex-1 text-xs font-semibold text-white/75"
                      numberOfLines={1}>
                      {legDescriptor(bet, index)}
                    </Text>
                  </View>
                  <Text
                    className={cn('text-[10px] font-black uppercase', legTone.text)}
                    style={{ letterSpacing: 1.2 }}>
                    {legTone.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <SimpleButton
          loading={shareBet.isPending}
          onPress={async () => {
            try {
              await shareBet.mutateAsync(bet);
              Alert.alert('Shared to chat', 'This pick is now in league chat.');
            } catch (error) {
              Alert.alert(
                'Could not share pick',
                error instanceof Error ? error.message : 'Try again.',
              );
            }
          }}
          title="Share to Chat"
          variant="secondary"
        />
      </View>
    </View>
  );
}

function WeekFilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TapTarget onPress={onPress}>
      <View
        className={cn(
          'rounded-full border px-3 py-1.5',
          active
            ? 'border-electric-green/55 bg-electric-green/15'
            : 'border-white/10 bg-white/[0.04]',
        )}>
        <Text
          className={cn(
            'text-[10px] font-black uppercase',
            active ? 'text-electric-green' : 'text-white/55',
          )}
          style={{ letterSpacing: 1.2 }}>
          {label}
        </Text>
      </View>
    </TapTarget>
  );
}

function BetHistory({
  bets,
  leagueId,
}: {
  bets: BetWithLegs[];
  leagueId: string | 'all';
}) {
  const [filters, setFilters] = useState<FilterState>({ betType: 'all', result: 'all', week: 'all' });
  const [visibleCount, setVisibleCount] = useState(12);
  const weeks = useMemo(
    () => [...new Set(bets.map((bet) => bet.week_number))].sort((left, right) => right - left),
    [bets],
  );
  const filtered = filterProfileBets({ ...filters, bets, leagueId }).sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
  const visible = filtered.slice(0, visibleCount);

  return (
    <View className="gap-3">
      <View className="flex-row items-end justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-1 w-6 rounded-full bg-electric-green" />
          <Text
            className="text-[10px] font-black uppercase text-electric-green"
            style={{ letterSpacing: 2.2 }}>
            Pick History
          </Text>
        </View>
        <Text className="text-[10px] font-semibold text-white/45">
          {filtered.length} {filtered.length === 1 ? 'pick' : 'picks'}
        </Text>
      </View>

      <View className="gap-2">
        <StaticSegmentedToggle
          onChange={(result) => setFilters((current) => ({ ...current, result }))}
          options={RESULT_FILTER_OPTIONS}
          value={filters.result}
        />
        <StaticSegmentedToggle
          onChange={(betType) => setFilters((current) => ({ ...current, betType }))}
          options={TYPE_FILTER_OPTIONS}
          value={filters.betType}
        />
        {weeks.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            <WeekFilterChip
              active={filters.week === 'all'}
              label="All Weeks"
              onPress={() => setFilters((current) => ({ ...current, week: 'all' }))}
            />
            {weeks.slice(0, 8).map((week) => (
              <WeekFilterChip
                active={filters.week === week}
                key={week}
                label={`W${week}`}
                onPress={() => setFilters((current) => ({ ...current, week }))}
              />
            ))}
          </View>
        ) : null}
      </View>

      {visible.length === 0 ? (
        <Card>
          <View className="items-center gap-2 py-3">
            <Ionicons color="rgba(255,255,255,0.45)" name="filter" size={22} />
            <Text className="text-sm font-semibold text-white/55">
              No picks match these filters.
            </Text>
          </View>
        </Card>
      ) : (
        <View className="gap-2">
          {visible.map((bet, index) => (
            <StaggeredItem index={index} key={bet.id} perItemDelay={45}>
              <BetHistoryCard bet={bet} />
            </StaggeredItem>
          ))}
        </View>
      )}

      {visible.length < filtered.length ? (
        <SimpleButton
          onPress={() => setVisibleCount((count) => count + 12)}
          title="Load More"
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

// ============================================================
// Comparison (You vs Member)
// ============================================================

type CompareKey = 'totalProfit' | 'roi' | 'winRate' | 'totalSettledBets';

const COMPARE_ROWS: { format: (value: number) => string; higherIsBetter: boolean; key: CompareKey; label: string }[] = [
  {
    format: (value) => formatProfit(value),
    higherIsBetter: true,
    key: 'totalProfit',
    label: 'Total Profit',
  },
  {
    format: (value) => `${value.toFixed(1)}%`,
    higherIsBetter: true,
    key: 'roi',
    label: 'ROI',
  },
  {
    format: (value) => `${value.toFixed(1)}%`,
    higherIsBetter: true,
    key: 'winRate',
    label: 'Win Rate',
  },
  {
    format: (value) => `${value}`,
    higherIsBetter: true,
    key: 'totalSettledBets',
    label: 'Settled Picks',
  },
];

function CompareRow({
  format,
  label,
  targetValue,
  viewerValue,
}: {
  format: (value: number) => string;
  label: string;
  targetValue: number;
  viewerValue: number;
}) {
  const viewerWins = viewerValue > targetValue;
  const targetWins = targetValue > viewerValue;
  const tied = !viewerWins && !targetWins;

  return (
    <View className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
      <Text
        className="text-center text-[10px] font-black uppercase text-white/45"
        style={{ letterSpacing: 1.6 }}>
        {label}
      </Text>
      <View className="mt-2 flex-row items-center gap-3">
        <View
          className={cn(
            'flex-1 items-center rounded-2xl border p-3',
            viewerWins
              ? 'border-electric-green/45 bg-electric-green/10'
              : 'border-white/[0.05] bg-white/[0.03]',
          )}
          style={
            viewerWins
              ? {
                  shadowColor: THEME_COLORS.electricGreen,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                }
              : undefined
          }>
          <Text
            className={cn(
              'text-[10px] font-black uppercase',
              viewerWins ? 'text-electric-green' : 'text-white/45',
            )}
            style={{ letterSpacing: 1.4 }}>
            You
          </Text>
          <Text
            className={cn(
              'mt-1 text-lg font-black',
              viewerWins ? 'text-electric-green' : 'text-white',
            )}
            style={{ letterSpacing: -0.4 }}
            numberOfLines={1}>
            {format(viewerValue)}
          </Text>
        </View>

        <View
          className={cn(
            'h-9 w-9 items-center justify-center rounded-full border',
            tied
              ? 'border-white/15 bg-white/[0.04]'
              : 'border-gold/45 bg-gold/15',
          )}>
          <Text
            className={cn('text-[10px] font-black', tied ? 'text-white/55' : 'text-gold')}
            style={{ letterSpacing: 0.5 }}>
            VS
          </Text>
        </View>

        <View
          className={cn(
            'flex-1 items-center rounded-2xl border p-3',
            targetWins
              ? 'border-gold/45 bg-gold/10'
              : 'border-white/[0.05] bg-white/[0.03]',
          )}
          style={
            targetWins
              ? {
                  shadowColor: THEME_COLORS.gold,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.32,
                  shadowRadius: 10,
                }
              : undefined
          }>
          <Text
            className={cn(
              'text-[10px] font-black uppercase',
              targetWins ? 'text-gold' : 'text-white/45',
            )}
            style={{ letterSpacing: 1.4 }}>
            Them
          </Text>
          <Text
            className={cn(
              'mt-1 text-lg font-black',
              targetWins ? 'text-gold' : 'text-white',
            )}
            style={{ letterSpacing: -0.4 }}
            numberOfLines={1}>
            {format(targetValue)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Comparison({ comparison }: { comparison: MemberComparison }) {
  const h2hLabel =
    comparison.h2hWins > comparison.h2hLosses
      ? `You lead ${comparison.h2hWins}-${comparison.h2hLosses}${
          comparison.h2hTies > 0 ? `-${comparison.h2hTies}` : ''
        }`
      : comparison.h2hWins < comparison.h2hLosses
        ? `They lead ${comparison.h2hLosses}-${comparison.h2hWins}${
            comparison.h2hTies > 0 ? `-${comparison.h2hTies}` : ''
          }`
        : `Tied ${comparison.h2hWins}-${comparison.h2hLosses}`;

  return (
    <Card tone="highlight">
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Ionicons color={THEME_COLORS.electricGreen} name="git-compare" size={14} />
            <Text
              className="text-[10px] font-black uppercase text-electric-green"
              style={{ letterSpacing: 2.5 }}>
              Head to Head
            </Text>
          </View>
          <View className="rounded-full border border-gold/40 bg-gold/15 px-3 py-1">
            <Text
              className="text-[10px] font-black uppercase text-gold"
              style={{ letterSpacing: 1.4 }}>
              {h2hLabel}
            </Text>
          </View>
        </View>

        <View className="gap-2">
          {COMPARE_ROWS.map((row) => (
            <CompareRow
              format={row.format}
              key={row.key}
              label={row.label}
              targetValue={comparison.targetStats[row.key] ?? 0}
              viewerValue={comparison.viewerStats[row.key] ?? 0}
            />
          ))}
        </View>
      </View>
    </Card>
  );
}

// ============================================================
// Section label helper
// ============================================================

function SectionLabel({ caption, title }: { caption?: string; title: string }) {
  return (
    <View className="flex-row items-end justify-between">
      <View className="flex-row items-center gap-2">
        <View className="h-1 w-6 rounded-full bg-electric-green" />
        <Text
          className="text-xs font-black uppercase text-electric-green"
          style={{ letterSpacing: 2.2 }}>
          {title}
        </Text>
      </View>
      {caption ? (
        <Text className="text-xs font-semibold text-white/55">{caption}</Text>
      ) : null}
    </View>
  );
}

// ============================================================
// Default export
// ============================================================

export function ProfileContent({
  comparison,
  data,
  initialLeagueId = 'all',
  readOnlyLeague = false,
  title,
}: ProfileContentProps) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | 'all'>(initialLeagueId);
  const cosmeticsQuery = useEquippedCosmeticsForUsers([data.profile.id]);
  const resolvedLeagueId =
    readOnlyLeague && data.leagueOptions[0] ? data.leagueOptions[0].id : selectedLeagueId;
  const summary = useMemo(
    () => buildProfileSummary(data, resolvedLeagueId),
    [data, resolvedLeagueId],
  );

  return (
    <View className="gap-4">
      <View className="gap-3">
        <View className="flex-row items-center gap-4">
          <CosmeticAvatar
            cosmetics={cosmeticsQuery.data?.[data.profile.id]}
            name={data.profile.display_name}
            size="lg"
          />
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
              <Text
                className="text-xs font-semibold uppercase text-electric-green"
                style={{ letterSpacing: 1.2 }}>
                Player Card
              </Text>
            </View>
            <Text
              className="mt-1 text-3xl font-extrabold text-white"
              style={{ letterSpacing: -0.5 }}>
              {title}
            </Text>
            <Text className="mt-1.5 text-base font-medium text-white/60">
              {data.profile.display_name}
            </Text>
          </View>
        </View>
        <LeagueSelector
          onSelect={setSelectedLeagueId}
          options={data.leagueOptions}
          readOnly={readOnlyLeague}
          selectedLeagueId={resolvedLeagueId}
        />
      </View>

      <HeroStats summary={summary} />
      {comparison ? <Comparison comparison={comparison} /> : null}
      <BestWorst summary={summary} />
      <Breakdown breakdowns={summary.betTypeBreakdowns} teasers={summary.teaserBreakdowns} />
      <Achievements achievements={summary.achievements} />
      <BetHistory bets={summary.bets} leagueId={resolvedLeagueId} />
    </View>
  );
}
