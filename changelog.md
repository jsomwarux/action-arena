# Action Arena Changelog

## 2026-04-25 Session Handoff

This file summarizes the major changes made during the initial build session so future agents can continue from the actual current state instead of rediscovering context.

### Project Foundation

- Initialized a native mobile Expo app for Action Arena.
- Configured Expo Router file-based navigation.
- Added NativeWind/Tailwind styling setup.
- Added TypeScript strict project configuration.
- Added shared app providers for auth, notifications, and query/client state.
- Added `README.md` with setup instructions and `.env.example` with required environment variable names.
- Added `.gitignore` coverage for local secrets, Expo cache, Supabase temp files, native generated folders, and dependency folders.

### Platform Direction

- AGENTS.md now states this is a native mobile app, targeting iOS first.
- No web version is planned for now.
- Verification should prioritize iOS Simulator and Expo Go.

### Navigation

- Built the authenticated app shell with five bottom tabs:
  - Home
  - Leagues
  - Bet Board
  - Leaders
  - Profile
- Added route stubs/screens for:
  - League detail
  - Matchup detail
  - Member profile
  - Create league
  - Join league
  - Bet detail
  - Settings
  - Notification preferences
- The bottom tab bar has been simplified to avoid Reanimated/worklet tab-button crashes. It currently uses standard Expo Router tab behavior with Ionicons.

### Auth and Supabase Client

