import { createClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';
import type { Database } from '@/types/database';

/**
 * Browser Supabase client for the web app.
 *
 * Points at the same Supabase project as the mobile app — same schema, same
 * RLS policies, same Edge Functions. Nothing about the backend changes for web.
 *
 * Follows the `isSupabaseConfigured` guard pattern from the mobile
 * lib/supabase.ts: when env vars are missing we still construct a client
 * against a placeholder URL so imports never throw at module load, and callers
 * branch on `isSupabaseConfigured` to show a configuration error instead of
 * firing doomed requests.
 */

const hasValidSupabaseUrl = /^https?:\/\//.test(SUPABASE_URL);

export const isSupabaseConfigured = hasValidSupabaseUrl && SUPABASE_ANON_KEY.length > 0;

const supabaseUrl = hasValidSupabaseUrl ? SUPABASE_URL : 'https://not-configured.invalid';
const supabaseAnonKey = SUPABASE_ANON_KEY.length > 0 ? SUPABASE_ANON_KEY : 'anon-key-not-configured';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    // supabase-js owns the recovery URL. It consumes the implicit
    // `#access_token=…` fragment and a verifier-backed `?code=` during client
    // init, then rewrites the address bar — so nothing else in the app may
    // parse those. See the ownership note at the top of lib/auth-redirects.ts,
    // which covers only the shapes auth-js leaves behind.
    detectSessionInUrl: true,
    persistSession: true,
    storage: window.localStorage,
    storageKey: 'action-arena-web-auth',
  },
});
