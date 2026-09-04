# Action Arena — Marketing Intake

## Product summary
- **Tagline:** The private NFL pick league your group chat runs all season.
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
- Distribution target per `app.json` and README: iOS-first (tablet supported).

## Distribution model
Native consumer mobile app — iOS-first launch via the App Store. No web version.

## Monetization
Free-to-play with planned freemium cosmetic monetization. No gameplay feature is gated behind payment — leagues, picks, matchups, chat, leaderboards, history, and profiles are all free with no caps.

Planned (not yet live) paid surfaces:
- **Arena Coin packs** — Starter Stack 500 coins / $4.99 USD, Playmaker Pack 1,200 coins / $9.99 USD, Commissioner Vault 2,800 coins / $19.99 USD. Arena Coins unlock cosmetic items only and have no monetary value.
- **Season Pass** — gates exclusive cosmetics, advanced analytics, future ad hooks, and 30-minute early Bet Board access. [TODO: confirm Season Pass price point — not present in `constants/cosmetics.ts`.]

Per `AGENTS.md`: "Payment processing and ad SDKs are not integrated yet. Purchase buttons use placeholders, and ad hooks only log events." So at launch the app may ship free-only with IAPs added in a follow-up. [TODO: confirm whether v1.0 ships with Apple IAP enabled or in a placeholder "coming soon" state.]

## Compliance considerations
- **Apple Guideline 5.3 (Gaming, Gambling, Lotteries):** Marketing must position the product as fantasy sports, not gambling. Per `docs/app-store-submission.md`, the App Store keywords explicitly **avoid**: *betting, bet, wager, sportsbook, odds*. Approved keyword set: fantasy sports, fantasy football, sports prediction, fantasy league, NFL fantasy, weekly matchups, sports picks.
- **Category positioning:** Submit as Sports primary / Games secondary. Do **not** select any gambling category.
- **No-money disclosure is a core compliance requirement:** no real-money entry, no real-money cash out, no in-app prize fulfillment, no external sportsbook links. League-side prizes (if any) are arranged outside the app by the commissioner. This needs to be explicit in App Store submission copy and the landing page compliance footer. Web marketing and paid advertising should lead with positive value (private leagues, friend competition, weekly stakes) and surface the not-gambling positioning through product framing, not explicit disclaimers.
- **Age rating:** Submitted as 12+ minimum.
- **NFL trademarks:** The app uses NFL team names and game data via The Odds API. [TODO: confirm whether marketing creative can use NFL team marks, logos, or just generic football imagery — depends on Odds API license terms and any direct NFL/team licensing.]
- **Ad targeting:** Even though sports betting / DFS ad networks have higher CPMs, paid acquisition channels should target fantasy-sports audiences. Running on gambling-adjacent ad inventory or using sportsbook-style creative could jeopardize the App Store "not gambling" positioning.
- **Geographic restrictions:** [TODO: confirm whether the app is launching US-only or worldwide — fantasy/prediction product positioning interacts with local laws differently per region.]
- **Marketing claims to avoid:** any "win money," "cash out," "payout," "odds boost," "sportsbook" framing. Profit/payout language inside the app refers to virtual coins only; external marketing should mirror that framing.

## Template family decision
**Primary: Family 4 (Playful product-showcase). Alternative: Family 1 (Cinematic-immersion).**

## Rationale

Action Arena is already a Family 4 implementation in production: the existing semantic palette where amber means Parlay, cyan means Teaser, gold means Lock-of-the-Week, electric-green means wins, and coral-red means losses is exactly the "bright saturated palette that shifts per state" the family describes, and `font-black` at 444 usages is the "condensed display typography (Anton, Bebas Neue, Druk)" instinct showing up without a display face actually loaded. The audience reinforces this. Friend groups picking parlays and bragging in league chat sit in the gaming-character-selection / toy-collectibles register, not the AI-startup-launch register Family 1 reads as. Family 1 carries a real second problem: dark cinematic stadium footage with glassmorphic odds chrome is exactly how FanDuel and DraftKings advertise, which is the visual language Apple Guideline 5.3 review is built to flag, and your own submission doc already lists the words to avoid (betting, wager, sportsbook, odds). Family 1 stays as the alternative only because your existing dark palette and colored-glow shadows could go cinematic with the right NFL b-roll, but Family 4 carries less compliance risk and is closer to the product's actual identity. Family 3 is the wrong audience entirely. Family 2 (editorial magazine) is the wrong register for league trash talk. The Guide itself maps the call: "Family 4 ... is relevant for Action Arena's pick selection moments."

## Patterns to use

**1. Stateful multi-role carousel choreography for pick-type selection.** Three roles (center, left, right) for Straight, Parlay, Teaser. As the marketing hero rotates, every card transitions position, scale, blur, and opacity simultaneously. The Guide flags this exact use case: "Applicable in your stack to Glow Index product comparisons ... and Action Arena's pick selection." On static surfaces (App Store screenshots, paid social), use the center-stage frame of the same composition.