- Added Supabase JS client configuration through environment variables:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_ODDS_API_KEY`
- Added auth session listener.
- Added email/password signup and login screens.
- Gated the tab navigator behind auth state.
- Stored auth state globally through the auth provider/hook.
- Real `.env` credentials exist locally but are intentionally ignored by git.

### Shared UI Components

- Added reusable UI primitives:
  - Button variants: primary, secondary, destructive
  - Text inputs with labels/errors
  - Card component with dark glass-style surface
  - Screen wrapper with safe area/dark background handling
  - Skeleton loader
  - Bet type badge
  - Bottom sheet
  - Pressable scale
  - Segmented toggle
  - Animated number/bar helpers
  - Swipeable row
  - Toggle row
  - Confetti/live pulse helpers
- Important caveat: some shared UI components use Reanimated. Reanimated is now configured with the Babel plugin, but use care when applying worklet-heavy components to tab screens or large mapped lists.

### Types and Constants

- Added TypeScript database types for:
  - users
  - leagues
  - league_members
  - weekly_matchups
  - bets
  - bet_legs
  - standings
  - chat/notifications/achievements additions
- Added business-rule constants:
  - Weekly budget: `$100`
  - Minimum bets: `5`
  - Max single bet: `$35`
  - Parlay payout cap: `$500`
  - Default league sizes
  - Full teaser odds lookup table
- Added odds conversion and formatting utilities.

### Database and Supabase Backend

- Added Supabase migrations for core schema, settlement backend support, achievements, notifications, and chat.
- Tables/migrations include:
  - users
  - leagues
  - league_members
  - weekly_matchups
  - bets
  - bet_legs
  - standings
  - user achievements
  - notification preferences/events
  - league chat messages
- Added foreign keys, indexes, Row Level Security policies, and auth user trigger for `public.users`.
- Added Supabase Edge Functions:
  - `settle-bets`
  - `process-notifications`
- Edge Functions expect `ODDS_API_KEY` as a Supabase secret.

### League Management

- Built Create League flow:
  - League name
  - H2H vs cumulative explanation
  - Public/private visibility
  - Max members selector
  - Sport selector with NFL as current supported sport
  - Invite code generation
  - Commissioner becomes first member
- Built Join League flow:
  - Direct invite code entry
  - Public league browser
  - Searchable league list with type/member/sport/commissioner details
- Built My Leagues tab:
  - League cards
  - Type badge
  - Rank/record/profit/member count
  - Empty state and create/join CTAs
- Built League Detail hub:
  - Standings
  - Current matchup card
  - Season schedule
  - Members list
  - Invite code copy/share
  - League chat tab
  - Weekly awards display

### Odds and Bet Board

- Added The Odds API integration for upcoming NFL games.
- Fetches h2h, spreads, and totals markets.
- Odds API key is read from Expo public env.
- Added odds caching via TanStack Query.
- Built Bet Board:
  - League selector for users in multiple leagues
  - Weekly budget tracker
  - Upcoming NFL game list
  - Market toggles for Moneyline, Spread, and Over/Under
  - Bet slip bottom sheet
  - Straight bet placement
- Added validation:
  - At least 5 bets
  - Total allocation exactly `$100`
  - No single bet over `$35`
  - Cannot bet on both sides / duplicate same game side within a league
- Submission inserts bets and bet legs into Supabase.
- Placed bets switch the board to a read-only state.
- Individual legs lock at game start.

### Parlay and Teaser Modes

- Added mode switcher:
  - Straight
  - Parlay
  - Teaser
- Parlay builder:
  - 2 to 6 legs
  - No same-game legs
  - Mixed markets allowed
  - Real-time combined odds and potential payout
  - `$500` payout cap warning
- Teaser builder:
  - 6, 6.5, and 7 point options
  - Spread and over/under only
  - 2 to 4 legs
  - Original and adjusted line display
  - Fixed teaser odds lookup table
- Updated bet slip to distinguish straight/parlay/teaser bets with consistent accents.
- Updated confirmation modal for straight, parlay, and teaser details.

### Settlement Logic

- Added backend settlement logic in Supabase Edge Function.
- Fetches completed scores from The Odds API.
- Resolves pending bet legs.
- Rolls leg results up to parent bets:
  - Straight: one leg result
  - Parlay: all-or-nothing with push handling and payout cap
  - Teaser: lookup-table payout with push handling
- Calculates profit and stores result on bets.
- Added weekly matchup resolution:
  - Weekly profit aggregation
  - H2H W/L/T assignment
  - Cumulative total updates
  - Standings update and rank recalculation
- Added schedule-generation backend SQL for round robin and playoff handling.
- Settlement function is designed to be idempotent.

### Home, Matchups, Leaderboard, Profiles

- Built Home dashboard:
  - This Week league cards
  - Action Needed alerts
  - Recent Results feed
  - Weekly awards
  - Quick Bet Board action
- Built Matchup Detail:
  - H2H layout
  - User/opponent bet lists
  - Bet type badges
  - Multi-leg result display
  - Teaser original/adjusted lines
  - Profit comparison bar
  - Past-week navigation support
- Built Profile experience:
  - Season stats
  - Per-league filtering
  - Best and worst bet
  - Bet type breakdowns
  - Bet history filters and pagination
  - Achievements
- Built Member Profile:
  - League-scoped public member stats
  - You vs member comparison
- Built Leaderboard tab:
  - League selector
  - Season/This Week views
  - Ranked rows
  - Current user highlight
  - Empty state with join/create league CTAs

### Push Notifications and Chat

- Added Expo Notifications registration.
- Stores push tokens on user rows.
- Added notification preferences screen.
- Added hooks/providers for notification preferences and token sync.
- Added backend notification processing function.
- Added league chat:
  - Realtime messaging hook
  - Message list support
  - System message support
  - Share bet to chat flow

### Onboarding, Settings, Performance

- Added first-time onboarding screens:
  - What Action Arena is
  - How leagues work
  - Bet type overview
- Stores local flags so onboarding and Bet Board walkthrough do not repeat.
- Added Settings screen:
  - Display name/avatar editing
  - Notification preferences link/toggles
  - Manage leagues / leave league
  - Premium placeholder
  - About, Terms, Privacy placeholders
  - Sign out
- Added pull-to-refresh on major data-driven screens.
- Added skeleton/empty states across major lists.
- Added optimistic update behavior around bet placement.
- Tuned TanStack Query cache behavior for odds and app data.

### Expo Go Crash Fixes

- Initial crashes occurred in Expo Go on iOS Simulator when switching to Leaders/Profile.
- Crash reports showed native Hermes/Reanimated worklet errors:
  - `HermesRuntimeImpl::throwPendingError`
  - `worklets::scheduleOnUI`
  - `UIScheduler::triggerUI`
- Root setup issue: Reanimated 4 was installed but `babel.config.js` did not include the required plugin.
- Fixed by adding:

```js
plugins: ['react-native-reanimated/plugin']
```

- The plugin must remain the final Babel plugin.
- Temporarily removed or simplified worklet-heavy UI on sensitive navigation paths:
  - Leaders tab screen
  - Profile tab screen/profile content
  - Bottom tab button
- Guidance for future UI work:
  - Reanimated can be used, but verify in iOS Simulator.
  - Avoid heavy `entering` animations on large mapped lists.
  - Avoid animated counters/worklet reactions in long tab screens unless tested.
  - After animation changes, run `npx expo start --clear --ios` and switch through all tabs repeatedly.

### GitHub

- Created private GitHub repo:
  - `https://github.com/jsomwarux/action-arena`
- Main branch is `main`.
- Real local `.env` credentials were not committed.
- `.env.example` documents required variable names.

### Verification Performed During Session

- `npm run typecheck` passed repeatedly after major changes.
- Expo iOS bundle compiled successfully via `npx expo start --clear` and direct iOS bundle request.
- `npm test -- --runInBand` could not run because `package.json` does not yet define a `test` script.

### Known Gaps / Next Best Steps

- Add an actual test setup and `test` script.
- Continue UI/UX polish now that the crash source is understood.
- Re-test any restored Reanimated UI in iOS Simulator.
- Validate Supabase Edge Functions against real completed-score payloads.
- Confirm notification delivery end-to-end with Expo push tokens.
- Add seed/demo data or a staging fixture flow for easier simulator testing.
- Consider adding CI for typecheck and lint once the app stabilizes.
