import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { CosmeticPreview } from '@/components/cosmetics';
import { Badge, Button, Card, ScreenWrapper, SkeletonLoader } from '@/components/ui';
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

function CategoryPill({
  active,
  category,
  onPress,
}: {
  active: boolean;
  category: CosmeticCategory;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <View
        className={cn(
          'rounded-full border px-4 py-2',
          active ? 'border-electric-green/55 bg-electric-green/15' : 'border-white/10 bg-white/[0.04]',
        )}>
        <Text
          className={cn('text-xs font-black uppercase', active ? 'text-electric-green' : 'text-white/60')}
          style={{ letterSpacing: 1.2 }}>
          {COSMETIC_CATEGORY_LABELS[category]}
        </Text>
      </View>
    </Pressable>
  );
}

function ShopItemCard({
  canUseSeasonPassItem,
  equipped,
  item,
  loading,
  onEquip,
  onPreview,
  onPurchase,
  owned,
}: {
  canUseSeasonPassItem: boolean;
  equipped: boolean;
  item: CosmeticItem;
  loading: boolean;
  onEquip: (item: CosmeticItem) => void;
  onPreview: (item: CosmeticItem) => void;
  onPurchase: (item: CosmeticItem) => void;
  owned: boolean;
}) {
  const lockedExclusive = Boolean(item.seasonLabel && !canUseSeasonPassItem && !owned);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPreview(item)}
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
      <Card>
        <View className="gap-4">
          <View className="flex-row items-center gap-4">
            <CosmeticPreview category={item.category} itemId={item.id} />
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-lg font-black text-white" numberOfLines={1}>
                  {item.name}
                </Text>
                {item.seasonLabel ? <Badge label={item.seasonLabel} tone="gold" /> : null}
                {equipped ? <Badge label="Equipped" tone="green" /> : null}
              </View>
              <Text className="mt-1 text-sm font-semibold leading-5 text-white/55">
                {item.description}
              </Text>
              <View className="mt-2 flex-row items-center gap-1.5">
                <Ionicons color={item.accent} name="logo-bitcoin" size={13} />
                <Text className="text-xs font-black text-white/65">
                  {item.seasonLabel ? 'Season Pass only' : `${item.cost} coins`}
                </Text>
              </View>
            </View>
          </View>

          {lockedExclusive ? (
            <Button disabled title="Season Pass Exclusive" variant="secondary" />
          ) : owned || canUseSeasonPassItem ? (
            <Button
              disabled={equipped}
              loading={loading}
              onPress={() => onEquip(item)}
              title={equipped ? 'Equipped' : 'Equip'}
              variant={equipped ? 'secondary' : 'primary'}
            />
          ) : (
            <Button loading={loading} onPress={() => onPurchase(item)} title={`Buy ${item.cost}`} />
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export default function ShopScreen() {
  const { user } = useAuth();
  const [category, setCategory] = useState<CosmeticCategory>('team_logo');
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

  const onPreview = (item: CosmeticItem) => {
    logAnalyticsEvent('shop_item_previewed', {
      category: item.category,
      item_id: item.id,
    });
  };

  const onPurchase = async (item: CosmeticItem) => {
    haptics.medium();
    try {
      await purchaseCosmetic.mutateAsync(item.id);
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
    } catch (error) {
      haptics.warning();
      Alert.alert('Could not equip', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const ownedByItemId = cosmeticsQuery.data?.ownedByItemId ?? {};
  const equippedByCategory = cosmeticsQuery.data?.equippedByCategory ?? {};
  const canUseSeasonPassItem = Boolean(seasonPassQuery.data);

  return (
    <ScreenWrapper className="pb-0">
      <FlatList
        ListHeaderComponent={
          <View className="gap-5 pb-5">
            <View>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Ionicons color={THEME_COLORS.electricGreen} name="sparkles" size={14} />
                    <Text
                      className="text-xs font-black uppercase text-electric-green"
                      style={{ letterSpacing: 2 }}>
                      Cosmetics
                    </Text>
                  </View>
                  <Text className="mt-1 text-3xl font-black uppercase text-white">
                    Arena Shop
                  </Text>
                  <Text className="mt-1.5 text-base font-semibold text-white/60">
                    Cosmetic upgrades only. Gameplay stays free for every player.
                  </Text>
                </View>
                <View className="items-end rounded-2xl border border-gold/35 bg-gold/10 px-3 py-2">
                  <Text className="text-[10px] font-black uppercase text-gold">Coins</Text>
                  <Text className="text-lg font-black text-white">
                    {cosmeticsQuery.data?.coinBalance ?? 0}
                  </Text>
                </View>
              </View>
            </View>

            <View className="gap-2">
              <Text
                className="text-[10px] font-black uppercase text-white/45"
                style={{ letterSpacing: 2 }}>
                Category
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {COSMETIC_CATEGORIES.map((option) => (
                  <CategoryPill
                    active={category === option}
                    category={option}
                    key={option}
                    onPress={() => setCategory(option)}
                  />
                ))}
              </View>
              <Text className="text-sm font-semibold text-white/55">
                {COSMETIC_CATEGORY_DESCRIPTIONS[category]}
              </Text>
            </View>

            {cosmeticsQuery.isLoading ? (
              <View className="gap-3">
                {[0, 1, 2].map((item) => (
                  <SkeletonLoader height={150} key={item} />
                ))}
              </View>
            ) : null}
          </View>
        }
        contentContainerStyle={{ gap: 12, paddingBottom: 36 }}
        data={cosmeticsQuery.isLoading ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ShopItemCard
            canUseSeasonPassItem={canUseSeasonPassItem}
            equipped={equippedByCategory[item.category]?.item_id === item.id}
            item={item}
            loading={purchaseCosmetic.isPending || equipCosmetic.isPending}
            onEquip={onEquip}
            onPreview={onPreview}
            onPurchase={onPurchase}
            owned={Boolean(ownedByItemId[item.id])}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </ScreenWrapper>
  );
}
