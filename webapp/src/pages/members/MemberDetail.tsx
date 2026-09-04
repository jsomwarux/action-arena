import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function MemberDetailPage() {
  return (
    <PageStub
      description="Another league member's picks, record and profit."
      route={ROUTES.member}
      title="Member"
    />
  );
}
