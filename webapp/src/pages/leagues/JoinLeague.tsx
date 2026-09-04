import { useEffect, useState } from 'react';

import { useLocation } from 'react-router-dom';

import { PageStub } from '@/components/layout/PageStub';
import { Card } from '@/components/ui';
import { clearPendingInviteCode, normalizeInviteCode } from '@/lib/invite-code';
import { ROUTES } from '@/lib/routes';

type JoinLeagueLocationState = {
  inviteCode?: string;
} | null;

export function JoinLeaguePage() {
  const location = useLocation();
  const [inviteCode] = useState(() =>
    normalizeInviteCode((location.state as JoinLeagueLocationState)?.inviteCode),
  );

  // The auth flow parks the code in localStorage so it survives login, signup
  // and the disclosure gate; this screen is where it gets spent. Clearing it on
  // arrival stops a stale code from redirecting the next sign-in back here.
  useEffect(() => {
    void clearPendingInviteCode();
  }, []);

  return (
    <PageStub
      description="Browse public leagues or enter a 6-character invite code."
      route={ROUTES.leagueJoin}
      title="Join League">
      {/*
        TODO(league agent): this screen owns the real join flow. The auth agent
        only delivers the invite code here — everything below is scaffolding.

        - `inviteCode` above is the code from /join/:inviteCode, already
          normalised (trimmed, uppercased). It is '' for a plain visit to
          /leagues/join, which is the normal case.
        - Prefill the invite-code TextInput with it, mirroring the local
          `inviteCode` state in app/(app)/leagues/join.tsx.
        - Do not re-read it from storage: `clearPendingInviteCode()` above has
          already consumed it, and the value is held in component state.
        - A hard refresh of this URL loses the prefill by design. That matches
          mobile, which has no prefill at all, and the player can still type the
          code.
      */}
      {inviteCode ? (
        <Card className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-electric-green">
            Invite code delivered
          </p>
          <p className="font-mono text-2xl font-black tracking-[0.24em] text-white">{inviteCode}</p>
          <p className="text-sm text-textMuted">
            Handed over by /join/:inviteCode. Prefill the join form with it.
          </p>
        </Card>
      ) : null}
    </PageStub>
  );
}
