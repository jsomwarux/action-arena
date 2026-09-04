import type { PropsWithChildren } from 'react';

import { Navigate, useLocation } from 'react-router-dom';

import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { useAuth } from '@/hooks/use-auth';
import { hasSeenActionArenaDisclosure } from '@/hooks/use-disclosure';
import { ROUTES } from '@/lib/routes';

export type RequireAuthProps = PropsWithChildren<{
  /**
   * Set on /disclosure itself, which has to render for a player who has not
   * acknowledged it yet. Everything else stays behind the gate.
   */
  allowBeforeDisclosure?: boolean;
}>;

/**
 * Port of the guards in app/(app)/_layout.tsx: wait out the session read, send
 * signed-out players to /login, and hold everyone at /disclosure until they
 * have acknowledged it.
 *
 * The one addition over mobile is `state.from`. Mobile's disclosure screen only
 * ever returns to `/` or `/settings`; on web a player can land here mid-flow —
 * following an invite link, say — so the destination rides along and
 * /disclosure hands it back.
 */
export function RequireAuth({ allowBeforeDisclosure = false, children }: RequireAuthProps) {
  const { isLoading, session } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!session) {
    return <Navigate replace to={ROUTES.login} />;
  }

  if (!allowBeforeDisclosure && !hasSeenActionArenaDisclosure(session.user)) {
    return <Navigate replace state={{ from: location }} to={ROUTES.disclosure} />;
  }

  return <>{children}</>;
}
