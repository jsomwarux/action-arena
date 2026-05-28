import type { Session, User } from '@supabase/supabase-js';
import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import {
  createRecoverySessionFromUrl,
  passwordResetRedirectUrl,
} from '@/lib/auth-redirects';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthContextValue = {
  completePasswordReset: (password: string) => Promise<void>;
  createPasswordRecoverySession: (url: string) => Promise<{ email?: string }>;
  isLoading: boolean;
  passwordResetRedirectUrl: string;
  requestPasswordReset: (email: string) => Promise<void>;
  session: Session | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<Session | null>;
  user: User | null;
};

const missingSupabaseConfigMessage =
  'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(missingSupabaseConfigMessage);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }

        if (isMounted) {
          setSession(data.session);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      completePasswordReset: async (password) => {
        ensureSupabaseConfigured();

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
          throw error;
        }
      },
      createPasswordRecoverySession: async (url) => {
        ensureSupabaseConfigured();

        const result = await createRecoverySessionFromUrl(url);
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        setSession(data.session);
        return result;
      },
      isLoading,
      passwordResetRedirectUrl,
      requestPasswordReset: async (email) => {
        ensureSupabaseConfigured();

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: passwordResetRedirectUrl,
        });

        if (error) {
          throw error;
        }
      },
      session,
      signInWithPassword: async (email, password) => {
        ensureSupabaseConfigured();

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }
      },
      signOut: async () => {
        ensureSupabaseConfigured();

        const { error } = await supabase.auth.signOut();

        if (error) {
          throw error;
        }
      },
      signUpWithPassword: async (email, password, displayName) => {
        ensureSupabaseConfigured();

        const { data, error } = await supabase.auth.signUp({
          email,
          options: {
            data: {
              display_name: displayName,
            },
          },
          password,
        });

        if (error) {
          throw error;
        }

        return data.session;
      },
      user: session?.user ?? null,
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
