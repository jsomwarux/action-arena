import AsyncStorage from '@/lib/storage';

const PENDING_INVITE_CODE_KEY = 'action-arena.pending-invite-code';

/** Invite codes are 6 characters and stored uppercase (see AGENTS.md schema). */
export function normalizeInviteCode(raw: string | undefined) {
  return (raw ?? '').trim().toUpperCase();
}

/**
 * A code parked while the player authenticates.
 *
 * /join/:inviteCode can be opened by someone with no session, and the trip
 * through login or signup is a full navigation (and, from an email link, a full
 * page load). Navigation state does not survive that; localStorage does.
 *
 * Written by /join/:inviteCode, read when deciding where to land a
 * just-authenticated player, and cleared by /leagues/join once it has the code.
 */
export async function storePendingInviteCode(code: string) {
  const normalized = normalizeInviteCode(code);

  if (!normalized) {
    return;
  }

  await AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, normalized);
}

export async function readPendingInviteCode() {
  const stored = await AsyncStorage.getItem(PENDING_INVITE_CODE_KEY);
  return stored ? normalizeInviteCode(stored) : null;
}

export async function clearPendingInviteCode() {
  await AsyncStorage.removeItem(PENDING_INVITE_CODE_KEY);
}
