import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function CreateLeaguePage() {
  return (
    <PageStub
      description="Name the league, pick H2H or cumulative, set visibility and size."
      route={ROUTES.leagueCreate}
      title="Create League"
    />
  );
}
