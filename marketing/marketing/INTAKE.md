# Action Arena — Marketing Intake

## Product summary
- **Tagline:** Run a private NFL prediction league with friends, no real money.
- **Problem solved:** Friend groups want sportsbook-style strategy and bragging rights without gambling.
- **Core value prop:** Weekly virtual-coin budgets turn straight picks, parlays, and teasers into season-long fantasy competition between friends.

## Key features
- Private or public NFL leagues with head-to-head matchups or cumulative-profit formats, plus league chat.
- Weekly $100 virtual-coin budget with straight picks, parlays, and point-boost teaser picks built off live NFL odds.
- "Lock of the Week" 1.5x multiplier — each member must designate exactly one bet per week as their Lock.
- Live week kickoff, leg-level locking on real game start, and post-game settlement with weekly standings, playoffs, and a season champion.
- Arena Locker cosmetics shop (team logos, lock effects, win celebrations, chat stickers, trophy skins, profile frames) powered by the virtual Arena Coins currency.

## Tech stack
- React Native (0.81) + Expo SDK 54 with Expo Router (file-based routing), TypeScript strict mode.
- NativeWind (Tailwind) for styling, Reanimated for motion, Expo Haptics / Notifications / Blur.
- Supabase (Postgres, Auth, Realtime, Edge Functions) accessed through TanStack Query hooks.
- The Odds API for NFL odds and scores.
- Distribution target per `app.json` and README: iOS-first (tablet supported), Android also configured.

## Distribution model
Native consumer mobile app — iOS-first launch via the App Store with an Android build configured in the same Expo project. No web version. [TODO: confirm whether the Android build is being submitted to Google Play at launch or held back.]

## Monetization
Free-to-play with planned freemium cosmetic monetization. No gameplay feature is gated behind payment — leagues, picks, matchups, chat, leaderboards, history, and profiles are all free with no caps.

Planned (not yet live) paid surfaces:
- **Arena Coin packs** — Starter Stack 500 coins / $4.99 USD, Playmaker Pack 1,200 coins / $9.99 USD, Commissioner Vault 2,800 coins / $19.99 USD. Arena Coins unlock cosmetic items only and have no monetary value.
- **Season Pass** — gates exclusive cosmetics, advanced analytics, future ad hooks, and 30-minute early Bet Board access. [TODO: confirm Season Pass price point — not present in `constants/cosmetics.ts`.]

Per `AGENTS.md`: "Payment processing and ad SDKs are not integrated yet. Purchase buttons use placeholders, and ad hooks only log events." So at launch the app may ship free-only with IAPs added in a follow-up. [TODO: confirm whether v1.0 ships with Apple IAP enabled or in a placeholder "coming soon" state.]

## Compliance considerations
- **Apple Guideline 5.3 (Gaming, Gambling, Lotteries):** Marketing must position the product as fantasy sports, not gambling. Per `docs/app-store-submission.md`, the App Store keywords explicitly **avoid**: *betting, bet, wager, sportsbook, odds*. Approved keyword set: fantasy sports, fantasy football, sports prediction, fantasy league, NFL fantasy, weekly matchups, sports picks.
- **Category positioning:** Submit as Sports primary / Games secondary. Do **not** select any gambling category.
- **No-money disclosure is core to the product story:** no real-money entry, no real-money cash out, no in-app prize fulfillment, no external sportsbook links. League-side prizes (if any) are arranged outside the app by the commissioner. This needs to be explicit in App Store copy, web marketing, and any paid advertising.
- **Age rating:** Submitted as 12+ minimum.
- **NFL trademarks:** The app uses NFL team names and game data via The Odds API. [TODO: confirm whether marketing creative can use NFL team marks, logos, or just generic football imagery — depends on Odds API license terms and any direct NFL/team licensing.]
- **Ad targeting:** Even though sports betting / DFS ad networks have higher CPMs, paid acquisition channels should target fantasy-sports audiences. Running on gambling-adjacent ad inventory or using sportsbook-style creative could jeopardize the App Store "not gambling" positioning.
- **Geographic restrictions:** [TODO: confirm whether the app is launching US-only or worldwide — fantasy/prediction product positioning interacts with local laws differently per region.]
- **Marketing claims to avoid:** any "win money," "cash out," "payout," "odds boost," "sportsbook" framing. Profit/payout language inside the app refers to virtual coins only; external marketing should mirror that framing.
