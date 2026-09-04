import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function SeasonPassPage() {
  return (
    <PageStub
      description="Season Pass benefits and purchase placeholder."
      route={ROUTES.seasonPass}
      title="Season Pass"
    />
  );
}