**2. Background color tied to content state, paired with the carousel.** The amber/cyan/gold tokens are already first-class. As the active pick rotates, the page background warms toward amber for Parlay, cools toward cyan for Teaser, glows gold for Lock-of-the-Week. "The whole world reacts to your selection." This is free reuse of tokens you already own and it visually argues "fantasy game, not sportsbook" because sportsbooks lean monochrome dark with green money-in / red money-out, never warm/cool world shifts.

**3. Ghost text layered display typography.** Giant condensed-display backdrop reading "LOCK", "PARLAY", "WEEK 7", "ARENA" sized with `clamp(90px, 28vw, 380px)` at weight 700-900. Foreground bet cards overlap via z-index. This is the sports-broadcast feel made explicit. Pairs naturally with the carousel because the ghost text stays fixed while the carousel rotates beneath it.

**4. Load a display face from the Family 4 set.** Right now there is no display font loaded, so headings render in SF Pro / Roboto and the "broadcast feel" intent is doing 60% of the work it could. Bebas Neue is the pragmatic pick (free via Google Fonts, condensed, broadcast-coded, no licensing risk for a free-to-play launch). Druk is the premium pick but costs ~$200+ per weight from Commercial Type. Anton is the middle option. SpaceMono can stay bundled and finally get a job: monospace odds and score readouts on the marketing site, which justifies keeping the weight you're already shipping.

**5. Animation lock plus image preload on mount.** The unglamorous pair that separates a polished carousel from one that stutters. Boolean `isAnimating` flag with a 650ms `setTimeout` release prevents rapid clicks from breaking in-flight transitions. `new Image()` preload of every pick-type background on mount means rotations never reveal a blank frame. Cheap to implement, very visible if missing.

One caveat worth flagging up front: the Guide is scoped to marketing surfaces (landing page, App Store creative, HyperFrames/Remotion video for paid social). The in-app pick screen lives in the mobile-app UX zone the Guide explicitly excludes, so these patterns inform Action Arena's marketing site and launch teasers, not the React Native app itself. The semantic color system is the bridge: it lives in both places and is what makes the marketing visually continuous with the product.

## Audience personas

### Primary — Marcus, 31, the league commissioner
Senior software engineer at a mid-size SaaS company in Austin. Has run the same 10-person redraft fantasy football league with college friends for seven seasons; he's the commissioner who manages the Sleeper league, sets the entry fee on Venmo, and writes the weekly recap thread.

- **Day-in-the-life context where this product fits:** Sunday mornings he's already in "league mode" — coffee, laptop, RotoWire tabs open, group chat going. By 12:55 ET he wants something to *do* with friends during the early window beyond watching scores tick over on the ESPN app. Action Arena is the second tab he opens for the next 16 weeks: pick the slate, lock the Lock-of-the-Week, talk shit in league chat as games settle.
- **Existing tools/habits this product replaces or extends:** Replaces nothing wholesale — extends Sleeper (where the *roster* league lives) by adding a prediction-strategy layer his friends can play in parallel. Replaces the "ad hoc parlay screenshot dropped in group chat" ritual that currently lives in iMessage. The DraftKings/FanDuel app exists on his phone but he uses it for $5 entertainment, not "league with friends" — that gap is what Action Arena fills.
- **Trigger moments that would make him try this app:**
  - A friend in his fantasy league posts an Action Arena invite code in the group chat with "I'm running a side league, no money, just bragging rights" — Marcus is in within 30 seconds because the social proof is from inside his trust circle.
  - Mid-season boredom: his fantasy team is 2-7 and he wants a second competition he hasn't already lost.
  - A Reddit r/fantasyfootball thread mentions Action Arena as "Sleeper but for picks" — high-trust subreddit, low-friction install.
- **Objections that would make him not try this app:**
  - "Is this just DraftKings with extra steps?" — if the App Store screenshots or first-run experience look anything like a sportsbook, he closes it. He keeps his fantasy world and his betting world separate intentionally.
  - "Will my friends actually play?" — a prediction app is worthless if his league of 10 only gets 3 signups; if onboarding doesn't make group invites trivially viral, he bails.
  - "Another season-long commitment?" — by Week 5 he's already missed two Sleeper waiver claims; he won't add a third weekly ritual unless the time cost is under 5 minutes.
