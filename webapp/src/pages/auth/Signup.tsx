import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function SignupPage() {
  return (
    <PageStub
      description="Create an account and claim a display name."
      route={ROUTES.signup}
      title="Sign Up"
    />
  );
}
