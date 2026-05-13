import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { LockEffect } from '@/components/cosmetics';
import { Badge, Button, Card, ScreenWrapper, SkeletonLoader } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { useShareBetToChat } from '@/hooks/use-league-chat';
import { getOutcomeRewardTone, getRealizedReward, isSettledResult } from '@/lib/bet-outcome';
import { supabase } from '@/lib/supabase';
import {
  formatAmericanOdds,
  formatCurrency,
  formatProfit,
  getProfitTone,
} from '@/lib/format';
import { formatBetLegLabel, formatPickLineValue, formatPickTitle } from '@/lib/pick-labels';
import type { BetWithLegs } from '@/types/database';

function getParamValue(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function marketCopy(market: string) {
  if (market === 'moneyline') return 'Winner';
  if (market === 'spread') return 'Spread';
  return 'Over/Under';
}

function useBetDetail(betId: string | undefined) {
  return useQuery({
    enabled: Boolean(betId),
    queryFn: async (): Promise<BetWithLegs> => {
      if (!betId) {
        throw new Error('Pick is required.');
      }

      const { data, error } = await supabase
        .from('bets')
        .select('*, bet_legs(*)')
        .eq('id', betId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as BetWithLegs;
    },
    queryKey: ['bets', 'detail', betId],
  });
}

export default function BetDetailScreen() {
  const { user } = useAuth();
  const { betId } = useLocalSearchParams();
  const resolvedBetId = getParamValue(betId);
  const betQuery = useBetDetail(resolvedBetId);
  const shareBet = useShareBetToChat(user?.id);
  const cosmeticsQuery = useUserCosmetics(user?.id);

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        {betQuery.isLoading ? (
          <Card>
            <View className="gap-4">
              <SkeletonLoader height={20} width="45%" />
              <SkeletonLoader height={90} />
              <SkeletonLoader height={60} />
            </View>
          </Card>
        ) : null}

        {betQuery.data ? (
          <>
            <LockEffect
              cosmetics={betQuery.data.is_lock ? cosmeticsQuery.data?.equippedByCategory : undefined}>
              <Card tone={betQuery.data.result === 'win' ? 'highlight' : 'default'}>
                <View className="gap-5">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Badge betType={betQuery.data.bet_type} />
                      {betQuery.data.is_lock ? (
                        <View className="flex-row items-center gap-1 rounded-full border border-gold/55 bg-gold/15 px-2.5 py-1">
                          <Ionicons color={THEME_COLORS.gold} name="star" size={11} />
                          <Text
                            className="text-[10px] font-black uppercase text-gold"
                            style={{ letterSpacing: 1.2 }}>
                            Pick of the Week 1.5x
                          </Text>
                        </View>
                      ) : null}
                      <Badge label={betQuery.data.result} tone={betQuery.data.result === 'win' ? 'green' : betQuery.data.result === 'loss' ? 'red' : 'gold'} />
                      <Text className="text-[10px] font-black uppercase text-white/45">
                        {formatAmericanOdds(betQuery.data.odds)}
                      </Text>
                    </View>
                    <Text
                      className="mt-3 text-3xl font-black uppercase text-white"
                      style={{ letterSpacing: -0.7, lineHeight: 34 }}>
                      {formatPickTitle(betQuery.data)}
                    </Text>
                  </View>
                  <Ionicons color={THEME_COLORS.electricGreen} name="receipt" size={24} />
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                    <Text className="text-[10px] font-black uppercase text-white/45">Played</Text>
                    <Text className="mt-1 text-lg font-black text-white">
                      {formatCurrency(betQuery.data.amount)}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                    <Text className="text-[10px] font-black uppercase text-white/45">
                      {isSettledResult(betQuery.data.result) ? 'Outcome' : 'Potential'}
                    </Text>
                    <Text
                      className={`mt-1 text-lg font-black ${
                        isSettledResult(betQuery.data.result)
                          ? getOutcomeRewardTone(betQuery.data.result)
                          : 'text-electric-green'
                      }`}>
                      {formatCurrency(
                        isSettledResult(betQuery.data.result)
                          ? getRealizedReward(betQuery.data)
                          : betQuery.data.potential_payout,
                      )}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                    <Text className="text-[10px] font-black uppercase text-white/45">Profit</Text>
                    <Text className={`mt-1 text-lg font-black ${getProfitTone(betQuery.data.profit ?? 0)}`}>
                      {betQuery.data.profit === null ? '-' : formatProfit(betQuery.data.profit)}
                    </Text>
                  </View>
                </View>

                <Button
                  loading={shareBet.isPending}
                  onPress={async () => {
                    await shareBet.mutateAsync(betQuery.data);
                  }}
                  title="Share to Chat"
                  variant="secondary"
                />
                </View>
              </Card>
            </LockEffect>

            <View className="gap-3">
              {betQuery.data.bet_legs.map((leg, index) => (
                <Card key={leg.id}>
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="text-[10px] font-black uppercase text-white/45"
                        style={{ letterSpacing: 1.5 }}>
                        Leg {index + 1}
                      </Text>
                      <Badge
                        label={leg.result}
                        tone={leg.result === 'win' ? 'green' : leg.result === 'loss' ? 'red' : 'gold'}
                      />
                    </View>
                    <Text className="text-lg font-black text-white">
                      {formatBetLegLabel(leg, {
                        betType: betQuery.data.bet_type,
                        includeTeaserMovement: false,
                      })}
                    </Text>
                    <Text className="text-xs font-semibold uppercase text-white/45">
                      {marketCopy(leg.market)} · {formatAmericanOdds(leg.leg_odds)}
                    </Text>
                    {betQuery.data.bet_type === 'teaser' ? (
                      <Text className="text-sm font-black text-cyan-accent">
                        {formatPickLineValue(leg.original_line, leg.market) || '-'} →{' '}
                        {formatPickLineValue(leg.adjusted_line, leg.market) || '-'}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          </>
        ) : null}

        {!betQuery.isLoading && !betQuery.data ? (
          <Card>
            <View className="items-center gap-3 py-4">
              <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={26} />
              <Text className="text-center text-base font-semibold text-white/55">
                This pick could not be loaded.
              </Text>
              <Button onPress={() => betQuery.refetch()} title="Retry" variant="secondary" />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}
