import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Card, ScreenWrapper, SkeletonLoader } from '@/components/ui';
import { COIN_PACKS } from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { logAnalyticsEvent } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';

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
          <Text className="text-center text-sm font-black text-electric-green">{message}</Text>
        </View>
      </Pressable>
    </View>
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
    haptics.light();
    logAnalyticsEvent('coin_store_viewed', { pack_id: packId, user_id: user?.id });
    setToast('Payment integration is coming.');
  };

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView
        contentContainerStyle={{ gap: 18, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}>
        <View>
          <View className="flex-row items-center gap-2">
            <Ionicons color={THEME_COLORS.gold} name="cash" size={14} />
            <Text
              className="text-xs font-black uppercase text-gold"
              style={{ letterSpacing: 2 }}>
              Arena Coins
            </Text>
          </View>
          <Text className="mt-1 text-3xl font-black uppercase text-white">
            Coin Store
          </Text>
          <Text className="mt-1.5 text-base font-semibold text-white/60">
            Purchase buttons are placeholders until Apple IAP is integrated.
          </Text>
        </View>

        <Card tone="highlight">
          <View className="flex-row items-center justify-between">
            <View>
              <Text
                className="text-[10px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 2 }}>
                Current Balance
              </Text>
              {cosmeticsQuery.isLoading ? (
                <View className="mt-2">
                  <SkeletonLoader height={36} width={120} />
                </View>
              ) : (
                <Text className="mt-1 text-4xl font-black text-white">
                  {cosmeticsQuery.data?.coinBalance ?? 0}
                </Text>
              )}
            </View>
            <View className="h-16 w-16 items-center justify-center rounded-3xl border border-gold/45 bg-gold/15">
              <Ionicons color={THEME_COLORS.gold} name="logo-bitcoin" size={30} />
            </View>
          </View>
        </Card>

        <View className="gap-3">
          {COIN_PACKS.map((pack) => (
            <Card key={pack.id}>
              <View className="gap-4">
                <View className="flex-row items-center justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-xl font-black uppercase text-white">{pack.label}</Text>
                    <Text className="mt-1 text-sm font-semibold text-white/55">
                      {pack.coins.toLocaleString()} Arena Coins
                    </Text>
                  </View>
                  <View className="rounded-2xl border border-gold/35 bg-gold/10 px-3 py-2">
                    <Text className="text-base font-black text-gold">{pack.priceLabel}</Text>
                  </View>
                </View>
                <Button onPress={() => showComingSoon(pack.id)} title="Purchase Soon" />
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
      <ToastNotice message={toast} onDismiss={() => setToast(null)} />
    </ScreenWrapper>
  );
}