- **Channels where he spends time online:**
  - **X (high)** — follows Adam Schefter, Matthew Berry, Establish The Run analysts. Sunday morning timeline scroll is *the* pre-week ritual. **Prioritize for organic + paid acquisition.**
  - **Reddit (high)** — r/fantasyfootball, r/nfl, r/DynastyFF. Reads daily, posts occasionally. **Prioritize for organic launch posts and ama-style threads.**
  - **YouTube (medium)** — Fantasy Footballers, Pat McAfee clips, 10-min "start/sit Week N" videos on Friday/Saturday. Pre-roll ads land if creative is fantasy-sports-coded.
  - **TikTok (low)** — has the app, doesn't follow sports creators. Algorithm serves him dev humor and home renovation.
  - **Email (medium)** — Sleeper league digests, RotoWire alerts. Will open a "your league started Week 1" transactional email; will not open a marketing newsletter.
  - **Instagram (low)** — friend group lives there but not for sports content.

### Secondary — Priya, 27, the casual league member
Product designer at a Brooklyn agency. Was added to two fantasy leagues by friends three years ago and now runs an auto-draft team in each one. Knows the rosters of maybe four NFL teams cold (her hometown Chiefs plus the three teams that play KC most often). Watches the games in groups, not solo.

- **Day-in-the-life context where this product fits:** Friday afternoon Slack DM from her best friend: "did you submit your picks yet?" She didn't. She has 90 seconds before her standup. She wants an app where she can tap her picks fast, set a Lock based on vibes, and submit — then look smart on Sunday when one of them hits. Action Arena's "$100 budget, pick five things" framing is friendlier to her than Sleeper's free-form roster management because the action is the pick, not the prep.
- **Existing tools/habits this product replaces or extends:**
  - Replaces the "let me ask my coworker who he likes this week" Slack DM with an actual recurring activity she can do in-app.
  - Extends her existing Sleeper auto-draft passive participation by giving her a weekly engagement loop that doesn't require studying matchups all week.
  - Doesn't touch DraftKings/FanDuel — she has never installed a sportsbook and explicitly doesn't want to ("the apps feel gross").
- **Trigger moments that would make her try this app:**
  - A TikTok or Instagram Reel from a friend whose vibe she trusts ("I'm finally winning my fantasy league because of this side game") — visual social proof on the platform she actually uses.
  - Group chat invite with one tap to join — if the join flow takes more than 20 seconds she abandons mid-flow.
  - A friend who's already on the app posts a winning matchup screenshot in iMessage with the celebration animation visible — the WinCelebration is what would actually pull her in.
- **Objections that would make her not try this app:**
  - **Anything that smells like gambling.** Hard line. "Bet," "wager," "odds boost" in the marketing copy and she closes the App Store page. She needs the not-gambling reassurance available through product framing (fantasy league language, weekly budgets as game mechanic) and through the soft compliance footer, but it shouldn't be the lead. If the first marketing impression is 'this isn't a sportsbook,' she registers defensive; if the first impression is 'private league with your friends,' she registers a different product category entirely.
  - Complexity in onboarding — if she has to learn what "teaser" means before placing her first pick, she's out.
  - "Just men yelling about football" energy in the app or marketing. If the screenshots are all male avatars, gold/red carnage, sportsbook-style numbers, she doesn't see herself in it.
  - Notifications spam — one push per week is fine, three is uninstall territory.
- **Channels where she spends time online:**
  - **TikTok (high)** — daily, algorithm is dialed in to design content, lifestyle, and her friends' reposts. **Prioritize for paid acquisition with friend-recommendation-style creative.**
  - **Instagram (high)** — Stories and Reels, also where her friend group plans plans. **Prioritize for organic launch and Stories ads.**
  - **YouTube (medium)** — watches but mostly long-form leisure (vlogs, design talks). Pre-roll viable if creative is short and friend-coded.
  - **X (low)** — deleted it during the 2023 rebrand and never came back.
  - **Email (low)** — only opens transactional. Marketing emails go straight to a "Promotions" tab she never visits.
  - **Reddit (low)** — uses it for product research, not sports.

### Edge case — Tyler, 19, the college freshman who can't legally bet
First-year at a Big Ten school in a state where mobile sportsbooks are legal at 21 but he's two years short. Pledged a fraternity that runs a "house parlay pool" using a shared Google Sheet where guys throw in $10 and the captain picks. His group chat is full of FanDuel parlay screenshots from the older brothers; he's the only one on his floor who can't legally place one.

- **Day-in-the-life context where this product fits:** Saturday morning he's in the lounge watching College GameDay with the floor, but the conversation has already moved to the NFL side bets the older guys placed. Action Arena gives him a way to play in the same conversation — same parlays, same Lock-of-the-Week ritual — without needing a real-money account he can't open. Sunday Red Zone in the common room, he's tapping legs on his phone alongside everyone else.
- **Existing tools/habits this product replaces or extends:**
  - Replaces the "fake parlay screenshot" he posts in group chats from a sportsbook account he doesn't have. Replaces the unofficial Google Sheet his fraternity uses for the house pool.
  - Extends Sleeper / ESPN Fantasy (he plays in one league with his high school friends), but the prediction format fits his attention span and budget better than weekly roster management does.
  - Could replace the half-joking "Venmo me $5 if Mahomes throws over 2.5 TDs" side bets that float around the floor.
