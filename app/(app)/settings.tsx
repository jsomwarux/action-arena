import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  ScreenWrapper,
  SkeletonLoader,
  TextInput,
  ToggleRow,
} from '@/components/ui';
import {
  ACTION_ARENA_DISCLOSURE,
  PRIVACY_POLICY_DOCUMENT,
  TERMS_OF_SERVICE_DOCUMENT,
} from '@/constants/disclosure';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useDeleteAccount } from '@/hooks/use-delete-account';
import { type LeagueSummary, useLeaveLeagueMutation, useMyLeagues } from '@/hooks/use-leagues';
import {
  NOTIFICATION_PREFERENCE_LABELS,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notifications';
import { useProfileData } from '@/hooks/use-profile-stats';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { useSeasonPassPurchase } from '@/hooks/use-season-pass-purchase';
import { useUpdateUserProfile } from '@/hooks/use-user-profile';
import { cn } from '@/lib/cn';
import { formatLeagueType } from '@/lib/format';
import type { NotificationPreferencesUpdate, NotificationType } from '@/types/database';

function SettingsSkeleton() {
  return (
    <View className="gap-4">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <View className="gap-3">
            <SkeletonLoader height={18} width="50%" />
            <SkeletonLoader height={70} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function LeagueManagementRow({
  item,
  onLeave,
}: {
  item: LeagueSummary;
  onLeave: (leagueId: string, leagueName: string) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
      <View className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-electric-green/25 bg-electric-green/10">
        <Ionicons color={THEME_COLORS.electricGreen} name="shield" size={18} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-base font-black text-white" numberOfLines={1}>
          {item.league.name}
        </Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Badge label={formatLeagueType(item.league.type)} tone={item.league.type === 'h2h' ? 'cyan' : 'gold'} />
          <Text className="text-xs font-semibold text-white/45">
            {item.memberCount}/{item.league.max_members}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => onLeave(item.league.id, item.league.name)}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
        <Text
          className="text-[11px] font-black uppercase text-coral-red"
          style={{ letterSpacing: 1.2 }}>
          Leave
        </Text>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const profileQuery = useProfileData({
    targetUserId: user?.id,
    viewerUserId: user?.id,
  });
  const leaguesQuery = useMyLeagues(user?.id);
  const preferencesQuery = useNotificationPreferences(user?.id);
  const seasonPassQuery = useSeasonPass(user?.id);
  const seasonPassPurchase = useSeasonPassPurchase(user?.id);
  const updatePreferences = useUpdateNotificationPreferences(user?.id);
  const updateProfile = useUpdateUserProfile(user?.id);
  const deleteAccount = useDeleteAccount();
  const leaveLeague = useLeaveLeagueMutation(user?.id);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (profileQuery.data?.profile) {
      setDisplayName(profileQuery.data.profile.display_name);
      setAvatarUrl(profileQuery.data.profile.avatar_url ?? '');
    }
  }, [profileQuery.data?.profile]);

  const isLoading =
    profileQuery.isLoading ||
    leaguesQuery.isLoading ||
    preferencesQuery.isLoading ||
    seasonPassQuery.isLoading;
  const hasSeasonPass = Boolean(seasonPassQuery.data);

  const saveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Display name required', 'Add the name you want league members to see.');
      return;
    }

    try {
      await updateProfile.mutateAsync({ avatar_url: avatarUrl, display_name: displayName });
      Alert.alert('Profile updated', 'Your player card is refreshed.');
    } catch (error) {
      Alert.alert('Could not update profile', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const togglePreference = async (key: NotificationType, enabled: boolean) => {
    const update: NotificationPreferencesUpdate = { [key]: !enabled };

    try {
      await updatePreferences.mutateAsync(update);
    } catch (error) {
      Alert.alert('Could not update preference', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const confirmLeaveLeague = (leagueId: string, leagueName: string) => {
    Alert.alert(
      'Leave league?',
      `Leaving ${leagueName} is permanent and cannot be undone. Your historical picks and past matchups remain visible to the league.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: async () => {
            try {
              await leaveLeague.mutateAsync(leagueId);
            } catch (error) {
              Alert.alert('Could not leave league', error instanceof Error ? error.message : 'Try again.');
            }
          },
          style: 'destructive',
          text: 'Leave',
        },
      ],
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account permanently?',
      'This permanently deletes your Action Arena account, profile, league memberships, picks, cosmetics, notifications, and other account data. This cannot be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: async () => {
            try {
              await deleteAccount.mutateAsync();
              router.replace('/login');
            } catch (error) {
              Alert.alert(
                'Could not delete account',
                error instanceof Error ? error.message : 'Try again.',
              );
            }
          },
          style: 'destructive',
          text: 'Delete Account',
        },
      ],
    );
  };

  const restorePurchases = async () => {
    const outcome = await seasonPassPurchase.restore();
    Alert.alert(outcome.title, outcome.message);
  };

  return (
    <ScreenWrapper className="pb-0">
      <ScrollView
        contentContainerStyle={{ gap: 18, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            tintColor={THEME_COLORS.electricGreen}
            refreshing={profileQuery.isRefetching || leaguesQuery.isRefetching || preferencesQuery.isRefetching}
              onRefresh={() => {
                void profileQuery.refetch();
                void leaguesQuery.refetch();
                void preferencesQuery.refetch();
                void seasonPassQuery.refetch();
              }}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View>
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            <Text
              className="text-[11px] font-semibold uppercase text-electric-green"
              style={{ letterSpacing: 1.2 }}>
              Control Room
            </Text>
          </View>
          <Text
            className="mt-1 text-2xl font-extrabold text-white"
            style={{ letterSpacing: -0.4 }}>
            Settings
          </Text>
          <Text className="mt-1 text-sm font-medium text-white/55">
            Profile, alerts, leagues, and the boring legal furniture.
          </Text>
        </View>

        {isLoading ? <SettingsSkeleton /> : null}

        {!isLoading ? (
          <>
            <Card>
              <View className="gap-4">
                <Text className="text-[11px] font-semibold uppercase text-electric-green" style={{ letterSpacing: 1.2 }}>
                  Player Profile
                </Text>
                <TextInput label="Display name" onChangeText={setDisplayName} value={displayName} />
                <TextInput
                  autoCapitalize="none"
                  label="Avatar URL"
                  onChangeText={setAvatarUrl}
                  placeholder="https://..."
                  value={avatarUrl}
                />
                <Button loading={updateProfile.isPending} onPress={saveProfile} title="Save Profile" />
              </View>
            </Card>

            <Card>
              <View className="gap-3">
                <Text className="text-[11px] font-semibold uppercase text-electric-green" style={{ letterSpacing: 1.2 }}>
                  Notification Preferences
                </Text>
                {preferencesQuery.data
                  ? NOTIFICATION_PREFERENCE_LABELS.map((preference) => (
                      <ToggleRow
                        description={preference.description}
                        enabled={preferencesQuery.data[preference.key]}
                        key={preference.key}
                        onToggle={() =>
                          togglePreference(preference.key, preferencesQuery.data[preference.key])
                        }
                        title={preference.title}
                      />
                    ))
                  : null}
              </View>
            </Card>

            <Card>
              <View className="gap-3">
                <Text className="text-[11px] font-semibold uppercase text-electric-green" style={{ letterSpacing: 1.2 }}>
                  Manage Leagues
                </Text>
                {(leaguesQuery.data ?? []).length === 0 ? (
                  <Text className="text-sm font-semibold text-white/55">
                    Joined leagues will show here.
                  </Text>
                ) : (
                  (leaguesQuery.data ?? []).map((league) => (
                    <LeagueManagementRow
                      item={league}
                      key={league.league.id}
                      onLeave={confirmLeaveLeague}
                    />
                  ))
                )}
              </View>
            </Card>

            <Card tone="highlight">
              <View className="gap-3">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-row items-center gap-2">
                    <Ionicons color={THEME_COLORS.gold} name="sparkles" size={14} />
                    <Text
                      className="text-[11px] font-semibold uppercase text-gold"
                      style={{ letterSpacing: 1.2 }}>
                      Premium
                    </Text>
                  </View>
                  <Badge
                    label={hasSeasonPass ? 'Pass Holder' : 'Available'}
                    tone={hasSeasonPass ? 'green' : 'gold'}
                  />
                </View>
                <Text
                  className="text-lg font-extrabold text-white"
                  style={{ letterSpacing: -0.2 }}>
                  {hasSeasonPass ? 'Season Pass Active' : 'Action Arena Plus'}
                </Text>
                <Text className="text-sm font-medium text-white/60">
                  Season Pass unlocks exclusive cosmetics, advanced analytics, early Pick Board access, and future ad-free hooks.
                </Text>
                <Button
                  onPress={() => router.push('/season-pass')}
                  title="View Season Pass"
                  variant="secondary"
                />
                <View className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                  <View className="flex-row items-start gap-3">
                    <View className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/15">
                      <Ionicons color={THEME_COLORS.gold} name="refresh" size={18} />
                    </View>
                    <View className="min-w-0 flex-1 gap-1">
                      <Text className="text-sm font-bold text-white">Restore Purchases</Text>
                      <Text className="text-xs font-medium leading-5 text-white/55">
                        Reconnect a Season Pass bought with the current Apple ID.
                      </Text>
                    </View>
                  </View>
                  <View className="mt-3">
                    <Button
                      icon="refresh"
                      loading={seasonPassPurchase.isPurchasing}
                      onPress={restorePurchases}
                      title="Restore Purchases"
                      variant="secondary"
                    />
                  </View>
                  {seasonPassPurchase.error ? (
                    <Text className="mt-2 text-xs font-bold leading-5 text-coral-red">
                      {seasonPassPurchase.error}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>

            <Card>
              <View className="gap-3">
                <Text
                  className="text-[11px] font-semibold uppercase text-white/45"
                  style={{ letterSpacing: 1.2 }}>
                  About
                </Text>
                <View className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                  <Text className="text-sm font-bold text-white">{ACTION_ARENA_DISCLOSURE.title}</Text>
                  <Text className="mt-1 text-xs font-medium leading-5 text-white/50">
                    {ACTION_ARENA_DISCLOSURE.summary}
                  </Text>
                  <Button
                    onPress={() =>
                      router.push({ pathname: '/disclosure', params: { source: 'settings' } })
                    }
                    title="How It Works"
                    variant="secondary"
                  />
                </View>
                <View className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                  <Text className="text-sm font-bold text-white">Terms of Service</Text>
                  <Text className="mt-1 text-xs font-medium leading-5 text-white/50">
                    {TERMS_OF_SERVICE_DOCUMENT.summary}
                  </Text>
                  <Button
                    onPress={() => router.push('/terms')}
                    title="View Terms"
                    variant="secondary"
                  />
                </View>
                <View className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                  <Text className="text-sm font-bold text-white">Privacy Policy</Text>
                  <Text className="mt-1 text-xs font-medium leading-5 text-white/50">
                    {PRIVACY_POLICY_DOCUMENT.summary}
                  </Text>
                  <Button
                    onPress={() => router.push('/privacy')}
                    title="View Privacy Policy"
                    variant="secondary"
                  />
                </View>
              </View>
            </Card>

            <Card>
              <View className="gap-3">
                <Text
                  className="text-[11px] font-semibold uppercase text-coral-red"
                  style={{ letterSpacing: 1.2 }}>
                  Account Access
                </Text>
                <Button
                  onPress={() => {
                    void signOut();
                  }}
                  title="Sign Out"
                  variant="secondary"
                />
                <View className="rounded-2xl border border-coral-red/30 bg-coral-red/10 p-3">
                  <View className="flex-row items-start gap-3">
                    <View className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-coral-red/30 bg-coral-red/15">
                      <Ionicons color={THEME_COLORS.coralRed} name="trash" size={18} />
                    </View>
                    <View className="min-w-0 flex-1 gap-2">
                      <Text className="text-sm font-bold text-white">Delete Account</Text>
                      <Text className="text-xs font-medium leading-5 text-white/55">
                        Permanently remove your account and account data from Action Arena.
                      </Text>
                    </View>
                  </View>
                  <View className="mt-3">
                    <Button
                      disabled={deleteAccount.isPending}
                      loading={deleteAccount.isPending}
                      onPress={confirmDeleteAccount}
                      title="Delete Account"
                      variant="destructive"
                    />
                  </View>
                </View>
              </View>
            </Card>
          </>
        ) : null}

        {profileQuery.isError || leaguesQuery.isError || preferencesQuery.isError ? (
          <Card>
            <Text className={cn('text-sm font-semibold text-coral-red')}>
              Some settings could not be loaded. Pull to refresh and try again.
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}
