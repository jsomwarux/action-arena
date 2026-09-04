import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function JoinLeaguePage() {
  return (
    <PageStub
      description="Browse public leagues or enter a 6-character invite code."
      route={ROUTES.leagueJoin}
      title="Join League"
    />
  );
}
