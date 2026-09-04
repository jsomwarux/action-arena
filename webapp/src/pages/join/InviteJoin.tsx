import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function InviteJoinPage() {
  return (
    <PageStub
      description="Resolve a shared invite code and join the league behind it."
      route={ROUTES.invite}
      title="Join by Invite"
    />
  );
}
