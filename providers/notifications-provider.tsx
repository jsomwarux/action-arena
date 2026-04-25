import type { PropsWithChildren } from 'react';

import { useRegisterPushNotifications } from '@/hooks/use-notifications';

export function NotificationsProvider({ children }: PropsWithChildren) {
  useRegisterPushNotifications();

  return children;
}
