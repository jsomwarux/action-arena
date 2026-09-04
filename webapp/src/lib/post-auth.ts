import { readPendingInviteCode } from '@/lib/invite-code';
import { ROUTES } from '@/lib/routes';

export type LandingRoute = {
  state?: { inviteCode: string };
  to: string;
};

/**
 * Where a player goes once a gate lets them through — after login, after
 * signup, after acknowledging the disclosure.
 *
 * Mobile always lands on `/`. Web has one extra case: a player who arrived on
 * /join/:inviteCode and had to authenticate first goes to the join-league flow
 * with their code, rather than being dropped on the home screen holding
 * nothing.
 *
 * This only reads the pending code. /leagues/join clears it, so the code
 * survives however many redirects sit between here and there.
 */
export async function resolveLandingRoute(): Promise<LandingRoute> {
  const inviteCode = await readPendingInviteCode();

  if (inviteCode) {
    return { state: { inviteCode }, to: ROUTES.leagueJoin };
  }

  return { to: ROUTES.home };
}
