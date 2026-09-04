import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function DisclosurePage() {
  return (
    <PageStub
      description="No real money is ever wagered in Action Arena."
      route={ROUTES.disclosure}
      title="Disclosure"
    />
  );
}
