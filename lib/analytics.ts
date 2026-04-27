export type AnalyticsEventName =
  | 'league_created'
  | 'league_joined'
  | 'bets_placed'
  | 'bet_settled'
  | 'matchup_viewed'
  | 'profile_viewed'
  | 'chat_message_sent'
  | 'bet_shared_to_chat'
  | 'shop_viewed'
  | 'shop_item_previewed'
  | 'cosmetic_purchased'
  | 'cosmetic_equipped'
  | 'coin_store_viewed'
  | 'season_pass_screen_viewed'
  | 'season_pass_redeemed'
  | 'ad_hook_triggered'
  | 'rewarded_unlock_triggered';

export type AnalyticsPayload = Record<string, boolean | number | string | null | undefined>;

export function logAnalyticsEvent(name: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter((entry): entry is [string, boolean | number | string | null] => {
      const [, value] = entry;
      return value !== undefined;
    }),
  );

  console.info('[analytics]', name, {
    ...sanitizedPayload,
    timestamp: new Date().toISOString(),
  });
}
