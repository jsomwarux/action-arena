import type { LeagueMemberRow, UserRow } from '@/types/database';

type DisplayMember = Pick<LeagueMemberRow, 'team_name'> | null | undefined;
type DisplayUser = Pick<UserRow, 'display_name'> | null | undefined;

export const TEAM_NAME_MAX_LENGTH = 40;

export function getLeagueMemberPrimaryName(
  member: DisplayMember,
  user: DisplayUser,
  fallback = 'Player',
) {
  const teamName = member?.team_name.trim();
  const displayName = user?.display_name.trim();

  return teamName || displayName || fallback;
}

export function getLeagueMemberSecondaryName(member: DisplayMember, user: DisplayUser) {
  const teamName = member?.team_name.trim();
  const displayName = user?.display_name.trim();

  if (!teamName || !displayName || teamName === displayName) {
    return null;
  }

  return displayName;
}

export function indexLeagueMembersByUserId(members: LeagueMemberRow[]) {
  return members.reduce<Record<string, LeagueMemberRow>>((accumulator, member) => {
    accumulator[member.user_id] = member;
    return accumulator;
  }, {});
}
