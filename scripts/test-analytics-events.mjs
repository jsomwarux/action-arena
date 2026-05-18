import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function readProjectFile(path) {
  return readFileSync(join(rootDir, path), 'utf8');
}

function assertCheck(name, passed, detail = '') {
  if (!passed) {
    failures.push({ detail, name });
  }
}

function hasAll(source, values) {
  return values.every((value) => source.includes(value));
}

function eventIsTyped(eventName) {
  return new RegExp(`\\| '${eventName}'`).test(analyticsSource);
}

const analyticsSource = readProjectFile('lib/analytics.ts');
const straightBetsSource = readProjectFile('hooks/use-straight-bets.ts');
const leaguesSource = readProjectFile('hooks/use-leagues.ts');
const leagueChatSource = readProjectFile('hooks/use-league-chat.ts');
const cosmeticsSource = readProjectFile('hooks/use-cosmetics.ts');
const seasonPassSource = readProjectFile('hooks/use-season-pass.ts');
const shopSource = readProjectFile('app/(app)/shop.tsx');
const coinStoreSource = readProjectFile('app/(app)/coin-store.tsx');
const seasonPassScreenSource = readProjectFile('app/(app)/season-pass.tsx');
const analyticsScreenSource = readProjectFile('app/(app)/analytics.tsx');
const profileSource = readProjectFile('app/(app)/(tabs)/profile.tsx');
const memberProfileSource = readProjectFile('app/(app)/members/[memberId].tsx');
const matchupSource = readProjectFile('app/(app)/(tabs)/matchups/[matchupId].tsx');
const settleBetsSource = readProjectFile('supabase/functions/settle-bets/index.ts');

const requiredEvents = [
  'league_created',
  'league_joined',
  'bets_placed',
  'bet_settled',
  'matchup_viewed',
  'profile_viewed',
  'chat_message_sent',
  'bet_shared_to_chat',
  'shop_viewed',
  'shop_item_previewed',
  'cosmetic_purchased',
  'cosmetic_equipped',
  'coin_store_viewed',
  'season_pass_screen_viewed',
  'season_pass_redeemed',
  'rewarded_unlock_triggered',
];

requiredEvents.forEach((eventName) => {
  assertCheck(
    `26.1 ${eventName} is a typed analytics event`,
    eventIsTyped(eventName),
    'missing from AnalyticsEventName',
  );
});

assertCheck(
  '26.1 create league logs league_created',
  hasAll(leaguesSource, ["logAnalyticsEvent('league_created'", 'league_id: leagueId', 'user_id: userId']),
  'create league mutation should log league id and user id',
);

assertCheck(
  '26.1 join league logs league_joined',
  hasAll(leaguesSource, ["logAnalyticsEvent('league_joined'", 'league_id: leagueId', 'user_id: userId']),
  'join league mutation should log league id and user id',
);

assertCheck(
  '26.1 submit bets logs bets_placed with bet type breakdown',
  hasAll(straightBetsSource, [
    "logAnalyticsEvent('bets_placed'",
    'bet_count: bets.length',
    'straight_count: counts.straight',
    'parlay_count: counts.parlay',
    'teaser_count: counts.teaser',
    'week_number: weekNumber',
  ]),
  'submit flow should log count, week, and straight/parlay/teaser counts',
);

assertCheck(
  '26.1 settlement logs bet_settled with result and profit fields',
  hasAll(settleBetsSource, [
    "console.info('[analytics]', 'bet_settled'",
    'result: settledBet.result',
    'profit: settledBet.profit',
    'bet_id: settledBet.id',
    'settled_bets:',
  ]),
  'settlement Edge Function should log per-bet result/profit with summary fallback',
);

assertCheck(
  '26.1 matchup detail logs matchup_viewed',
  hasAll(matchupSource, ["logAnalyticsEvent('matchup_viewed'", 'matchup_id:', 'league_id:', 'week_number:']),
  'matchup detail should log matchup id, league id, and week number',
);

