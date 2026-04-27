import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { CosmeticPreview } from '@/components/cosmetics';
import { Badge, Button, Card, ScreenWrapper, TextInput } from '@/components/ui';
import { CURRENT_SEASON_YEAR, SEASON_PASS_COSMETICS } from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useRedeemSeasonPassMutation, useSeasonPass } from '@/hooks/use-season-pass';
import { logAnalyticsEvent } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';

const PASS_FEATURES = [
  {
    icon: 'sparkles' as const,
    title: 'Exclusive Cosmetics',
    body: 'Season 1-only logo, frame, Lock effect, and trophy skin.',
  },
  {
    icon: 'analytics' as const,
    title: 'Advanced Analytics',
    body: 'Bet type win rates, weekly profit trends, team splits, and hit-rate views.',
  },
  {
    icon: 'time' as const,
    title: 'Early Bet Access',
    body: 'Access the Bet Board 30 minutes before free users when new odds drop.',
  },
  {
    icon: 'remove-circle' as const,
    title: 'Ad-Free Experience',
    body: 'Future ad hooks skip Season Pass holders automatically.',
  },
];

export default function SeasonPassScreen() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const seasonPassQuery = useSeasonPass(user?.id);
  const redeemSeasonPass = useRedeemSeasonPassMutation(user?.id);
  const hasPass = Boolean(seasonPassQuery.data);

  useEffect(() => {
    logAnalyticsEvent('season_pass_screen_viewed', {
      season_year: CURRENT_SEASON_YEAR,
      user_id: user?.id,
    });
  }, [user?.id]);

  const redeem = async () => {
    if (!code.trim()) {
      Alert.alert('Code required', 'Enter a Season Pass code to redeem.');
      return;
    }

    try {
      await redeemSeasonPass.mutateAsync(code);
      haptics.success();
      Alert.alert('Season Pass unlocked', 'Exclusive cosmetics and analytics are active.');
      setCode('');
    } catch (error) {
      haptics.warning();
      Alert.alert('Could not redeem', error instanceof Error ? error.message : 'Try again.');
    }
  };

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView
        contentContainerStyle={{ gap: 18, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}>
        <Card tone="highlight">
          <View className="gap-5">
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Ionicons color={THEME_COLORS.gold} name="ribbon" size={14} />
                  <Text
                    className="text-xs font-black uppercase text-gold"
                    style={{ letterSpacing: 2 }}>
                    Season {CURRENT_SEASON_YEAR}
                  </Text>
                </View>
                <Text className="mt-2 text-3xl font-black uppercase text-white">
                  Season Pass
                </Text>
                <Text className="mt-2 text-base font-semibold leading-6 text-white/60">
                  Redeem test codes now. Real purchase processing comes later, closer to App Store submission.
                </Text>
              </View>
              {hasPass ? <Badge label="Active" tone="green" /> : <Badge label="Code Only" tone="gold" />}
            </View>

            {!hasPass ? (
              <View className="gap-3">
                <TextInput
                  autoCapitalize="characters"
                  label="Redeem Code"
                  onChangeText={setCode}
                  placeholder="ARENA-S1-TEST"
                  value={code}
                />
                <Button loading={redeemSeasonPass.isPending} onPress={redeem} title="Redeem Pass" />
              </View>
            ) : (
              <View className="rounded-2xl border border-electric-green/35 bg-electric-green/10 p-4">
                <Text className="text-base font-black text-electric-green">
                  Season Pass is active for your account.
                </Text>
              </View>
            )}
          </View>
        </Card>

        <View className="gap-3">
          {PASS_FEATURES.map((feature) => (
            <Card key={feature.title}>
              <View className="flex-row gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gold/35 bg-gold/10">
                  <Ionicons color={THEME_COLORS.gold} name={feature.icon} size={19} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-black text-white">{feature.title}</Text>
                  <Text className="mt-1 text-sm font-semibold leading-5 text-white/55">
                    {feature.body}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <View className="gap-3">
          <Text
            className="text-[10px] font-black uppercase text-gold"
            style={{ letterSpacing: 2 }}>
            Season 1 Exclusive Cosmetics
          </Text>
          {SEASON_PASS_COSMETICS.map((item) => (
            <Card key={item.id}>
              <View className="flex-row items-center gap-4">
                <CosmeticPreview category={item.category} itemId={item.id} />
                <View className="flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-lg font-black text-white">{item.name}</Text>
                    <Badge label="Season 1 Exclusive" tone="gold" />
                  </View>
                  <Text className="mt-1 text-sm font-semibold leading-5 text-white/55">
                    {item.description}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
