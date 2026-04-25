# Action Arena

Action Arena is a native iOS-first Expo app for social sports prediction leagues. Players join leagues, receive a weekly fake-money budget, and compete on profit through straight bets, parlays, and teasers. No real money is wagered.

## Stack

- Expo SDK 54 with Expo Router
- React Native and TypeScript strict mode
- NativeWind for styling
- Supabase Auth, Postgres, Realtime, and Edge Functions
- TanStack Query for Supabase-backed data fetching
- The Odds API for NFL odds and scores

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Fill in:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ODDS_API_KEY`

Start the iOS simulator build:

```bash
npx expo start --clear --ios
```

## Supabase

Database migrations and Edge Functions live in `supabase/`.

Apply migrations after linking a Supabase project:

```bash
supabase db push
```

Set the Odds API secret for Edge Functions:

```bash
supabase secrets set ODDS_API_KEY=your_odds_api_key
```

## Quality Checks

Run TypeScript:

```bash
npm run typecheck
```

There is not a test suite configured yet.
