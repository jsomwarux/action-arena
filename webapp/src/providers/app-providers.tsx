import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { AuthProvider } from '@/providers/auth-provider';

/**
 * Explicit query defaults. `new QueryClient()` inherits TanStack v5's, and two
 * of them are wrong for this app — one of them only on the web.
 *
 * - **retry.** v5 retries three times with `min(1000 · 2^attempt, 30000)`
 *   backoff, so a failing query spends ~7s in a skeleton before it settles into
 *   error. This app's dominant failure mode is an RLS denial or a Postgres
 *   `raise exception` — deterministic, and identical on the fourth attempt. One
 *   retry covers a dropped connection; more only buys the player seven seconds
 *   of a loading state that was never going to resolve.
 * - **refetchOnWindowFocus.** Mobile has the byte-identical `new QueryClient()`,
 *   but React Native has no window-focus event and no `focusManager` binding, so
 *   the default is inert there. In a desktop browser, where tab-switching is
 *   constant, every return to the tab restarted the whole retry cycle. Same line
 *   of code, different behaviour after the port.
 * - **staleTime.** Without one, every mount refetches. 30s is short enough that
 *   navigating back to a screen after doing something shows the new state, and
 *   long enough that walking the sidebar doesn't refetch the same rows. The
 *   genuinely live data — `league_week_reveal_time`, live scores, odds — already
 *   carries its own `refetchInterval`/`staleTime` at the hook.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
