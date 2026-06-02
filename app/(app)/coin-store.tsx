import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  AnimatedNumber,
  Button,
  Card,
  ScreenWrapper,
  SkeletonLoader,
} from '@/components/ui';
import { COIN_PACKS, type CoinPack } from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCoinPurchase } from '@/hooks/use-coin-purchase';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { logAnalyticsEvent } from '@/lib/analytics';
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
    bonus: 'Base rate',
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

function PackCardBanner({ accent, tagline }: { accent: string; tagline: string }) {
  return (
    <View
      className="flex-row items-center justify-center gap-1.5 border-b px-3 py-1.5"
      style={{
        backgroundColor: `${accent}26`,
        borderColor: `${accent}66`,
      }}>
      <Ionicons color={accent} name="star" size={11} />
      <Text
        className="text-[10px] font-black uppercase"
        style={{ color: accent, letterSpacing: 1.6 }}
        numberOfLines={1}>
        {tagline}
      </Text>
    </View>
  );
}

function PackCta({
  isLoading,
  isPurchasing,
  onBuy,
  priceLabel,
}: {
  isLoading: boolean;
  isPurchasing: boolean;
  onBuy: () => void;
  priceLabel: string | null;
}) {
  const buttonTitle = priceLabel
    ? `Buy · ${priceLabel}`
    : isLoading
      ? 'Loading Prices'
      : 'Unavailable';

  return (
    <Button
      disabled={!priceLabel || isLoading || isPurchasing}
      icon="card"
      loading={isPurchasing}
      onPress={onBuy}
      title={buttonTitle}
      variant={priceLabel ? 'primary' : 'secondary'}
    />
  );
}

