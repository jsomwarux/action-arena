import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function LeaguesIndexPage() {
  return (
    <PageStub
      description="Every league this player belongs to."
      route={ROUTES.leagues}
      title="Leagues"
    />
  );
}
