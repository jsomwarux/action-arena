import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function ResetPasswordPage() {
  return (
    <PageStub
      description="Set a new password from a reset link."
      route={ROUTES.resetPassword}
      title="Reset Password"
    />
  );
}
