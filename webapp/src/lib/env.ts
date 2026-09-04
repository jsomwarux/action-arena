/**
 * The single entry point for environment configuration in webapp/.
 *
 * Every `import.meta.env` read lives here — no other module in webapp/ should
 * touch it directly. Vite inlines these at build time, so anything exported
 * from this file ships to the browser: public values only, never a service
 * role key.
 *
 * Mobile reads the same underlying values through EXPO_PUBLIC_* variables in
 * the repo root .env; the web equivalents are VITE_* in webapp/.env.
 */

function readString(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readBoolean(value: string | undefined): boolean {
  return readString(value).toLowerCase() === 'true';
}

/** Supabase project URL. Same project the mobile app uses. */
export const SUPABASE_URL = readString(import.meta.env.VITE_SUPABASE_URL);

/** Supabase anon (publishable) key. Row Level Security is the access boundary. */
export const SUPABASE_ANON_KEY = readString(import.meta.env.VITE_SUPABASE_ANON_KEY);

/**
 * The Odds API key.
 *
 * TODO(webapp): temporary. Remove once the fetch-odds Supabase Edge Function
 * proxy ships and the browser stops calling The Odds API directly.
 */
export const ODDS_API_KEY = readString(import.meta.env.VITE_ODDS_API_KEY);

/** When true, screens render fixture data instead of hitting Supabase. */
export const USE_MOCK_DATA = readBoolean(import.meta.env.VITE_USE_MOCK_DATA);
