import { useState } from 'react';

import { ArrowLeft, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PushScopeNotice } from '@/components/notifications/PushScopeNotice';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { Badge, Card, Notice, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import {
  NOTIFICATION_PREFERENCE_LABELS,
  useNotificationPreferences,
  useRegisterPushNotifications,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notifications';
import { ROUTES } from '@/lib/routes';
import type { NotificationPreferencesUpdate, NotificationType } from '@/types/database';

function PreferencesSkeleton() {
  return (
    <Card>
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((key) => (
          <Skeleton height={72} key={key} radius={16} />
        ))}
      </div>
    </Card>
  );
}

/**
 * Port of app/(app)/notifications/preferences.tsx.
 *
 * The eight toggles are mobile's, unchanged, and they write to the same
 * `notification_preferences` row — so a switch flipped in the browser is the
 * switch the iOS app and the process-notifications Edge Function read.
 *
 * What is marked rather than removed is the delivery channel. Every one of
 * these preferences gates *push*, which the web build cannot register for
 * (`useRegisterPushNotifications` reports `isSupported: false` here). Turning
 * one off therefore silences the phone, not this browser: the matching
 * `notification_events` row is still written and still shows up in the in-app
 * list. Saying so plainly beats hiding controls that do real work on the
 * account, and it beats implying a toggle silences a channel it does not
 * touch.
 */
export function NotificationPreferencesPage() {
  const { user } = useAuth();
  const preferencesQuery = useNotificationPreferences(user?.id);
  const updatePreferences = useUpdateNotificationPreferences(user?.id);
  const push = useRegisterPushNotifications();
  const [error, setError] = useState<string | null>(null);

  const preferences = preferencesQuery.data;

  const togglePreference = async (key: NotificationType, enabled: boolean) => {
    const update: NotificationPreferencesUpdate = { [key]: !enabled };
    setError(null);

    try {
      await updatePreferences.mutateAsync(update);
    } catch (updateError) {
      setError(
        `Could not update preference. ${
          updateError instanceof Error ? updateError.message : 'Try again.'
        }`,
      );
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="min-w-0">
        <Link
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50 transition hover:text-white"
          to={ROUTES.notifications}>
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Notifications
        </Link>
        <h1 className="arena-heading mt-2 text-5xl leading-none">Alert Control</h1>
        <p className="mt-2 max-w-2xl text-textMuted">
          Tune the moments Action Arena is allowed to interrupt you.
        </p>
      </header>

      {!push.isSupported ? (
        <Card>
          <PushScopeNotice />
        </Card>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      {preferencesQuery.isLoading ? <PreferencesSkeleton /> : null}

      {preferences ? (
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-green">
                Alert types
              </p>
              <Badge icon={Smartphone} label="iOS push" tone="neutral" />
            </div>

            {NOTIFICATION_PREFERENCE_LABELS.map((row) => (
              <ToggleRow
                description={row.description}
                disabled={updatePreferences.isPending}
                enabled={preferences[row.key]}
                key={row.key}
                onToggle={() => {
                  void togglePreference(row.key, preferences[row.key]);
                }}
                title={row.title}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {preferencesQuery.isError ? (
        <Notice tone="error">
          {preferencesQuery.error instanceof Error
            ? preferencesQuery.error.message
            : 'Unable to load notification preferences.'}
        </Notice>
      ) : null}
    </section>
  );
}
