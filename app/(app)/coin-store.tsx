import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  AnimatedNumber,
  Card,
  PressableScale,
  ScreenWrapper,
  SkeletonLoader,
} from '@/components/ui';
import { COIN_PACKS, type CoinPack } from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { logAnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

type Tier = 'pouch' | 'chest' | 'vault';

const TIER_BY_PACK: Record<string, Tier> = {
  coins_500: 'pouch',
  coins_1200: 'chest',
  coins_2800: 'vault',
};

const TIER_META: Record<
  Tier,
  {
    accent: string;
    bonus: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    iconSize: number;
    plateSize: number;
    subtitle: string;
    tagline: string;
  }
> = {
  pouch: {
    accent: THEME_COLORS.amberAccent,
    bonus: 'Starter stack',
    icon: 'wallet',
    iconSize: 30,
    plateSize: 80,
    subtitle: 'A small pouch of Arena Coins to dabble in cosmetics.',
    tagline: 'Day-one drip',
  },
  chest: {
    accent: THEME_COLORS.cyanAccent,
    bonus: '+20% coins',
    icon: 'cube',
    iconSize: 38,
    plateSize: 100,
    subtitle: 'A full chest with bonus coins for serious customizers.',
    tagline: 'Most popular',
  },
  vault: {
    accent: THEME_COLORS.gold,
    bonus: '+40% coins · best value',
    icon: 'business',
    iconSize: 48,
    plateSize: 124,
    subtitle: 'An overflowing commissioner vault for full-loadout players.',
    tagline: 'Best value',
  },
};

function ToastNotice({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onDismiss, 2300);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <View className="absolute bottom-8 left-5 right-5 z-20">
      <Pressable onPress={onDismiss}>
        <View className="rounded-2xl border border-electric-green/45 bg-arena-surface px-4 py-3">
          <Text className="text-center text-sm font-bold text-electric-green">{message}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function CoinIconCluster({ accent, plateSize }: { accent: string; plateSize: number }) {
  // Stacked-coin illusion built with three offset circles.
  return (
    <View
      className="items-center justify-center"
      style={{ height: plateSize, width: plateSize }}>
      <View
        style={{
          backgroundColor: `${accent}1f`,
          borderColor: `${accent}55`,
          borderRadius: plateSize / 2,
          borderWidth: 1,
          height: plateSize,
          position: 'absolute',
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 18,
          width: plateSize,
        }}
      />
      <View
        style={{
          backgroundColor: `${accent}33`,
          borderColor: `${accent}99`,
          borderRadius: 999,
          borderWidth: 1,
          bottom: plateSize * 0.18,
          height: plateSize * 0.32,
          left: plateSize * 0.18,
          position: 'absolute',
          width: plateSize * 0.32,
        }}
      />
      <View
        style={{
          backgroundColor: `${accent}33`,
          borderColor: `${accent}99`,
          borderRadius: 999,
          borderWidth: 1,
          bottom: plateSize * 0.18,
          height: plateSize * 0.32,
          position: 'absolute',
          right: plateSize * 0.18,
          width: plateSize * 0.32,
        }}
      />
      <View
        style={{
          alignItems: 'center',
          backgroundColor: `${accent}40`,
          borderColor: accent,
          borderRadius: 999,
          borderWidth: 2,
          height: plateSize * 0.45,
          justifyContent: 'center',
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
          top: plateSize * 0.08,
          width: plateSize * 0.45,
        }}>
        <Text style={{ color: accent, fontSize: plateSize * 0.14, fontWeight: '900' }}>AA</Text>
      </View>
    </View>
  );
}

function PackHero({ accent, icon, plateSize }: { accent: string; icon: React.ComponentProps<typeof Ionicons>['name']; plateSize: number }) {
  return (
    <View className="items-center justify-center" style={{ height: plateSize, width: plateSize + 16 }}>
      <CoinIconCluster accent={accent} plateSize={plateSize} />
      <View
        className="absolute -top-1 right-0 items-center justify-center rounded-2xl border"
        style={{
          backgroundColor: `${accent}33`,
          borderColor: accent,
          height: plateSize * 0.32,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
          width: plateSize * 0.32,
        }}>
        <Ionicons color={accent} name={icon} size={plateSize * 0.16} />
      </View>
    </View>
  );
}

function PackCard({
  isFeatured,
  pack,
  tier,
  onPress,
}: {
  isFeatured: boolean;
  pack: CoinPack;
  tier: Tier;
  onPress: () => void;
}) {
  const meta = TIER_META[tier];
  return (
    <PressableScale onPress={onPress} pressedScale={0.99}>
      <View
        className="overflow-hidden rounded-2xl border bg-white/[0.04]"
        style={{
          borderColor: isFeatured ? meta.accent : `${meta.accent}55`,
          borderWidth: isFeatured ? 2 : 1,
          shadowColor: meta.accent,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isFeatured ? 0.55 : 0.3,
          shadowRadius: isFeatured ? 22 : 14,
        }}>
        {isFeatured ? (
          <View
            className="flex-row items-center justify-center gap-1.5 border-b px-3 py-1.5"
            style={{
              backgroundColor: `${meta.accent}26`,
              borderColor: `${meta.accent}66`,
            }}>
            <Ionicons color={meta.accent} name="star" size={11} />
            <Text
              className="text-[10px] font-black uppercase"
              style={{ color: meta.accent, letterSpacing: 1.6 }}>
              {meta.tagline}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center gap-3 p-4">
          <PackHero accent={meta.accent} icon={meta.icon} plateSize={meta.plateSize} />
          <View className="flex-1 gap-1.5">
            <Text
              className="text-[11px] font-semibold uppercase"
              style={{ color: meta.accent, letterSpacing: 1 }}>
              {pack.label}
            </Text>
            <View className="flex-row items-baseline gap-1.5">
              <Text
                className="text-3xl font-extrabold text-white"
                style={{ letterSpacing: -0.6 }}>
                {pack.coins.toLocaleString()}
              </Text>
              <Text
                className="text-xs font-bold"
                style={{ color: `${meta.accent}cc`, letterSpacing: 0.3 }}>
                coins
              </Text>
            </View>
            <Text className="text-xs font-medium leading-4 text-white/55" numberOfLines={2}>
              {meta.subtitle}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              <View
                className="rounded-full border px-2.5 py-0.5"
                style={{
                  backgroundColor: `${meta.accent}22`,
                  borderColor: `${meta.accent}66`,
                }}>
                <Text
                  className="text-[10px] font-bold"
                  style={{ color: meta.accent, letterSpacing: 0.4 }}>
                  {meta.bonus}
                </Text>
              </View>
            </View>
          </View>
          <View className="items-end gap-2">
            <View
              className="rounded-2xl border px-3 py-2"
              style={{
                backgroundColor: `${meta.accent}26`,
                borderColor: meta.accent,
                shadowColor: meta.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.45,
                shadowRadius: 8,
              }}>
              <Text className={cn('font-extrabold text-white', isFeatured ? 'text-lg' : 'text-base')}>
                {pack.priceLabel}
              </Text>
            </View>
            <Text
              className="text-[10px] font-semibold uppercase"
              style={{ color: meta.accent, letterSpacing: 1 }}>
              Tap to buy
            </Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export default function CoinStoreScreen() {
  const { user } = useAuth();
  const cosmeticsQuery = useUserCosmetics(user?.id);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    logAnalyticsEvent('coin_store_viewed', { user_id: user?.id });
  }, [user?.id]);

  const showComingSoon = (packId: string) => {
    haptics.medium();
    logAnalyticsEvent('coin_store_viewed', { pack_id: packId, user_id: user?.id });
    setToast('Apple IAP coming soon — your pack will land here.');
  };

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}>
        <View>
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-gold" />
            <Text
              className="text-[11px] font-semibold uppercase text-gold"
              style={{ letterSpacing: 1.2 }}>
              Arena Coins
            </Text>
          </View>
          <Text
            className="mt-1 text-2xl font-extrabold text-white"
            style={{ letterSpacing: -0.4 }}>
            Coin Store
          </Text>
          <Text className="mt-1 text-sm font-medium text-white/55">
            Stock up on coins to unlock cosmetics in the Arena Locker.
          </Text>
        </View>

        <Card tone="highlight">
          <View className="flex-row items-center justify-between">
            <View>
              <Text
                className="text-[10px] font-semibold uppercase text-electric-green"
                style={{ letterSpacing: 1.2 }}>
                Current Balance
              </Text>
              {cosmeticsQuery.isLoading ? (
                <View className="mt-2">
                  <SkeletonLoader height={36} width={120} />
                </View>
              ) : (
                <AnimatedNumber
                  className="mt-1 text-4xl font-extrabold text-white"
                  style={{ letterSpacing: -0.6 }}
                  value={cosmeticsQuery.data?.coinBalance ?? 0}
                />
              )}
            </View>
            <View
              className="h-16 w-16 items-center justify-center rounded-3xl border border-gold/65 bg-gold/15"
              style={{
                shadowColor: THEME_COLORS.gold,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.55,
                shadowRadius: 14,
              }}>
              <Text className="text-xl font-black text-gold">AA</Text>
            </View>
          </View>
        </Card>

        <View className="gap-3">
          {COIN_PACKS.map((pack) => {
            const tier = TIER_BY_PACK[pack.id] ?? 'pouch';
            const isFeatured = tier === 'vault';
            return (
              <PackCard
                isFeatured={isFeatured}
                key={pack.id}
                onPress={() => showComingSoon(pack.id)}
                pack={pack}
                tier={tier}
              />
            );
          })}
        </View>

        <View className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <View className="flex-row items-center gap-2">
            <Ionicons color="rgba(255,255,255,0.55)" name="shield-checkmark" size={14} />
            <Text
              className="text-[11px] font-semibold uppercase text-white/55"
              style={{ letterSpacing: 1 }}>
              Virtual Coins Only
            </Text>
          </View>
          <Text className="mt-1 text-xs font-medium leading-5 text-white/55">
            Arena Coins only unlock cosmetics. Every weekly card uses virtual-coin budgets.
          </Text>
        </View>
      </ScrollView>
      <ToastNotice message={toast} onDismiss={() => setToast(null)} />
    </ScreenWrapper>
  );
}
