import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import {
  passwordResetRedirectUrl,
  redeemRecoveryPayload,
  type ManualRecoveryPayload,
  type RecoverySessionResult,
} from '@/lib/auth-redirects';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthContextValue = {
  completePasswordReset: (password: string) => Promise<void>;
  isLoading: boolean;
  passwordResetRedirectUrl: string;
  /**
   * Diverges from mobile's `createPasswordRecoverySession(url)` on purpose.
   *
   * On web, `detectSessionInUrl` has already redeemed anything it recognises by
   * the time a screen mounts, so there is no URL left to hand in. This takes the
   * leftover payload the reset page found instead. See lib/auth-redirects.ts.
   */
  redeemRecoveryLink: (payload: ManualRecoveryPayload) => Promise<RecoverySessionResult>;
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
  'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(missingSupabaseConfigMessage);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
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

    // getSession() awaits the client's initialize() internally, so this also
    // waits out detectSessionInUrl. Once isLoading flips false, a recovery link
    // in the URL has either produced a session or failed — the reset screen
    // relies on that ordering.
    const loadInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (isMounted) {
          setSession(data.session);
        }
      } catch {
        // A failed read is the same as no session for routing purposes; the
        // guards send the player to /login and the screens surface the error.
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        // Nothing cached under the previous player may be shown to the next one.
        queryClient.clear();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      completePasswordReset: async (password) => {
        ensureSupabaseConfigured();

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
          throw error;
        }
      },
      isLoading,
      passwordResetRedirectUrl,
      redeemRecoveryLink: async (payload) => {
        ensureSupabaseConfigured();

        const result = await redeemRecoveryPayload(payload);
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        setSession(data.session);
        return result;
      },
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
