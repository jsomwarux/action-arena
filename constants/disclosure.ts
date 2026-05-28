export const ACTION_ARENA_DISCLOSURE_METADATA_KEY = 'action_arena_disclosure_seen_at';

export const ACTION_ARENA_DISCLOSURE = {
  title: 'How Action Arena Works',
  body:
    'Action Arena is a free-to-play fantasy sports prediction game. Coins, points, standings, and cosmetics are virtual and have no monetary value. No real money is paid, won, or redeemable inside the app, and there are no redemption features or links to real-money sports operators. Any league prizes are arranged outside Action Arena by commissioners.',
  summary:
    'Action Arena is a free-to-play fantasy sports prediction game. No real money is paid, won, or redeemable inside the app.',
  chips: ['Virtual Coins', 'No Cash Out'],
} as const;

export const TERMS_OF_SERVICE_DOCUMENT = {
  title: 'Terms of Service',
  body:
    'Action Arena is for free-to-play fantasy sports predictions only. No real money is paid, won, or redeemable inside the app. Coins, points, standings, rewards, and league results are virtual, have no monetary value, and cannot be exchanged for money or money-equivalent prizes. League prizes, if any, are arranged by commissioners outside Action Arena.\n\nBy creating an account or using Action Arena, you agree to these Terms of Service. Action Arena has no tolerance for objectionable content, abusive users, harassment, threats, hate speech, explicit content, or attempts to intimidate or harm other players. User-generated content, including league chat, league names, team names, and display names, may be reported, reviewed, removed, or restricted. Users who post objectionable content or abuse other players may be blocked, removed from leagues, suspended, or banned.',
  summary:
    'Action Arena is free-to-play, has no cash prizes, and does not tolerate objectionable content or abusive users.',
  chips: ['Free Play', 'No Abuse'],
} as const;

export const PRIVACY_POLICY_DOCUMENT = {
  title: 'Privacy Policy',
  body:
    'Action Arena uses account, league, pick, notification, and cosmetic data to operate the app experience. We do not sell personal data, and no real-money sports operator receives app data from Action Arena.',
  summary:
    'Action Arena uses account, league, pick, notification, and cosmetic data to operate the app experience.',
  chips: ['No Data Sales', 'Account Only'],
} as const;
