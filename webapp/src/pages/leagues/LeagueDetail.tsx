import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function LeagueDetailPage() {
  return (
    <PageStub
      description="Standings, slate, members and chat for one league."
      route={ROUTES.league}
      title="League Detail"
    />
  );
}
