import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function BetDetailPage() {
  return (
    <PageStub
      description="One placed pick with every leg, line and settlement result."
      route={ROUTES.bet}
      title="Pick Detail"
    />
  );
}
