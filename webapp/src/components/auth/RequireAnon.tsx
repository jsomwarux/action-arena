import type { PropsWithChildren } from 'react';

import { Navigate } from 'react-router-dom';

import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { useAuth } from '@/hooks/use-auth';
import { LOCAL_FLAG_KEYS, useLocalFlag } from '@/hooks/use-local-flags';
import { ROUTES } from '@/lib/routes';

/**
 * Port of app/(auth)/_layout.tsx: a signed-in player never sees an auth screen,
 * and a first-run player sees onboarding before the login form.
 *
 * Mobile carves out /reset-password from both checks with an `isPasswordResetRoute`
 * flag, because a recovery link signs you in on the way to the form. On web the
 * same carve-out is simply that /reset-password is not wrapped in this guard —
 * see src/App.tsx.
 */
export function RequireAnon({ children }: PropsWithChildren) {
  const { isLoading, session } = useAuth();
  const onboardingFlag = useLocalFlag(LOCAL_FLAG_KEYS.onboardingComplete);

  if (isLoading || onboardingFlag.isLoading) {
    return <FullPageLoader />;
  }

  if (session) {
    return <Navigate replace to={ROUTES.home} />;
  }

  if (!onboardingFlag.value) {
    return <Navigate replace to={ROUTES.onboarding} />;
  }

  return <>{children}</>;
}
