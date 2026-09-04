import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function NotificationsPage() {
  return (
    <PageStub
      description="Notification preferences and delivery channels."
      route={ROUTES.notifications}
      title="Notifications"
    />
  );
}
