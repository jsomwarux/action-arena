import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { CosmeticPreview } from '@/components/cosmetics';
import { Badge, Button, Card, ScreenWrapper, TextInput } from '@/components/ui';
import {
  CURRENT_SEASON_YEAR,
  SEASON_PASS_COSMETICS,
  type CosmeticItem,
} from '@/constants/cosmetics';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useRedeemSeasonPassMutation, useSeasonPass } from '@/hooks/use-season-pass';
import { logAnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

const PASS_PRICE = '9.99 USD';

const PASS_FEATURES: {
  body: string;
  highlight: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
}[] = [
  {
    body: 'Claim your Season 1 identity with a founder logo, animated frame, exclusive Lock effect, and a legacy trophy skin.',
    highlight: '4 exclusive cosmetics',
    icon: 'sparkles',
    title: 'Season 1 Exclusive Drops',
  },
  {
    body: 'Win-rate splits, weekly score trends, hit rates by pick type, and best/toughest team reads. Permanent unlock.',
    highlight: 'Charts + trends',
    icon: 'analytics',
    title: 'Advanced Analytics Dashboard',
  },
  {
    body: 'See Pick Board lines 30 minutes before free users every week. Build your lineup before the weekly slate opens.',
    highlight: '30-minute head start',
    icon: 'time',
    title: 'Early Pick Board Access',
  },
  {
    body: 'Customize league rules, scoring caps, and pick types while keeping core play free for every member.',
    highlight: 'Rules + scoring caps',
    icon: 'options',
    title: 'League Customization',
  },
];

function HeroPriceTag() {
  return (
    <View className="items-end">
      <Text
        className="text-[10px] font-semibold uppercase text-gold/80"
        style={{ letterSpacing: 1 }}>
        One-time
      </Text>
      <View className="flex-row items-baseline gap-1">
        <Text
          className="text-3xl font-extrabold text-white"
          style={{ letterSpacing: -0.6 }}>
          {PASS_PRICE}
        </Text>
        <Text className="text-xs font-medium text-white/55">/season</Text>
      </View>
      <Text
        className="text-[10px] font-semibold uppercase text-gold"
        style={{ letterSpacing: 1 }}>
        Less than a coffee
      </Text>
    </View>
  );
}

function HeroCard({ hasPass }: { hasPass: boolean }) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-gold bg-gold/[0.10]"
      style={{
        borderWidth: 2,
        shadowColor: THEME_COLORS.gold,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.55,
        shadowRadius: 22,
      }}>
      <View className="flex-row items-center justify-center gap-2 border-b border-gold/40 bg-gold/15 py-2">
        <Ionicons color={THEME_COLORS.gold} name="ribbon" size={12} />
        <Text
          className="text-[10px] font-black uppercase text-gold"
          style={{ letterSpacing: 2 }}>
          Season {CURRENT_SEASON_YEAR} Pass
        </Text>
        <Ionicons color={THEME_COLORS.gold} name="ribbon" size={12} />
      </View>
      <View className="gap-4 p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1.5">
            <Text
              className="text-[10px] font-semibold uppercase text-gold/85"
              style={{ letterSpacing: 1.4 }}>
              Backstage Pass
            </Text>
            <Text
              className="text-2xl font-extrabold text-white"
              style={{ letterSpacing: -0.4 }}>
              Buy your ticket to the season.
            </Text>
            <Text className="text-sm font-medium leading-5 text-white/65">
              Unlock every Season 1 exclusive, the analytics lab, league customization, and a 30-minute jump on the slate. {PASS_PRICE} once. Yours all season.
            </Text>
          </View>
          <HeroPriceTag />
        </View>
        {hasPass ? (
          <View className="flex-row items-center gap-2 rounded-xl border border-electric-green/45 bg-electric-green/15 px-3 py-2">
            <Ionicons color={THEME_COLORS.electricGreen} name="checkmark-circle" size={14} />
            <Text className="flex-1 text-xs font-bold text-electric-green">
              Season Pass active. Exclusive drops and analytics are unlocked.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function FeatureCard({
  body,
  highlight,
  icon,
  index,
  title,
}: {
  body: string;
  highlight: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  index: number;
  title: string;
}) {
  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl border border-gold/45 bg-gold/15"
          style={{
            shadowColor: THEME_COLORS.gold,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.45,
            shadowRadius: 10,
          }}>
          <Ionicons color={THEME_COLORS.gold} name={icon} size={20} />
        </View>
        <View className="flex-1 gap-1.5">
          <View className="flex-row items-center gap-2">
            <Text
              className="text-[10px] font-semibold uppercase text-gold/80"
              style={{ letterSpacing: 1.2 }}>
              Perk {String(index + 1).padStart(2, '0')}
            </Text>
            <View className="rounded-full border border-gold/45 bg-gold/15 px-2 py-px">
              <Text className="text-[10px] font-bold text-gold">{highlight}</Text>
            </View>
          </View>
          <Text className="text-base font-extrabold text-white" style={{ letterSpacing: -0.2 }}>
            {title}
          </Text>
          <Text className="text-sm font-medium leading-5 text-white/60">{body}</Text>
        </View>
      </View>
    </Card>
  );
}

function AnalyticsTeaser() {
  // Faux sparkline + bar chart preview made of plain Views — a screenshot
  // teaser for the locked analytics dashboard.
  const sparkline = [12, 18, 26, 22, 32, 41, 36, 48, 56, 62];
  const max = Math.max(...sparkline);
  return (
    <Card>
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Ionicons color={THEME_COLORS.cyanAccent} name="analytics" size={14} />
            <Text
              className="text-[11px] font-semibold uppercase text-cyan-accent"
              style={{ letterSpacing: 1.2 }}>
              Inside the Lab
            </Text>
          </View>
          <Badge label="Pass Only" tone="gold" />
        </View>
        <Text
          className="text-base font-extrabold text-white"
          style={{ letterSpacing: -0.2 }}>
          Trends that win you next week
        </Text>
        <View className="flex-row items-end gap-1 rounded-2xl border border-cyan-accent/25 bg-cyan-accent/[0.06] p-3">
          {sparkline.map((value, idx) => {
            const heightPct = (value / max) * 100;
            return (
              <View
                key={idx}
                className="flex-1 rounded-md"
                style={{
                  backgroundColor:
                    idx === sparkline.length - 1
                      ? THEME_COLORS.cyanAccent
                      : `${THEME_COLORS.cyanAccent}66`,
                  height: 4 + (heightPct / 100) * 70,
                }}
              />
            );
          })}
        </View>
        <View className="flex-row items-center justify-between rounded-2xl border border-electric-green/25 bg-electric-green/[0.06] p-3">
          <View className="flex-1 gap-1">
            <Text
              className="text-[10px] font-semibold uppercase text-electric-green"
              style={{ letterSpacing: 1 }}>
              Best team to pick
            </Text>
            <Text className="text-base font-extrabold text-white">Eagles +6.5</Text>
            <Text className="text-[11px] font-medium text-white/55">
              4-1 ATS · +84 coins across 5 settled picks
            </Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-electric-green/45 bg-electric-green/15">
            <Ionicons color={THEME_COLORS.electricGreen} name="trending-up" size={22} />
          </View>
        </View>
      </View>
    </Card>
  );
}

function ExclusiveCosmeticCard({ item }: { item: CosmeticItem }) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-gold bg-gold/[0.10]"
      style={{
        borderWidth: 2,
        shadowColor: THEME_COLORS.gold,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
      }}>
      <View className="flex-row items-center justify-center gap-1.5 border-b border-gold/45 bg-gold/15 px-3 py-1.5">
        <Ionicons color={THEME_COLORS.gold} name="ribbon" size={11} />
        <Text
          className="text-[10px] font-black uppercase text-gold"
          style={{ letterSpacing: 1.6 }}>
          {item.seasonLabel ?? 'Season Pass Exclusive'}
        </Text>
      </View>
      <View className="items-center gap-3 px-4 pb-4 pt-5">
        <CosmeticPreview category={item.category} itemId={item.id} size="lg" />
        <View className="items-center gap-1">
          <Text
            className="text-base font-extrabold text-white"
            numberOfLines={1}
            style={{ letterSpacing: -0.2 }}>
            {item.name}
          </Text>
          <Text
            className="text-center text-xs font-medium leading-4 text-white/60"
            numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        <View className="rounded-full border border-gold/45 bg-gold/15 px-2.5 py-0.5">
          <Text className="text-[10px] font-bold text-gold">
            Status symbol · proves you were here Day 1
          </Text>
        </View>
      </View>
    </View>
  );
}

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
        contentContainerStyle={{ gap: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}>
        <View>
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-gold" />
            <Text
              className="text-[11px] font-semibold uppercase text-gold"
              style={{ letterSpacing: 1.2 }}>
              Season {CURRENT_SEASON_YEAR} Pass
            </Text>
          </View>
          <Text
            className="mt-1 text-2xl font-extrabold text-white"
            style={{ letterSpacing: -0.4 }}>
            All-Access Pass
          </Text>
          <Text className="mt-1 text-sm font-medium text-white/55">
            One ticket. The whole season unlocked.
          </Text>
        </View>

        <HeroCard hasPass={hasPass} />

        <Card>
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text
                  className={cn(
                    'text-[11px] font-semibold uppercase',
                    hasPass ? 'text-electric-green' : 'text-gold',
                  )}
                  style={{ letterSpacing: 1.2 }}>
                  {hasPass ? 'Pass Active' : 'Redeem'}
                </Text>
                <Text className="mt-0.5 text-base font-bold text-white">
                  {hasPass ? 'You’re all set for the season' : 'Have a code? Drop it in.'}
                </Text>
              </View>
              {hasPass ? (
                <Badge label="Active" tone="green" />
              ) : (
                <Badge label="Code Only" tone="gold" />
              )}
            </View>
            {!hasPass ? (
              <View className="gap-2">
                <TextInput
                  autoCapitalize="characters"
                  label="Redeem Code"
                  onChangeText={setCode}
                  placeholder="ARENA-S1-TEST"
                  value={code}
                />
                <Button
                  loading={redeemSeasonPass.isPending}
                  onPress={redeem}
                  title="Redeem Pass"
                />
                <Text className="text-[11px] font-medium text-white/45">
                  Apple In-App Purchase ({PASS_PRICE}) ships before launch.
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        <View>
          <Text
            className="text-[11px] font-semibold uppercase text-electric-green"
            style={{ letterSpacing: 1.2 }}>
            What's inside
          </Text>
          <Text
            className="mt-0.5 text-base font-bold text-white"
            style={{ letterSpacing: -0.2 }}>
            Four perks · {PASS_PRICE} flat
          </Text>
        </View>

        <View className="gap-3">
          {PASS_FEATURES.map((feature, index) => (
            <FeatureCard
              body={feature.body}
              highlight={feature.highlight}
              icon={feature.icon}
              index={index}
              key={feature.title}
              title={feature.title}
            />
          ))}
        </View>

        <AnalyticsTeaser />

        <View>
          <Text
            className="text-[11px] font-semibold uppercase text-gold"
            style={{ letterSpacing: 1.2 }}>
            Season 1 Exclusive Drops
          </Text>
          <Text
            className="mt-0.5 text-base font-bold text-white"
            style={{ letterSpacing: -0.2 }}>
            Status symbols. Limited to founders.
          </Text>
        </View>

        <View className="gap-3">
          {SEASON_PASS_COSMETICS.map((item) => (
            <ExclusiveCosmeticCard item={item} key={item.id} />
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
