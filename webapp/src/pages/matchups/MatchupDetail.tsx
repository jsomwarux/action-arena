import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function MatchupDetailPage() {
  return (
    <PageStub
      description="Both sides of one weekly head-to-head matchup, pick by pick."
      route={ROUTES.matchup}
      title="Matchup Detail"
    />
  );
}