function CompactPackCard({
  accent,
  bonus,
  meta,
  pack,
}: {
  accent: string;
  bonus: string;
  meta: (typeof TIER_META)[Tier];
  pack: CoinPack;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <PackHero accent={accent} icon={meta.icon} plateSize={meta.plateSize} />
      <View className="flex-1 gap-1.5" style={{ minWidth: 0 }}>
        <Text
          className="text-[11px] font-semibold uppercase"
          style={{ color: accent, letterSpacing: 1 }}
          numberOfLines={2}>
          {pack.label}
        </Text>
        <View className="flex-row items-baseline gap-1.5">
          <Text
            adjustsFontSizeToFit
            className="text-3xl font-extrabold text-white"
            minimumFontScale={0.7}
            numberOfLines={1}
            style={{ letterSpacing: -0.6 }}>
            {pack.coins.toLocaleString()}
          </Text>
          <Text
            className="text-xs font-bold"
            style={{ color: `${accent}cc`, letterSpacing: 0.3 }}>
            coins
          </Text>
        </View>
        <Text className="text-xs font-medium leading-5 text-white/55">
          {meta.subtitle}
        </Text>
        <View className="mt-1 flex-row items-center gap-2">
          <View
            className="self-start rounded-full border px-2.5 py-0.5"
            style={{
              backgroundColor: `${accent}22`,
              borderColor: `${accent}66`,
            }}>
            <Text
              className="text-[10px] font-bold"
              numberOfLines={1}
              style={{ color: accent, letterSpacing: 0.4 }}>
              {bonus}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function CompactPackContent({
  accent,
  bonus,
  isLoading,
  isPurchasing,
  meta,
  onBuy,
  pack,
  priceLabel,
}: {
  accent: string;
  bonus: string;
  isLoading: boolean;
  isPurchasing: boolean;
  meta: (typeof TIER_META)[Tier];
  onBuy: () => void;
  pack: CoinPack;
  priceLabel: string | null;
}) {
  return (
    <View className="gap-4 p-4">
      <CompactPackCard
        accent={accent}
        bonus={bonus}
        meta={meta}
        pack={pack}
      />
      <PackCta
        isLoading={isLoading}
        isPurchasing={isPurchasing}
        onBuy={onBuy}
        priceLabel={priceLabel}
      />
    </View>
  );
}

function FeaturedPackCard({
  accent,
  bonus,
  isLoading,
  isPurchasing,
  meta,
  onBuy,
  pack,
  priceLabel,
}: {
  accent: string;
  bonus: string;
  isLoading: boolean;
  isPurchasing: boolean;
  meta: (typeof TIER_META)[Tier];
  onBuy: () => void;
  pack: CoinPack;
  priceLabel: string | null;
}) {
  return (
    <View className="items-center gap-3 p-5">
      <PackHero accent={accent} icon={meta.icon} plateSize={meta.plateSize} />
      <Text
        className="text-center text-xs font-semibold uppercase"
        style={{ color: accent, letterSpacing: 1.2 }}
        numberOfLines={2}>
        {pack.label}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text
          adjustsFontSizeToFit
          className="text-4xl font-extrabold text-white"
          minimumFontScale={0.7}
          numberOfLines={1}
          style={{ letterSpacing: -0.6 }}>
          {pack.coins.toLocaleString()}
        </Text>
        <Text
          className="text-sm font-bold"
          style={{ color: `${accent}cc`, letterSpacing: 0.3 }}>
          coins
        </Text>
      </View>
      <Text
        className="text-center text-xs font-medium leading-5 text-white/65">
        {meta.subtitle}
      </Text>
      <View
        className="self-center rounded-full border px-3 py-1"
        style={{
          backgroundColor: `${accent}22`,
          borderColor: `${accent}66`,
        }}>
        <Text
          className="text-[11px] font-bold"
          numberOfLines={1}
          style={{ color: accent, letterSpacing: 0.4 }}>
          {bonus}
        </Text>
      </View>
      <View className="mt-1 w-full">
        <PackCta
          isLoading={isLoading}
          isPurchasing={isPurchasing}
          onBuy={onBuy}
          priceLabel={priceLabel}
        />
      </View>
    </View>
  );
}

function PackCard({
  isFeatured,
  isLoading,
  isPurchasing,
  onBuy,
  pack,
  priceLabel,
  tier,
}: {
  isFeatured: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  onBuy: () => void;
  pack: CoinPack;
  priceLabel: string | null;
  tier: Tier;
}) {
  const meta = TIER_META[tier];
  return (
    <View>
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
        {isFeatured ? <PackCardBanner accent={meta.accent} tagline={meta.tagline} /> : null}
        {isFeatured ? (
          <FeaturedPackCard
            accent={meta.accent}
            bonus={meta.bonus}
            isLoading={isLoading}
            isPurchasing={isPurchasing}
            meta={meta}
            onBuy={onBuy}
            pack={pack}
            priceLabel={priceLabel}
          />
        ) : (
          <CompactPackContent
            accent={meta.accent}
            bonus={meta.bonus}
            isLoading={isLoading}
            isPurchasing={isPurchasing}
            meta={meta}
            onBuy={onBuy}
            pack={pack}
            priceLabel={priceLabel}
          />
        )}
      </View>
    </View>
  );
}

export default function CoinStoreScreen() {
  const { user } = useAuth();
  const cosmeticsQuery = useUserCosmetics(user?.id);
  const coinPurchase = useCoinPurchase(user?.id);

  useEffect(() => {
    logAnalyticsEvent('coin_store_viewed', { user_id: user?.id });
  }, [user?.id]);

  const allProductsLoaded = COIN_PACKS.every((pack) => coinPurchase.productsById[pack.productId]);
  const showRetryState =
    coinPurchase.productFetchStatus === 'error' ||
    (coinPurchase.productFetchStatus === 'loaded' && !allProductsLoaded);

  const buyPack = async (pack: CoinPack) => {
    haptics.light();
    const outcome = await coinPurchase.purchase(pack);

    if (outcome.ok) {
      haptics.success();
    } else {
      haptics.warning();
    }
  };

  return (
    <ScreenWrapper className="pb-0 pt-4">
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 48, paddingTop: 2 }}
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
          {showRetryState ? (
            <View className="rounded-2xl border border-coral-red/30 bg-coral-red/10 p-4">
              <View className="flex-row items-start gap-3">
                <Ionicons color={THEME_COLORS.coralRed} name="alert-circle" size={18} />
                <View className="flex-1 gap-3">
                  <Text className="text-sm font-bold leading-5 text-coral-red">
                    {coinPurchase.error ?? 'Arena Coin pricing is not available from Apple yet.'}
                  </Text>
                  <Button
                    icon="refresh"
                    loading={coinPurchase.isLoading}
                    onPress={coinPurchase.retryProducts}
                    title="Retry Store Prices"
                    variant="secondary"
                  />
                </View>
              </View>
            </View>
          ) : null}

          {COIN_PACKS.map((pack) => {
            const tier = TIER_BY_PACK[pack.id] ?? 'pouch';
            const isFeatured = tier === 'vault';
            const product = coinPurchase.productsById[pack.productId];
            return (
              <PackCard
                isFeatured={isFeatured}
                isLoading={coinPurchase.isLoading}
                isPurchasing={coinPurchase.isProductPurchasing(pack.productId)}
                key={pack.id}
                onBuy={() => buyPack(pack)}
                pack={pack}
                priceLabel={product?.displayPrice ?? null}
                tier={tier}
              />
            );
          })}
        </View>

        {coinPurchase.message ? (
          <View className="rounded-2xl border border-electric-green/30 bg-electric-green/10 p-3">
            <Text className="text-xs font-bold leading-5 text-electric-green">
              {coinPurchase.message}
            </Text>
          </View>
        ) : null}
        {coinPurchase.error && !showRetryState ? (
          <View className="rounded-2xl border border-coral-red/30 bg-coral-red/10 p-3">
            <Text className="text-xs font-bold leading-5 text-coral-red">
              {coinPurchase.error}
            </Text>
          </View>
        ) : null}

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
    </ScreenWrapper>
  );
}
