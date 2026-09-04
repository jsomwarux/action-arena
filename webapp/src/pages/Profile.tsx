import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function ProfilePage() {
  return (
    <PageStub
      description="The signed-in player: record, profit history, equipped cosmetics."
      route={ROUTES.profile}
      title="Profile"
    />
  );
}
