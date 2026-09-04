import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function LoginPage() {
  return (
    <PageStub
      description="Email and password sign-in."
      route={ROUTES.login}
      title="Log In"
    />
  );
}
