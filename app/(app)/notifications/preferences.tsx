import { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Card, ScreenWrapper, SkeletonLoader, ToggleRow } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import {
  NOTIFICATION_PREFERENCE_LABELS,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notifications';
import type { NotificationPreferencesUpdate, NotificationType } from '@/types/database';

function PreferencesSkeleton() {
  return (
    <View className="gap-3">
      {[0, 1, 2, 3].map((item) => (
        <Card key={item}>
          <View className="gap-3">
            <SkeletonLoader height={18} width="60%" />
            <SkeletonLoader height={40} radius={16} />
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function NotificationPreferencesScreen() {
  const { user } = useAuth();
  const preferencesQuery = useNotificationPreferences(user?.id);
  const updatePreferences = useUpdateNotificationPreferences(user?.id);

  const rows = useMemo(() => NOTIFICATION_PREFERENCE_LABELS, []);

  const togglePreference = async (key: NotificationType, enabled: boolean) => {
    const update: NotificationPreferencesUpdate = { [key]: !enabled };

    try {
      await updatePreferences.mutateAsync(update);
    } catch (error) {
      Alert.alert(
        'Could not update preference',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView
        contentContainerStyle={{ gap: 18, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}>
        <View>
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            <Text
              className="text-[11px] font-semibold uppercase text-electric-green"
              style={{ letterSpacing: 1.2 }}>
              Notifications
            </Text>
          </View>
          <Text
            className="mt-1 text-2xl font-extrabold text-white"
            style={{ letterSpacing: -0.4 }}>
            Alert Control
          </Text>
          <Text className="mt-1 text-sm font-medium text-white/55">
            Tune the moments Action Arena is allowed to interrupt you.
          </Text>
        </View>

        {preferencesQuery.isLoading ? <PreferencesSkeleton /> : null}

        {preferencesQuery.data ? (
          <Card>
            <View className="gap-3">
              {rows.map((row) => (
                <ToggleRow
                  description={row.description}
                  enabled={preferencesQuery.data[row.key]}
                  key={row.key}
                  onToggle={() => togglePreference(row.key, preferencesQuery.data[row.key])}
                  title={row.title}
                />
              ))}
            </View>
          </Card>
        ) : null}

        {preferencesQuery.isError ? (
          <Card>
            <Text className="text-sm font-semibold text-coral-red">
              {preferencesQuery.error instanceof Error
                ? preferencesQuery.error.message
                : 'Unable to load notification preferences.'}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}
