import { useEffect, useState } from 'react';

import {
  Ban,
  BellRing,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '@/components/picks/dialogs';
import { PushScopeNotice } from '@/components/notifications/PushScopeNotice';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { IOS_ONLY_RESTORE_LABEL, IosOnlyNotice } from '@/components/store/IosOnlyNotice';
import { Badge, Button, Card, Notice, Skeleton, TextInput } from '@/components/ui';
import {
  ACTION_ARENA_DISCLOSURE,
  PRIVACY_POLICY_DOCUMENT,
  TERMS_OF_SERVICE_DOCUMENT,
} from '@/constants/disclosure';
import { useAuth } from '@/hooks/use-auth';
import {
  type BlockedUser,
  useBlockedUsers,
  useUnblockUserMutation,
} from '@/hooks/use-content-moderation';
import { useDeleteAccount } from '@/hooks/use-delete-account';
import { type LeagueSummary, useLeaveLeagueMutation, useMyLeagues } from '@/hooks/use-leagues';
import {
  NOTIFICATION_PREFERENCE_LABELS,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notifications';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { useSeasonPassPurchase } from '@/hooks/use-season-pass-purchase';
import { useCurrentUserProfile, useUpdateUserProfile } from '@/hooks/use-user-profile';
import { formatLeagueType } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import type { NotificationPreferencesUpdate, NotificationType } from '@/types/database';

/** The three destructive flows that reach for a confirm dialog. */
type PendingConfirm =
  | { kind: 'delete-account' }
  | { kind: 'leave-league'; leagueId: string; leagueName: string }
  | { kind: 'unblock'; blockId: string; displayName: string }
  | null;

type Message = { text: string; tone: 'error' | 'success' } | null;

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((key) => (
        <Card key={key}>
          <div className="flex flex-col gap-3">
            <Skeleton height={18} width="50%" />
            <Skeleton height={70} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function SectionHeading({ label, tone = 'green' }: { label: string; tone?: 'green' | 'muted' | 'red' }) {
  const toneClass =
    tone === 'red' ? 'text-coral-red' : tone === 'muted' ? 'text-white/45' : 'text-electric-green';

  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${toneClass}`}>{label}</p>
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
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-electric-green/25 bg-electric-green/10">
        <Shield aria-hidden className="h-[18px] w-[18px] text-electric-green" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-black text-white">{item.league.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge
            label={formatLeagueType(item.league.type)}
            tone={item.league.type === 'h2h' ? 'cyan' : 'gold'}
          />
          <span className="text-xs font-semibold text-white/45">
            {item.memberCount}/{item.league.max_members}
          </span>
        </div>
      </div>
      <button
        className="shrink-0 text-[11px] font-black uppercase tracking-[0.12em] text-coral-red transition hover:brightness-125"
        onClick={() => onLeave(item.league.id, item.league.name)}
        type="button">
        Leave
      </button>
    </div>
  );
}

function BlockedUserRow({
  block,
  onUnblock,
}: {
  block: BlockedUser;
  onUnblock: (block: BlockedUser) => void;
}) {
  const displayName = block.blockedUser?.display_name ?? 'Blocked user';

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-coral-red/30 bg-coral-red/12">
        <Ban aria-hidden className="h-[18px] w-[18px] text-coral-red" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-black text-white">{displayName}</p>
        <p className="mt-1 text-xs font-semibold text-white/45">Hidden from your league chat</p>
      </div>
      <button
        className="shrink-0 text-[11px] font-black uppercase tracking-[0.12em] text-electric-green transition hover:brightness-125"
        onClick={() => onUnblock(block)}
        type="button">
        Unblock
      </button>
    </div>
  );
}

function AboutRow({
  body,
  cta,
  icon: Icon,
  title,
  to,
}: {
  body: string;
  cta: string;
  icon: LucideIcon;
  title: string;
  to: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/55">
        <Icon aria-hidden className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-[16rem] flex-1">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-1 text-xs font-medium leading-5 text-white/50">{body}</p>
      </div>
      <Link
        className="shrink-0 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-[0.09em] text-white transition hover:bg-white/10"
        to={to}>
        {cta}
      </Link>
    </div>
  );
}

/**
 * Port of app/(app)/settings.tsx.
 *
 * Everything the phone can do here, the browser can do: rename yourself, tune
 * alerts, leave a league, unblock a chat user, read the legal documents, sign
 * out, and delete the account through the same `delete-account` Edge Function.
 * Mobile's `Alert.alert` confirmations become the shared ConfirmDialog, which
 * is the same yes/no shape without blocking the tab.
 *
 * The one thing that cannot cross: Restore Purchases talks to Apple. It renders
 * disabled and labelled instead of pretending — see IosOnlyNotice.
 */
export function SettingsPage() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const profileQuery = useCurrentUserProfile(user?.id);
  const leaguesQuery = useMyLeagues(user?.id);
  const blockedUsersQuery = useBlockedUsers(user?.id);
  const preferencesQuery = useNotificationPreferences(user?.id);
  const seasonPassQuery = useSeasonPass(user?.id);
  const seasonPassPurchase = useSeasonPassPurchase(user?.id);

  const updatePreferences = useUpdateNotificationPreferences(user?.id);
  const updateProfile = useUpdateUserProfile(user?.id);
  const deleteAccount = useDeleteAccount();
  const leaveLeague = useLeaveLeagueMutation(user?.id);
  const unblockUser = useUnblockUserMutation(user?.id);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (profileQuery.data) {
      setDisplayName(profileQuery.data.display_name ?? '');
      setAvatarUrl(profileQuery.data.avatar_url ?? '');
    }
  }, [profileQuery.data]);

  const isLoading =
    profileQuery.isLoading ||
    leaguesQuery.isLoading ||
    blockedUsersQuery.isLoading ||
    preferencesQuery.isLoading ||
    seasonPassQuery.isLoading;

  const hasSeasonPass = Boolean(seasonPassQuery.data);
  const preferences = preferencesQuery.data;

  const saveProfile = async () => {
    if (!displayName.trim()) {
      setMessage({ text: 'Add the name you want league members to see.', tone: 'error' });
      return;
    }

    setMessage(null);

    try {
      await updateProfile.mutateAsync({ avatar_url: avatarUrl, display_name: displayName });
      setMessage({ text: 'Profile updated. Your player card is refreshed.', tone: 'success' });
    } catch (error) {
      setMessage({
        text: `Could not update profile. ${error instanceof Error ? error.message : 'Try again.'}`,
        tone: 'error',
      });
    }
  };

  const togglePreference = async (key: NotificationType, enabled: boolean) => {
    const update: NotificationPreferencesUpdate = { [key]: !enabled };
    setMessage(null);

    try {
      await updatePreferences.mutateAsync(update);
    } catch (error) {
      setMessage({
        text: `Could not update preference. ${
          error instanceof Error ? error.message : 'Try again.'
        }`,
        tone: 'error',
      });
    }
  };

  const runConfirm = async (confirm: NonNullable<PendingConfirm>) => {
    setPendingConfirm(null);
    setMessage(null);

    try {
      if (confirm.kind === 'leave-league') {
        await leaveLeague.mutateAsync(confirm.leagueId);
        setMessage({ text: `You left ${confirm.leagueName}.`, tone: 'success' });
        return;
      }

      if (confirm.kind === 'unblock') {
        await unblockUser.mutateAsync(confirm.blockId);
        setMessage({
          text: `${confirm.displayName}'s chat messages can appear again.`,
          tone: 'success',
        });
        return;
      }

      await deleteAccount.mutateAsync();
      navigate(ROUTES.login, { replace: true });
    } catch (error) {
      const what =
        confirm.kind === 'leave-league'
          ? 'leave league'
          : confirm.kind === 'unblock'
            ? 'unblock user'
            : 'delete account';
      setMessage({
        text: `Could not ${what}. ${error instanceof Error ? error.message : 'Try again.'}`,
        tone: 'error',
      });
    }
  };

  const confirmCopy = (() => {
    if (pendingConfirm?.kind === 'leave-league') {
      return {
        body: `Leaving ${pendingConfirm.leagueName} is permanent and cannot be undone. Your historical picks and past matchups remain visible to the league.`,
        confirmLabel: 'Leave',
        destructive: true,
        title: 'Leave league?',
      };
    }

    if (pendingConfirm?.kind === 'unblock') {
      return {
        body: 'Their league chat messages will be visible to you again.',
        confirmLabel: 'Unblock',
        destructive: false,
        title: `Unblock ${pendingConfirm.displayName}?`,
      };
    }

    return {
      body: 'This permanently deletes your Action Arena account, profile, league memberships, picks, cosmetics, notifications, and other account data. This cannot be undone.',
      confirmLabel: 'Delete Account',
      destructive: true,
      title: 'Delete account permanently?',
    };
  })();

  return (
    <section className="flex flex-col gap-6">
      <header className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-electric-green">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
          Control Room
        </p>
        <h1 className="arena-heading mt-1 text-5xl leading-none">Settings</h1>
        <p className="mt-2 max-w-2xl text-textMuted">
          Profile, alerts, leagues, and the boring legal furniture.
        </p>
      </header>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {isLoading ? <SettingsSkeleton /> : null}

      {!isLoading ? (
        <>
          <Card>
            <div className="flex flex-col gap-4">
              <SectionHeading label="Player Profile" />
              <div className="grid gap-4 lg:grid-cols-2">
                <TextInput
                  label="Display name"
                  onChange={(event) => setDisplayName(event.target.value)}
                  value={displayName}
                />
                <TextInput
                  autoCapitalize="none"
                  label="Avatar URL"
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://..."
                  value={avatarUrl}
                />
              </div>
              <Button
                fullWidth={false}
                loading={updateProfile.isPending}
                onClick={() => {
                  void saveProfile();
                }}
                title="Save Profile"
              />
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionHeading label="Notification Preferences" />
                <Link
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50 transition hover:text-white"
                  to={ROUTES.notificationPreferences}>
                  <BellRing aria-hidden className="h-3.5 w-3.5" />
                  Full alert control
                </Link>
              </div>

              {/* The same toggles live on /notifications/preferences behind this
                  disclosure. They must not travel without it. */}
              <PushScopeNotice compact />

              {preferences
                ? NOTIFICATION_PREFERENCE_LABELS.map((preference) => (
                    <ToggleRow
                      description={preference.description}
                      disabled={updatePreferences.isPending}
                      enabled={preferences[preference.key]}
                      key={preference.key}
                      onToggle={() => {
                        void togglePreference(preference.key, preferences[preference.key]);
                      }}
                      title={preference.title}
                    />
                  ))
                : null}
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <SectionHeading label="Manage Leagues" />
              {(leaguesQuery.data ?? []).length === 0 ? (
                <p className="text-sm font-semibold text-white/55">
                  Joined leagues will show here.
                </p>
              ) : (
                (leaguesQuery.data ?? []).map((league) => (
                  <LeagueManagementRow
                    item={league}
                    key={league.league.id}
                    onLeave={(leagueId, leagueName) =>
                      setPendingConfirm({ kind: 'leave-league', leagueId, leagueName })
                    }
                  />
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <SectionHeading label="Blocked Users" />
              {(blockedUsersQuery.data ?? []).length === 0 ? (
                <p className="text-sm font-semibold text-white/55">
                  Blocked league chat users will show here.
                </p>
              ) : (
                (blockedUsersQuery.data ?? []).map((block) => (
                  <BlockedUserRow
                    block={block}
                    key={block.id}
                    onUnblock={(target) =>
                      setPendingConfirm({
                        blockId: target.id,
                        displayName: target.blockedUser?.display_name ?? 'this user',
                        kind: 'unblock',
                      })
                    }
                  />
                ))
              )}
            </div>
          </Card>

          <Card tone="highlight">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles aria-hidden className="h-3.5 w-3.5 text-gold" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
                    Premium
                  </p>
                </div>
                <Badge
                  label={hasSeasonPass ? 'Pass Holder' : 'Available'}
                  tone={hasSeasonPass ? 'green' : 'gold'}
                />
              </div>

              <p className="text-lg font-extrabold tracking-[-0.01em] text-white">
                {hasSeasonPass ? 'Season Pass Active' : 'Action Arena Plus'}
              </p>
              <p className="text-sm font-medium text-white/60">
                Season Pass unlocks exclusive cosmetics, advanced analytics, early Pick Board
                access, and future ad-free hooks. No gameplay is behind it.
              </p>

              <Link
                className="inline-flex min-h-14 w-fit items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-base font-black uppercase tracking-[0.09em] text-white transition hover:bg-white/10"
                to={ROUTES.seasonPass}>
                View Season Pass
              </Link>

              <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/15">
                    <RefreshCw aria-hidden className="h-[18px] w-[18px] text-gold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Restore Purchases</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-white/55">
                      Reconnect a Season Pass bought with the current Apple ID.
                    </p>
                  </div>
                </div>
                <IosOnlyNotice message={seasonPassPurchase.error} />
                <Button disabled title={IOS_ONLY_RESTORE_LABEL} variant="secondary" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <SectionHeading label="About" tone="muted" />
              <AboutRow
                body={ACTION_ARENA_DISCLOSURE.summary}
                cta="How It Works"
                icon={Shield}
                title={ACTION_ARENA_DISCLOSURE.title}
                to={`${ROUTES.disclosure}?source=settings`}
              />
              <AboutRow
                body={TERMS_OF_SERVICE_DOCUMENT.summary}
                cta="View Terms"
                icon={Shield}
                title="Terms of Service"
                to={ROUTES.terms}
              />
              <AboutRow
                body={PRIVACY_POLICY_DOCUMENT.summary}
                cta="View Privacy"
                icon={Shield}
                title="Privacy Policy"
                to={ROUTES.privacy}
              />
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <SectionHeading label="Account Access" tone="red" />
              <Button
                fullWidth={false}
                loading={isSigningOut}
                onClick={() => {
                  // No navigation needed: RequireAuth sends the cleared session
                  // to /login, the same as the top bar's user menu.
                  setIsSigningOut(true);
                  void signOut().finally(() => setIsSigningOut(false));
                }}
                title="Sign Out"
                variant="secondary"
              />

              <div className="flex flex-col gap-3 rounded-2xl border border-coral-red/30 bg-coral-red/10 p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-coral-red/30 bg-coral-red/15">
                    <Trash2 aria-hidden className="h-[18px] w-[18px] text-coral-red" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Delete Account</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-white/55">
                      Permanently remove your account and account data from Action Arena.
                    </p>
                  </div>
                </div>
                <Button
                  disabled={deleteAccount.isPending}
                  fullWidth={false}
                  loading={deleteAccount.isPending}
                  onClick={() => setPendingConfirm({ kind: 'delete-account' })}
                  title="Delete Account"
                  variant="destructive"
                />
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {profileQuery.isError ||
      leaguesQuery.isError ||
      blockedUsersQuery.isError ||
      preferencesQuery.isError ? (
        <Notice tone="error">
          Some settings could not be loaded. Reload the page and try again.
        </Notice>
      ) : null}

      <ConfirmDialog
        body={confirmCopy.body}
        confirmLabel={confirmCopy.confirmLabel}
        destructive={confirmCopy.destructive}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (pendingConfirm) void runConfirm(pendingConfirm);
        }}
        open={pendingConfirm !== null}
        title={confirmCopy.title}
      />
    </section>
  );
}
