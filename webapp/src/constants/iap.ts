// Web has no native app config, so the bundle identifier is always the mobile fallback.
const fallbackIosBundleIdentifier = 'com.actionarena.app';

export const IOS_BUNDLE_IDENTIFIER = fallbackIosBundleIdentifier;

export const SEASON_PASS_PRODUCT_ID = `${IOS_BUNDLE_IDENTIFIER}.seasonpass.allaccess`;

export const ARENA_COIN_PRODUCT_IDS = {
  commissioner: 'com.actionarena.app.coins.commissioner',
  playmaker: 'com.actionarena.app.coins.playmaker',
  starter: 'com.actionarena.app.coins.starter',
} as const;

export type ArenaCoinProductId =
  (typeof ARENA_COIN_PRODUCT_IDS)[keyof typeof ARENA_COIN_PRODUCT_IDS];

export const ARENA_COIN_PRODUCT_IDS_LIST = [
  ARENA_COIN_PRODUCT_IDS.starter,
  ARENA_COIN_PRODUCT_IDS.playmaker,
  ARENA_COIN_PRODUCT_IDS.commissioner,
] as const;
