import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function AnalyticsPage() {
  return (
    <PageStub
      description="Advanced pick analytics. Season Pass gated."
      route={ROUTES.analytics}
      title="Analytics"
    />
  );
}
