import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function TermsPage() {
  return (
    <PageStub
      description="Terms of service."
      route={ROUTES.terms}
      title="Terms"
    />
  );
}
