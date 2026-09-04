import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function MatchupsIndexPage() {
  return (
    <PageStub
      description="This week's head-to-head matchups across your H2H leagues."
      route={ROUTES.matchups}
      title="Matchups"
    />
  );
}
