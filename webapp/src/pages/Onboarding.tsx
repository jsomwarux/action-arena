import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function OnboardingPage() {
  return (
    <PageStub
      description="First-run walkthrough before a player reaches the arena."
      route={ROUTES.onboarding}
      title="Onboarding"
    />
  );
}
