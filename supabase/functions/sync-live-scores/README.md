# sync-live-scores

Poll this Edge Function once per minute during NFL game windows.

It queries `live_score_polling_candidates()` first and skips The Odds API request when there are no games near kickoff, in progress, or at halftime. When a game is written as `final` in `live_game_states`, it drops out of the candidate set.

Required secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ODDS_API_KEY` or `EXPO_PUBLIC_ODDS_API_KEY`
- Optional `LIVE_SCORES_CRON_SECRET`, passed as `x-live-scores-secret`