- **Trigger moments that would make him try this app:**
  - A TikTok of someone in the same situation ("here's how my fraternity runs a season-long pick league without the Google Sheet") — direct mirror of his exact problem.
  - A Twitch streamer or YouTuber in the gaming-adjacent sports content space (Pat McAfee, Jomboy, Barstool-without-the-sportsbook-affiliation) demoing a league on stream.
  - Word of mouth on his college campus once one floor mate gets in — install rate goes near-vertical within a friend group when the network effect kicks in.
- **Objections that would make him not try this app:**
  - **"Fake bets are for losers."** The single biggest social risk. If the older guys in his frat dismiss Action Arena as kiddie sportsbook, he won't open it in front of them. Marketing needs to position this as a *league competition*, not "practice mode for when you turn 21."
  - No real stakes feel — if the WinCelebration and standings don't actually feel meaningful, he'll go back to fantasy.
  - Privacy/parents — uses his real name on the app store, doesn't want a transaction history his parents see if they check his Apple account.
  - Boring cosmetics — if the locker rewards look generic, the "what am I playing for" question goes unanswered. He's spent $40 on a Fortnite skin; he understands cosmetic value but the bar is set by games he already plays.
- **Channels where he spends time online:**
  - **TikTok (very high)** — primary content channel, sports + comedy + frat-coded creators. **Top priority for any campaign targeting under-21.**
  - **Instagram (high)** — Stories and DMs are his social graph; Reels are the discovery layer.
  - **Twitch / YouTube (medium-high)** — watches Kick / Twitch sports streams, Pat McAfee clips on YouTube, gaming streams in the same session. Mid-roll and stream-sponsorship creative would land.
  - **Discord (high)** — his fraternity and his gaming group both live there. Discord server bots and integration would be hugely sticky if Action Arena ever offers them (out of scope for v1, worth flagging for v2).
  - **X (medium)** — follows accounts, rarely posts. Sports Twitter is where the older guys send him clips.
  - **Email (very low)** — opens nothing. Push notification is the only direct channel that works.
  - **Reddit (medium)** — lurks r/CFB and r/nfl during games, posts almost never.

## Distribution scope

For this app, the following Phase 2 sections apply:

- [ ] **2.1 Landing page hero** — yes — **P0**. Canonical "what is this" surface that every paid TikTok/Instagram/X click needs to land on. Also doubles as the destination for App Store reviewer external references and for the "not a sportsbook" positioning page that compliance leans on. Cannot launch without it.
- [ ] **2.2 App Store screenshots** — yes **P0**. iOS-first launch per `app.json` and README, so iOS screenshots are required for submission.
- [ ] **2.3 App Store preview video** — yes **P0**. App Store preview video is one of the highest-leverage conversion levers in the Sports category and we already have the strongest possible asset: the `WinCelebration` moment (top-ranked in `COMPONENTS.md`). iOS preview ships with v1.
- [ ] **2.4 Social reels (TikTok/Reels)** — yes — **P0**. TikTok + Instagram Reels is the primary acquisition channel for Priya (secondary) and Tyler (edge case), who together represent the larger addressable audience. Friend-recommendation-style creative ("my fraternity does this," "my group chat plays this") maps directly to the personas' trigger moments. Multiple cuts needed for A/B; ship at least 3 hooks at launch.
- [ ] **2.5 X launch thread** — yes — **P0**. Marcus (primary commissioner persona) lives on Sunday-morning Sports Twitter. A launch thread with the `Bet Board` and `WinCelebration` hero clips, posted into the r/fantasyfootball / Sports Twitter ecosystem on a Friday before a marquee NFL week, is the single highest-leverage organic touch for the 30+ commissioner cohort. Quote-tweet-friendly format; pin to profile through Week 1.
- [ ] **2.6 Email or SMS launch announcement** — **no**. Skip section. No list exists, no acquisition email infrastructure noted in the repo, and per the personas email is a dead channel for the secondary and edge audiences. Marcus would open a transactional "your league started Week 1" email *inside the product*, but that's product lifecycle, not launch marketing. Revisit post-launch only if a waitlist or referral list materializes.
- [ ] **2.7 LinkedIn post** — **no**. Action Arena is a free-to-play B2C product with no B2B angle, no enterprise sales motion, no recruiting story tied to launch. LinkedIn audience does not map to any of the three personas. Founder-personal-post asking the network to share the App Store link is fine as a courtesy day-of-launch but doesn't warrant a Phase 2 workstream.

**Launch P0 stack:** Landing page + iOS App Store creative (screenshots + preview video) + TikTok/Reels cuts + X launch thread. Everything else is P1 or skipped.
