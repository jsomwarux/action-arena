import { createClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

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
 *
 * TODO(webapp): this client is untyped. Phase 2 ports the generated `Database`
 * types and switches this to `createClient<Database>(...)`, at which point
 * every query gets row-level type inference like the mobile app has.
 */

const hasValidSupabaseUrl = /^https?:\/\//.test(SUPABASE_URL);

export const isSupabaseConfigured = hasValidSupabaseUrl && SUPABASE_ANON_KEY.length > 0;

const supabaseUrl = hasValidSupabaseUrl ? SUPABASE_URL : 'https://not-configured.invalid';
const supabaseAnonKey = SUPABASE_ANON_KEY.length > 0 ? SUPABASE_ANON_KEY : 'anon-key-not-configured';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    // Web password-reset and magic links arrive as URL fragments, so unlike
    // the mobile client this must stay on.
    detectSessionInUrl: true,
    persistSession: true,
    storage: window.localStorage,
    storageKey: 'action-arena-web-auth',
  },
});
