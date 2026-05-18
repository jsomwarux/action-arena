import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { CosmeticPreview } from '@/components/cosmetics';
import { AnimatedNumber, Badge, Button, Card, ScreenWrapper, SkeletonLoader } from '@/components/ui';
import {
  COSMETIC_CATEGORIES,
  COSMETIC_CATEGORY_DESCRIPTIONS,
  COSMETIC_CATEGORY_LABELS,
  COSMETIC_ITEMS,
  SEASON_PASS_COSMETICS,
  type CosmeticItem,
} from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  useEquipCosmeticMutation,
  usePurchaseCosmeticMutation,
  useUserCosmetics,
} from '@/hooks/use-cosmetics';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { logAnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import type { CosmeticCategory } from '@/types/database';

const CATEGORY_ICON: Record<CosmeticCategory, React.ComponentProps<typeof Ionicons>['name']> = {
  chat_sticker_pack: 'chatbubbles',
  lock_effect: 'flash',
  profile_frame: 'square-outline',
  team_logo: 'shield',
  trophy_skin: 'trophy',
  win_celebration: 'sparkles',
};

function CategoryTab({
  active,
  category,
  onPress,
}: {
  active: boolean;
  category: CosmeticCategory;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
      <View
        className={cn(
          'flex-row items-center gap-2 rounded-full border px-4 py-2',
          active
            ? 'border-electric-green/55 bg-electric-green/15'
            : 'border-white/10 bg-white/[0.04]',
        )}
        style={
          active
            ? {
                shadowColor: THEME_COLORS.electricGreen,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.45,
                shadowRadius: 10,
              }
            : undefined
        }>
        <Ionicons
          color={active ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.55)'}
          name={CATEGORY_ICON[category]}
          size={13}
        />
        <Text
          className={cn(
            'text-[11px] font-bold',
            active ? 'text-electric-green' : 'text-white/60',
          )}>
          {COSMETIC_CATEGORY_LABELS[category]}
        </Text>
      </View>
    </Pressable>
  );
}

function PurchaseSparkle({ trigger }: { trigger: number | null }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === null) return;
    progress.setValue(0);
    Animated.timing(progress, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [progress, trigger]);

  if (trigger === null) {
    return null;
  }

  const scale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1.4, 1] });
  const opacity = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        bottom: 0,
        left: 0,
        opacity,
        position: 'absolute',
        right: 0,
        top: 0,
        transform: [{ scale }],
      }}>
      <View
        className="items-center justify-center"
        style={{ height: '100%', width: '100%' }}>
        <Ionicons color={THEME_COLORS.gold} name="sparkles" size={42} />
      </View>
    </Animated.View>
  );
}

