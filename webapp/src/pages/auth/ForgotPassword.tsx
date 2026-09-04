import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function ForgotPasswordPage() {
  return (
    <PageStub
      description="Request a password reset email."
      route={ROUTES.forgotPassword}
      title="Forgot Password"
    />
  );
}
