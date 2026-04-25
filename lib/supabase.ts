import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import type { Database } from '@/types/database';

type SupabaseAuthStorage = {
  getItem: (key: string) => Promise<string | null> | string | null;
  removeItem: (key: string) => Promise<void> | void;
  setItem: (key: string, value: string) => Promise<void> | void;
};

const envSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const hasValidSupabaseUrl =
  typeof envSupabaseUrl === 'string' && /^https?:\/\//.test(envSupabaseUrl);

export const isSupabaseConfigured =
  hasValidSupabaseUrl && typeof envSupabaseAnonKey === 'string' && envSupabaseAnonKey.length > 0;

const supabaseUrl =
  hasValidSupabaseUrl && envSupabaseUrl ? envSupabaseUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey =
  typeof envSupabaseAnonKey === 'string' && envSupabaseAnonKey.length > 0
    ? envSupabaseAnonKey
    : 'placeholder-anon-key';

const authStorage: SupabaseAuthStorage = AsyncStorage;

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: authStorage,
    },
  },
);