assertCheck(
  '26.1 profile screens log profile_viewed',
  profileSource.includes("logAnalyticsEvent('profile_viewed'") &&
    memberProfileSource.includes("logAnalyticsEvent('profile_viewed'") &&
    analyticsScreenSource.includes("logAnalyticsEvent('profile_viewed'"),
  'own profile, member profile, and analytics profile view should log profile_viewed',
);

assertCheck(
  '26.1 chat message logs chat_message_sent',
  hasAll(leagueChatSource, ["logAnalyticsEvent('chat_message_sent'", 'league_id: leagueId', 'user_id: userId']),
  'chat send mutation should log league id and user id',
);

assertCheck(
  '26.1 shared bet logs bet_shared_to_chat',
  hasAll(leagueChatSource, [
    "logAnalyticsEvent('bet_shared_to_chat'",
    'bet_id: bet.id',
    'bet_type: bet.bet_type',
    'league_id: bet.league_id',
  ]),
  'bet share mutation should log bet id, bet type, and league id',
);

assertCheck(
  '26.1 shop open logs shop_viewed',
  hasAll(shopSource, ["logAnalyticsEvent('shop_viewed'", 'category', 'user_id: user?.id']),
  'shop screen should log selected category and user',
);

assertCheck(
  '26.1 item preview tap logs shop_item_previewed',
  hasAll(shopSource, [
    "logAnalyticsEvent('shop_item_previewed'",
    'accessibilityLabel={`Preview ${item.name}`}',
    'item_id: item.id',
    'category: item.category',
    'coin_cost: item.cost',
  ]),
  'cosmetic preview should be tappable and log item metadata',
);

assertCheck(
  '26.1 cosmetic purchase logs category and coin cost',
  hasAll(cosmeticsSource, [
    "logAnalyticsEvent('cosmetic_purchased'",
    'category: item?.category',
    'coin_cost: item?.cost',
    'item_id: itemId',
  ]),
  'purchase mutation should log category, coin cost, and item id',
);

assertCheck(
  '26.1 cosmetic equip logs cosmetic_equipped',
  hasAll(cosmeticsSource, ["logAnalyticsEvent('cosmetic_equipped'", 'category: item?.category', 'item_id: itemId']),
  'equip mutation should log category and item id',
);

assertCheck(
  '26.1 coin store logs coin_store_viewed',
  hasAll(coinStoreSource, ["logAnalyticsEvent('coin_store_viewed'", 'user_id: user?.id']),
  'coin store should log view event with user id',
);

assertCheck(
  '26.1 Season Pass screen logs season_pass_screen_viewed',
  hasAll(seasonPassScreenSource, [
    "logAnalyticsEvent('season_pass_screen_viewed'",
    'season_year: CURRENT_SEASON_YEAR',
    'user_id: user?.id',
  ]),
  'Season Pass screen should log season year and user id',
);

assertCheck(
  '26.1 Season Pass redeem logs season_pass_redeemed',
  hasAll(seasonPassSource, [
    "logAnalyticsEvent('season_pass_redeemed'",
    'code: code.trim().toUpperCase()',
    'season_year: seasonYear',
  ]),
  'redeem mutation should log normalized code and season year',
);

assertCheck(
  '26.1 rewarded analytics unlock logs rewarded_unlock_triggered',
  hasAll(analyticsScreenSource, [
    "logAnalyticsEvent('rewarded_unlock_triggered'",
    "placement: 'advanced_analytics'",
    'user_id: user?.id',
  ]),
  'rewarded unlock should log placement and user id',
);

const legacyEventNames = ['picks_submitted', 'pick_settled', 'pick_shared_to_chat'];
legacyEventNames.forEach((eventName) => {
  assertCheck(
    `26.1 legacy event ${eventName} is not logged`,
    ![
      analyticsSource,
      straightBetsSource,
      leagueChatSource,
      settleBetsSource,
    ].some((source) => source.includes(eventName)),
    'use the test-plan event names instead',
  );
});

if (failures.length > 0) {
  console.error('Analytics Events regression failed:');
  failures.forEach((failure) => {
    console.error(`- ${failure.name}${failure.detail ? `: ${failure.detail}` : ''}`);
  });
  process.exit(1);
}

console.log('Test 26 Analytics Events regression passed.');
