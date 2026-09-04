import { useEffect, useState } from 'react';

import { Link, Navigate, useParams } from 'react-router-dom';

import { ArenaLogo, Button, Card } from '@/components/ui';
import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { useAuth } from '@/hooks/use-auth';
import { normalizeInviteCode, storePendingInviteCode } from '@/lib/invite-code';
import { ROUTES } from '@/lib/routes';

/**
 * /join/:inviteCode — the landing page for a shared invite link.
 *
 * This route sits outside RequireAuth on purpose: an invite link is the one
 * in-app URL a signed-out player is expected to open, and the code has to be
 * banked before anything redirects them. Once stored it survives login, signup,
 * and the disclosure gate, because those are full navigations that discard
 * router state (see lib/invite-code.ts).
 *
 * Signed in, this hands straight off to /leagues/join with the code in
 * navigation state.
 */
export function InviteJoinPage() {
  const { inviteCode } = useParams();
  const { isLoading, session } = useAuth();
  const code = normalizeInviteCode(inviteCode);
  const [isStored, setIsStored] = useState(false);

  useEffect(() => {
    if (!code) {
      setIsStored(true);
      return;
    }

    let isMounted = true;

    void storePendingInviteCode(code).finally(() => {
      if (isMounted) {
        setIsStored(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [code]);

  if (!code) {
    return (
      <Card className="p-6">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-coral-red">
              Invite
            </p>
            <h1 className="mt-1 text-2xl font-black uppercase text-white">Code Missing</h1>
            <p className="mt-2 text-sm font-semibold text-white/60">
              That invite link has no code in it. Ask your commissioner to send it again.
            </p>
          </div>
          <Link to={ROUTES.leagueJoin}>
            <Button title="Browse Leagues" />
          </Link>
        </div>
      </Card>
    );
  }

  if (isLoading || !isStored) {
    return <FullPageLoader label="Reading invite" />;
  }

  if (session) {
    return <Navigate replace state={{ inviteCode: code }} to={ROUTES.leagueJoin} />;
  }

  return (
    <div className="flex flex-col">
      <div className="mb-8">
        <ArenaLogo eyebrow="LEAGUE · INVITE" />
        <p className="mt-6 text-base font-semibold text-white/65">
          You have been invited to a league. Sign in to claim your spot.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-electric-green">
              Invite Code
            </p>
            <p className="mt-1 font-mono text-3xl font-black tracking-[0.24em] text-white">{code}</p>
            <p className="mt-3 text-sm font-semibold text-white/60">
              We will hold on to this code and drop you straight into the join flow once you are in.
            </p>
          </div>

          <Link to={ROUTES.login}>
            <Button title="Log In" />
          </Link>
          <Link to={ROUTES.signup}>
            <Button title="Create Account" variant="secondary" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
