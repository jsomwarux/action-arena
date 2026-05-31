export type AnalyticsEventName =
  | 'league_created'
  | 'league_joined'
  | 'league_team_name_updated'
  | 'league_schedule_generated'
  | 'bets_placed'
  | 'bet_settled'
  | 'matchup_viewed'
  | 'profile_viewed'
  | 'chat_message_sent'
  | 'bet_shared_to_chat'
  | 'content_report_created'
  | 'message_report_created'
  | 'user_blocked'
  | 'user_unblocked'
  | 'chat_terms_accepted'
  | 'shop_viewed'
  | 'shop_item_previewed'
  | 'cosmetic_purchased'
  | 'cosmetic_equipped'
  | 'coin_store_viewed'
  | 'season_pass_screen_viewed'
  | 'season_pass_redeemed'
  | 'ad_hook_triggered';

export type AnalyticsPayload = Record<string, boolean | number | string | null | undefined>;

export function logAnalyticsEvent(name: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter((entry): entry is [string, boolean | number | string | null] => {
      const [, value] = entry;
      return value !== undefined;
    }),
  );

  if (__DEV__) {
    console.info('[analytics]', name, {
      ...sanitizedPayload,
      timestamp: new Date().toISOString(),
    });
  }
}
