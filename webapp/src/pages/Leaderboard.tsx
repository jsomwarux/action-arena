import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function LeaderboardPage() {
  return (
    <PageStub
      description="Season standings ranked by total profit."
      route={ROUTES.leaderboard}
      title="Leaderboard"
    />
  );
}
