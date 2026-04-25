import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  type SharedValue,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArenaLogo, Button, Card } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { LOCAL_FLAG_KEYS, useLocalFlag } from '@/hooks/use-local-flags';
import { haptics } from '@/lib/haptics';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<IntroSlide>);

type IntroSlide = {
  body: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  kicker: string;
  title: string;
};

const SLIDES: IntroSlide[] = [
  {
    body: 'A social sports prediction app where your crew gets a weekly fake-money budget and competes on profit. No real money, all bragging rights.',
    icon: 'flame',
    kicker: 'Welcome',
    title: 'Fantasy structure. Betting strategy.',
  },
  {
    body: 'Join or create a league. Get matched up each week. Best record wins.',
    icon: 'shield-checkmark',
    kicker: 'Leagues',
    title: 'Your weekly matchup is the main event.',
  },
  {
    body: 'Straight bets are single picks. Parlays combine picks for higher risk and higher reward. Teasers buy extra points for safer picks at lower odds.',
    icon: 'pulse',
    kicker: 'Bet Types',
    title: 'Pick your weapon.',
  },
];

function BetTypeExample({ accent, label, value }: { accent: string; label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
      <View className="mb-2 h-1.5 w-8 rounded-full" style={{ backgroundColor: accent }} />
      <Text
        className="text-[10px] font-black uppercase text-white/45"
        style={{ letterSpacing: 1.4 }}>
        {label}
      </Text>
      <Text className="mt-1 text-sm font-black text-white">{value}</Text>
    </View>
  );
}

function Slide({
  index,
  item,
  scrollX,
  width,
}: {
  index: number;
  item: IntroSlide;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const isBetSlide = item.kicker === 'Bet Types';

  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          inputRange,
          [-width * 0.25, 0, width * 0.25],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], Extrapolation.CLAMP),
      },
    ],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          inputRange,
          [width * 0.5, 0, -width * 0.5],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(scrollX.value, inputRange, [0.92, 1, 0.92], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <View style={{ width }}>
      <View className="flex-1 justify-center gap-7 px-5">
        <Animated.View style={iconStyle} className="items-center">
          <View
            className="h-24 w-24 items-center justify-center rounded-[28px] border border-electric-green/35 bg-electric-green/10"
            style={{
              shadowColor: THEME_COLORS.electricGreen,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 26,
            }}>
            <Ionicons color={THEME_COLORS.electricGreen} name={item.icon} size={42} />
          </View>
        </Animated.View>

        <Animated.View style={cardStyle}>
          <Card>
            <View className="gap-5">
              <View>
                <Text
                  className="text-[10px] font-black uppercase text-electric-green"
                  style={{ letterSpacing: 3 }}>
                  {item.kicker}
                </Text>
                <Text
                  className="mt-2 text-3xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.7, lineHeight: 34 }}>
                  {item.title}
                </Text>
                <Text className="mt-3 text-base font-semibold leading-6 text-white/60">
                  {item.body}
                </Text>
              </View>

              {isBetSlide ? (
                <View className="flex-row gap-2">
                  <BetTypeExample accent={THEME_COLORS.electricGreen} label="Straight" value="Chiefs -3.5" />
                  <BetTypeExample
                    accent={THEME_COLORS.amberAccent}
                    label="Parlay"
                    value="3 picks × bigger payout"
                  />
                  <BetTypeExample accent={THEME_COLORS.cyanAccent} label="Teaser" value="-7.5 → -1.5" />
                </View>
              ) : null}
            </View>
          </Card>
        </Animated.View>
      </View>
    </View>
  );
}

function PageDot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, inputRange, [8, 32, 8], Extrapolation.CLAMP),
    opacity: interpolate(scrollX.value, inputRange, [0.35, 1, 0.35], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      className="h-2 rounded-full bg-electric-green"
      style={animatedStyle}
    />
  );
}

function BackdropAccent({
  scrollX,
  width,
}: {
  scrollX: SharedValue<number>;
  width: number;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          [0, (SLIDES.length - 1) * width],
          [-width * 0.2, width * 0.2],
        ),
      },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          backgroundColor: 'rgba(0,255,135,0.07)',
          borderRadius: 999,
          height: width * 1.4,
          left: -width * 0.4,
          opacity: 0.6,
          position: 'absolute',
          top: -width * 0.6,
          width: width * 1.4,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<IntroSlide>>(null);
  const onboardingFlag = useLocalFlag(LOCAL_FLAG_KEYS.onboardingComplete);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const finish = async () => {
    haptics.medium();
    await onboardingFlag.markComplete();
    router.replace('/signup');
  };

  const goNext = () => {
    if (isLast) {
      void finish();
      return;
    }

    haptics.light();
    listRef.current?.scrollToIndex({ animated: true, index: index + 1 });
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) {
      haptics.selection();
      setIndex(next);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-arena-bg">
      <BackdropAccent scrollX={scrollX} width={width} />

      <View className="flex-row items-center justify-between px-5 pt-2">
        <ArenaLogo eyebrow="ACTION · ARENA" size="md" />
        <Pressable hitSlop={10} onPress={() => void finish()}>
          <View className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <Text
              className="text-[10px] font-black uppercase text-white/55"
              style={{ letterSpacing: 1.6 }}>
              Skip
            </Text>
          </View>
        </Pressable>
      </View>

      <AnimatedFlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        keyExtractor={(item: IntroSlide) => item.kicker}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={scrollHandler}
        pagingEnabled
        renderItem={({ item, index: itemIndex }: { index: number; item: IntroSlide }) => (
          <Slide index={itemIndex} item={item} scrollX={scrollX} width={width} />
        )}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      />

      <View className="gap-5 px-5 pb-6">
        <View className="flex-row items-center justify-center gap-2">
          {SLIDES.map((slide, slideIndex) => (
            <PageDot index={slideIndex} key={slide.kicker} scrollX={scrollX} width={width} />
          ))}
        </View>
        <Button onPress={goNext} title={isLast ? 'Create Account' : 'Next'} />
      </View>
    </SafeAreaView>
  );
}
