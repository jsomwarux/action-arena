import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function PicksPage() {
  return (
    <PageStub
      description="Week slate with straight, parlay and teaser building against the $100 weekly budget."
      route={ROUTES.picks}
      title="Pick Board"
    />
  );
}