function ShopItemCard({
  canUseSeasonPassItem,
  equipped,
  item,
  loading,
  onEquip,
  onPurchase,
  owned,
  recentlyPurchased,
}: {
  canUseSeasonPassItem: boolean;
  equipped: boolean;
  item: CosmeticItem;
  loading: boolean;
  onEquip: (item: CosmeticItem) => void;
  onPurchase: (item: CosmeticItem) => void;
  owned: boolean;
  recentlyPurchased: boolean;
}) {
  const lockedExclusive = Boolean(item.seasonLabel && !canUseSeasonPassItem && !owned);
  const sparkleTrigger = recentlyPurchased ? Date.now() : null;

  return (
    <View
      className={cn(
        'overflow-hidden rounded-2xl border bg-white/[0.04]',
        equipped ? 'border-electric-green/55' : 'border-white/[0.08]',
        item.seasonLabel ? 'border-gold/55' : null,
      )}
      style={
        equipped
          ? {
              shadowColor: THEME_COLORS.electricGreen,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 14,
            }
          : item.seasonLabel
            ? {
                shadowColor: THEME_COLORS.gold,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
              }
            : undefined
      }>
      {item.seasonLabel ? (
        <View className="flex-row items-center justify-center gap-1.5 border-b border-gold/40 bg-gold/15 px-3 py-1.5">
          <Ionicons color={THEME_COLORS.gold} name="ribbon" size={10} />
          <Text
            className="text-[10px] font-black uppercase text-gold"
            style={{ letterSpacing: 1.6 }}>
            {item.seasonLabel}
          </Text>
        </View>
      ) : null}

      <View className="items-center gap-3 px-5 pb-5 pt-5">
        <View>
          <CosmeticPreview category={item.category} itemId={item.id} size="lg" />
          <PurchaseSparkle trigger={sparkleTrigger} />
        </View>

        <View className="items-center gap-1.5 self-stretch">
          <Text
            className="text-center text-base font-black text-white"
            numberOfLines={1}
            style={{ letterSpacing: -0.2 }}>
            {item.name}
          </Text>
          {equipped ? (
            <View className="flex-row items-center gap-1 self-center rounded-full border border-electric-green/55 bg-electric-green/15 px-2.5 py-0.5">
              <Ionicons color={THEME_COLORS.electricGreen} name="checkmark" size={10} />
              <Text className="text-[10px] font-bold text-electric-green">Equipped</Text>
            </View>
          ) : owned ? (
            <View className="self-center rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5">
              <Text className="text-[10px] font-semibold text-white/65">Owned</Text>
            </View>
          ) : null}
          <Text
            className="text-center text-xs font-medium leading-4 text-white/55"
            numberOfLines={2}>
            {item.description}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Ionicons
            color={item.seasonLabel ? THEME_COLORS.gold : item.accent}
            name="ellipse"
            size={13}
          />
          <Text className="text-xs font-bold text-white/75">
            {item.seasonLabel
              ? lockedExclusive
                ? 'Season Pass required'
                : 'Season Pass included'
              : `${item.cost} coins`}
          </Text>
        </View>

        {lockedExclusive ? (
          <Button disabled title="Season Pass Required" variant="secondary" />
        ) : owned || canUseSeasonPassItem ? (
          <Button
            disabled={equipped}
            loading={loading}
            onPress={() => onEquip(item)}
            title={equipped ? 'Equipped' : 'Equip'}
            variant={equipped ? 'secondary' : 'primary'}
          />
        ) : (
          <Button loading={loading} onPress={() => onPurchase(item)} title={`Buy · ${item.cost}`} />
        )}
      </View>
    </View>
  );
}

