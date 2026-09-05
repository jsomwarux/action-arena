import { useMemo, useState } from 'react';

import { Ban, ChevronRight, Flag } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AnimatedProfit, Badge, Button, Card, Modal, Notice, StaggeredItem } from '@/components/ui';
import {
  useBlockUserMutation,
  useReportContentMutation,
} from '@/hooks/use-content-moderation';
import type { LeagueDetail } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import {
  getLeagueMemberPrimaryName,
  getLeagueMemberSecondaryName,
} from '@/lib/league-member-display';
import { buildRoute } from '@/lib/routes';
import type { EquippedCosmeticsByCategory, LeagueMemberRow } from '@/types/database';

import { CosmeticAvatar } from '@/components/cosmetics';

type MemberActionTarget = {
  displayName: string;
  member: LeagueMemberRow;
};

/**
 * Port of the mobile hub's Members tab.
 *
 * Mobile reaches the moderation actions with a long-press or a small flag
 * button and confirms in a native Alert; here the flag button opens a modal
 * with the same two actions and the same copy.
 */
export function MembersPanel({
  cosmeticsByUserId,
  detail,
  userId,
}: {
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  userId: string;
}) {
  const [actionTarget, setActionTarget] = useState<MemberActionTarget | null>(null);
  const [blockTarget, setBlockTarget] = useState<MemberActionTarget | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reportContent = useReportContentMutation(userId);
  const blockUser = useBlockUserMutation(userId);

  const profitByUserId = useMemo(
    () =>
      detail.standings.reduce<Record<string, number>>((accumulator, standing) => {
        accumulator[standing.user_id] = standing.total_profit;
        return accumulator;
      }, {}),
    [detail.standings],
  );

  const reportDisplayName = async (target: MemberActionTarget) => {
    const profile = detail.profilesById[target.member.user_id];

    try {
      await reportContent.mutateAsync({
        contentSnapshot: {
          display_name: profile?.display_name ?? null,
          team_name: target.member.team_name,
          user_display_name: target.displayName,
          user_id: target.member.user_id,
        },
        leagueId: detail.league.id,
        reportedUserId: target.member.user_id,
        targetId: target.member.id,
        targetType: 'league_member',
      });
      setActionTarget(null);
      setError(null);
      setStatus('Report sent. This display name was flagged for moderation review.');
    } catch (reportError) {
      setActionTarget(null);
      setError(reportError instanceof Error ? reportError.message : 'Could not report member.');
    }
  };

  const confirmBlock = async () => {
    const target = blockTarget;
    if (!target) return;

    try {
      await blockUser.mutateAsync({
        blockedUserId: target.member.user_id,
        leagueId: detail.league.id,
      });
      setBlockTarget(null);
      setError(null);
      setStatus(`${target.displayName}'s messages are hidden for you.`);
    } catch (blockError) {
      setBlockTarget(null);
      setError(blockError instanceof Error ? blockError.message : 'Could not block user.');
    }
  };

  return (
    <>
      <Card className="overflow-hidden" padded={false}>
        <header className="flex items-center justify-between gap-3 px-5 pt-5">
          <p className="arena-eyebrow text-electric-green">
            Members
          </p>
          <Badge label={`${detail.members.length}/${detail.league.max_members}`} tone="gold" />
        </header>

        {status ? (
          <Notice className="mx-5 mt-3" tone="success">
            {status}
          </Notice>
        ) : null}
        {error ? (
          <Notice className="mx-5 mt-3" tone="error">
            {error}
          </Notice>
        ) : null}

        <ul className="mt-4">
          {detail.members.map((member, index) => {
            const isCommissioner = member.user_id === detail.league.commissioner_id;
            const profile = detail.profilesById[member.user_id];
            const memberName = getLeagueMemberPrimaryName(member, profile, 'Unknown Player');
            const secondaryName = getLeagueMemberSecondaryName(member, profile);
            const totalProfit = profitByUserId[member.user_id] ?? 0;
            const canModerateMember = member.user_id !== userId;
            const lastRow = index === detail.members.length - 1;

            return (
              <StaggeredItem index={index} key={member.id} perItemDelay={35}>
                <li
                  className={cn(
                    'flex items-center gap-3 px-5 py-4',
                    !lastRow && 'border-b border-white/[0.05]',
                  )}>
                  <CosmeticAvatar
                    cosmetics={cosmeticsByUserId[member.user_id]}
                    name={memberName}
                    size="md"
                  />

                  <Link
                    className="group min-w-0 flex-1"
                    state={{ leagueId: detail.league.id }}
                    to={buildRoute.member(member.user_id)}>
                    <span className="flex items-center gap-1">
                      <span className="truncate text-base font-black text-white group-hover:text-electric-green">
                        {memberName}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-white/30 group-hover:text-electric-green"
                      />
                    </span>
                    {secondaryName ? (
                      <span className="mt-1 block truncate text-[11px] font-semibold text-white/50">
                        {secondaryName}
                      </span>
                    ) : null}
                  </Link>

                  <div className="flex shrink-0 items-center gap-3">
                    {isCommissioner ? <Badge label="Commish" tone="gold" /> : null}
                    <AnimatedProfit className="text-sm font-black" value={totalProfit} />
                    {canModerateMember ? (
                      <button
                        aria-label={`Report or block ${memberName}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:border-coral-red/40 hover:text-coral-red"
                        onClick={() => setActionTarget({ displayName: memberName, member })}
                        type="button">
                        <Flag aria-hidden className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                </li>
              </StaggeredItem>
            );
          })}
        </ul>
      </Card>

      <Modal
        footer={
          <Button
            fullWidth={false}
            onClick={() => setActionTarget(null)}
            title="Cancel"
            variant="secondary"
          />
        }
        onClose={() => setActionTarget(null)}
        open={Boolean(actionTarget)}
        subtitle="Choose a moderation action for this member."
        title={actionTarget?.displayName ?? 'League member'}>
        <div className="flex flex-col gap-3">
          <Button
            icon={Flag}
            loading={reportContent.isPending}
            onClick={() => {
              if (actionTarget) void reportDisplayName(actionTarget);
            }}
            title="Report Display Name"
            variant="secondary"
          />
          <Button
            icon={Ban}
            onClick={() => {
              if (!actionTarget) return;
              setBlockTarget(actionTarget);
              setActionTarget(null);
            }}
            title="Block User"
            variant="destructive"
          />
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <Button
              disabled={blockUser.isPending}
              fullWidth={false}
              onClick={() => setBlockTarget(null)}
              title="Cancel"
              variant="secondary"
            />
            <Button
              fullWidth={false}
              loading={blockUser.isPending}
              onClick={() => void confirmBlock()}
              title="Block"
              variant="destructive"
            />
          </>
        }
        onClose={() => setBlockTarget(null)}
        open={Boolean(blockTarget)}
        title={`Block ${blockTarget?.displayName ?? 'this player'}?`}>
        <p className="text-sm font-semibold text-white/65">
          You won&apos;t see their chat messages anymore. Other league members can still see them.
        </p>
      </Modal>
    </>
  );
}
