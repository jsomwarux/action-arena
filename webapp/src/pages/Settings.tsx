import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function SettingsPage() {
  return (
    <PageStub
      description="Account, display and league preferences."
      route={ROUTES.settings}
      title="Settings"
    />
  );
}