function HeaderSummary({
  coinBalance,
  loading,
  onGetCoins,
  onSeasonPass,
}: {
  coinBalance: number;
  loading: boolean;
  onGetCoins: () => void;
  onSeasonPass: () => void;
}) {
  return (
    <View className="gap-3">
      <View>
        <View className="flex-row items-center gap-2">
          <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
          <Text
            className="text-[11px] font-semibold uppercase text-electric-green"
            style={{ letterSpacing: 1.2 }}>
            Cosmetics Shop
          </Text>
        </View>
        <Text
          className="mt-1 text-2xl font-extrabold text-white"
          style={{ letterSpacing: -0.4 }}>
          Arena Locker
        </Text>
        <Text className="mt-1 text-sm font-medium text-white/55">
          Loadout drops only — gameplay stays free for every player.
        </Text>
      </View>

      <View
        className="overflow-hidden rounded-2xl border border-gold/55 bg-gold/[0.10]"
        style={{
          shadowColor: THEME_COLORS.gold,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
        }}>
        <View className="flex-row items-center gap-3 p-4">
          <View
            className="h-12 w-12 items-center justify-center rounded-2xl border border-gold/65 bg-gold/15"
            style={{
              shadowColor: THEME_COLORS.gold,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.55,
              shadowRadius: 12,
            }}>
            <Text className="text-base font-black text-gold">AA</Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-[10px] font-semibold uppercase text-gold"
              style={{ letterSpacing: 1.2 }}>
              Arena Coins
            </Text>
            {loading ? (
              <View className="mt-0.5">
                <SkeletonLoader height={26} width={120} />
              </View>
            ) : (
              <AnimatedNumber
                className="mt-0.5 text-2xl font-extrabold text-white"
                style={{ letterSpacing: -0.4 }}
                value={coinBalance}
              />
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onGetCoins}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <View
              className="rounded-full border border-gold bg-gold/30 px-3 py-2"
              style={{
                shadowColor: THEME_COLORS.gold,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 8,
              }}>
              <Text
                className="text-xs font-black uppercase text-gold"
                style={{ letterSpacing: 1 }}>
                Get Coins
              </Text>
            </View>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={onSeasonPass}>
          <View className="flex-row items-center justify-center gap-1.5 border-t border-gold/30 bg-gold/[0.05] py-2">
            <Ionicons color={THEME_COLORS.gold} name="ribbon" size={11} />
            <Text
              className="text-[11px] font-bold text-gold"
              style={{ letterSpacing: 0.4 }}>
              Unlock the Season Pass for exclusive drops
            </Text>
            <Ionicons color={THEME_COLORS.gold} name="chevron-forward" size={11} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export default function ShopScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [category, setCategory] = useState<CosmeticCategory>('team_logo');
  const [recentPurchaseId, setRecentPurchaseId] = useState<string | null>(null);
  const cosmeticsQuery = useUserCosmetics(user?.id);
  const seasonPassQuery = useSeasonPass(user?.id);
  const purchaseCosmetic = usePurchaseCosmeticMutation(user?.id);
  const equipCosmetic = useEquipCosmeticMutation(user?.id);

  const items = useMemo(() => {
    const baseItems = COSMETIC_ITEMS.filter((item) => item.category === category);
    const exclusiveItems = SEASON_PASS_COSMETICS.filter((item) => item.category === category);
    return [...baseItems, ...exclusiveItems];
  }, [category]);

  useEffect(() => {
    logAnalyticsEvent('shop_viewed', { category, user_id: user?.id });
  }, [category, user?.id]);

  useEffect(() => {
    if (!recentPurchaseId) return;
    const timer = setTimeout(() => setRecentPurchaseId(null), 1200);
    return () => clearTimeout(timer);
  }, [recentPurchaseId]);

  const onPurchase = async (item: CosmeticItem) => {
    haptics.medium();
    try {
      await purchaseCosmetic.mutateAsync(item.id);
      haptics.success();
      setRecentPurchaseId(item.id);
      Alert.alert('Cosmetic purchased', `${item.name} is now in your locker.`);
    } catch (error) {
      haptics.warning();
      Alert.alert('Could not purchase', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const onEquip = async (item: CosmeticItem) => {
    haptics.light();
    try {
      await equipCosmetic.mutateAsync(item.id);
      haptics.success();
    } catch (error) {
      haptics.warning();
      Alert.alert('Could not equip', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const ownedByItemId = cosmeticsQuery.data?.ownedByItemId ?? {};
  const equippedByCategory = cosmeticsQuery.data?.equippedByCategory ?? {};
  const canUseSeasonPassItem = Boolean(seasonPassQuery.data);
  const ownedCountForCategory = items.filter((item) => ownedByItemId[item.id] || (item.seasonLabel && canUseSeasonPassItem)).length;

  return (
    <ScreenWrapper className="pb-0">
      <View className="gap-4 pb-4">
        <HeaderSummary
          coinBalance={cosmeticsQuery.data?.coinBalance ?? 0}
          loading={cosmeticsQuery.isLoading}
          onGetCoins={() => router.push('/coin-store')}
          onSeasonPass={() => router.push('/season-pass')}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
          {COSMETIC_CATEGORIES.map((option) => (
            <CategoryTab
              active={category === option}
              category={option}
              key={option}
              onPress={() => {
                haptics.selection();
                setCategory(option);
              }}
            />
          ))}
        </ScrollView>

        <View className="flex-row items-start justify-between gap-3">
          <Text
            className="flex-1 text-sm font-medium text-white/60"
            numberOfLines={3}>
            {COSMETIC_CATEGORY_DESCRIPTIONS[category]}
          </Text>
          <Badge
            label={`${ownedCountForCategory}/${items.length} owned`}
            tone={ownedCountForCategory >= items.length ? 'green' : 'gold'}
          />
        </View>
      </View>

      {cosmeticsQuery.isLoading ? (
        <View className="gap-3">
          {[0, 1, 2].map((item) => (
            <SkeletonLoader height={220} key={item} />
          ))}
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 36 }}
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <ShopItemCard
                canUseSeasonPassItem={canUseSeasonPassItem}
                equipped={equippedByCategory[item.category]?.item_id === item.id}
                item={item}
                loading={purchaseCosmetic.isPending || equipCosmetic.isPending}
                onEquip={onEquip}
                onPurchase={onPurchase}
                owned={Boolean(ownedByItemId[item.id])}
                recentlyPurchased={recentPurchaseId === item.id}
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenWrapper>
  );
}
