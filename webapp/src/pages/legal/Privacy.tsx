import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function PrivacyPage() {
  return (
    <PageStub
      description="Privacy policy."
      route={ROUTES.privacy}
      title="Privacy"
    />
  );
}
