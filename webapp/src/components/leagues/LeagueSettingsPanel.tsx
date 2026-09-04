import { useState } from 'react';

import { Flag, Globe, Lock, Pencil, ShieldCheck } from 'lucide-react';

import { Badge, Button, Card, Modal, Notice, TextInput } from '@/components/ui';
import {
  useGenerateScheduleMutation,
  useUpdateLeagueTeamNameMutation,
  type LeagueDetail,
} from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import { formatLeagueType, formatSport } from '@/lib/format';
import {
  TEAM_NAME_MAX_LENGTH,
  getLeagueMemberPrimaryName,
  getLeagueMemberSecondaryName,
} from '@/lib/league-member-display';


const LEAGUE_STATUS_LABELS: Record<LeagueDetail['league']['status'], string> = {
  active: 'Active',
  complete: 'Complete',
  drafting: 'Drafting',
  playoffs: 'Playoffs',
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">
        {label}
      </span>
      <span className="truncate text-sm font-bold text-white/85">{value}</span>
    </div>
  );
}

/**
 * Your team, the league's settings, and — for the commissioner — the controls
 * that only they can use.
 *
 * On mobile these are spread across the hub's header (team name), the Schedule
 * tab (Start Season) and the invite card. Desktop has the room to keep them in
 * one panel that never leaves the page.
 */
export function LeagueSettingsPanel({
  detail,
  onReportLeague,
  userId,
}: {
  detail: LeagueDetail;
  onReportLeague: () => void;
  userId: string;
}) {
  const member = detail.members.find((row) => row.user_id === userId) ?? null;
  const profile = detail.profilesById[userId];
  const commissioner = detail.profilesById[detail.league.commissioner_id];
  const isCommissioner = detail.league.commissioner_id === userId;
  const isPrivate = detail.league.visibility === 'private';

  const generateSchedule = useGenerateScheduleMutation(userId);
  const updateTeamName = useUpdateLeagueTeamNameMutation(userId);

  const [isEditing, setIsEditing] = useState(false);
  const [teamNameDraft, setTeamNameDraft] = useState('');
  const [teamNameError, setTeamNameError] = useState<string | undefined>();

  // Same gate as mobile: H2H, commissioner, two or more players, a league that
  // has not been scheduled yet.
  const canStartSeason =
    detail.league.type === 'h2h' &&
    isCommissioner &&
    detail.members.length >= 2 &&
    ['drafting', 'active'].includes(detail.league.status) &&
    detail.matchups.length === 0;

  const teamName = getLeagueMemberPrimaryName(member, profile, 'Your Team');
  const secondaryName = getLeagueMemberSecondaryName(member, profile);
  const rosterPercent = Math.min(
    100,
    (detail.members.length / Math.max(1, detail.league.max_members)) * 100,
  );

  const openEditor = () => {
    if (!member) return;
    setTeamNameDraft(member.team_name);
    setTeamNameError(undefined);
    setIsEditing(true);
  };

  const closeEditor = () => {
    if (updateTeamName.isPending) return;
    setIsEditing(false);
    setTeamNameError(undefined);
  };

  const saveTeamName = async () => {
    if (!member) return;

    const trimmedTeamName = teamNameDraft.trim();

    if (!trimmedTeamName) {
      setTeamNameError('Team name is required.');
      return;
    }

    if (trimmedTeamName.length > TEAM_NAME_MAX_LENGTH) {
      setTeamNameError(`Keep it to ${TEAM_NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }

    if (trimmedTeamName === member.team_name.trim()) {
      closeEditor();
      return;
    }

    try {
      await updateTeamName.mutateAsync({
        leagueId: detail.league.id,
        teamName: trimmedTeamName,
        userId,
      });
      setIsEditing(false);
      setTeamNameError(undefined);
    } catch (error) {
      setTeamNameError(error instanceof Error ? error.message : 'Could not save team name.');
    }
  };

  return (
    <>
      <Card className="flex h-full flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-electric-green">
            League Settings
          </p>
          <Badge
            icon={isPrivate ? Lock : Globe}
            label={detail.league.visibility}
            tone={isPrivate ? 'red' : 'green'}
          />
        </header>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-electric-green/25 bg-electric-green/[0.06] p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-electric-green/35 bg-electric-green/[0.12]">
              <ShieldCheck aria-hidden className="h-5 w-5 text-electric-green" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-electric-green">
                Your Team
              </p>
              <p className="mt-1 truncate text-lg font-black text-white">{teamName}</p>
              {secondaryName ? (
                <p className="truncate text-xs font-semibold text-white/45">{secondaryName}</p>
              ) : null}
            </div>
          </div>
          <Button
            disabled={!member}
            fullWidth={false}
            icon={Pencil}
            onClick={openEditor}
            title="Edit"
            variant="secondary"
          />
        </div>

        <div className="divide-y divide-white/[0.06]">
          <Fact label="Format" value={formatLeagueType(detail.league.type)} />
          <Fact label="Sport" value={formatSport(detail.league.sport)} />
          <Fact label="Status" value={LEAGUE_STATUS_LABELS[detail.league.status]} />
          <Fact label="Season" value={String(detail.league.season_year)} />
          <Fact label="Current week" value={`Week ${detail.league.current_week}`} />
          <Fact label="Commissioner" value={commissioner?.display_name ?? 'Unknown'} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
              Roster
            </span>
            <span className="text-xs font-black text-white">
              {detail.members.length} / {detail.league.max_members} joined
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-electric-green"
              style={{ width: `${String(rosterPercent)}%` }}
            />
          </div>
        </div>

        {isCommissioner ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-gold/25 bg-gold/[0.05] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">
                Commissioner
              </p>
              <Badge label="You" tone="gold" />
            </div>
            {canStartSeason ? (
              <>
                <p className="text-sm font-semibold leading-5 text-white/65">
                  Drop the green flag with {detail.members.length} player
                  {detail.members.length === 1 ? '' : 's'}, or wait until the roster fills to{' '}
                  {detail.league.max_members} for an automatic start.
                </p>
                <Button
                  loading={generateSchedule.isPending}
                  onClick={() => generateSchedule.mutate(detail.league.id)}
                  title={generateSchedule.isPending ? 'Building Schedule…' : 'Start Season'}
                />
              </>
            ) : (
              <p className="text-sm font-semibold leading-5 text-white/65">
                {detail.league.type !== 'h2h'
                  ? 'Cumulative leagues need no schedule — profit accrues from Week 1.'
                  : detail.matchups.length > 0
                    ? 'The season schedule is set. Nothing else needs your sign-off.'
                    : 'You need at least 2 players before the season can start.'}
              </p>
            )}
            {generateSchedule.error ? (
              <Notice tone="error">{generateSchedule.error.message}</Notice>
            ) : null}
          </div>
        ) : null}

        <button
          className={cn(
            'mt-auto inline-flex items-center justify-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-2',
            'text-[10px] font-black uppercase tracking-[0.14em] text-white/55 transition hover:border-coral-red/40 hover:text-coral-red',
          )}
          onClick={onReportLeague}
          type="button">
          <Flag aria-hidden className="h-3 w-3" />
          Report league name
        </button>
      </Card>

      <Modal
        footer={
          <>
            <Button
              disabled={updateTeamName.isPending}
              fullWidth={false}
              onClick={closeEditor}
              title="Cancel"
              variant="secondary"
            />
            <Button
              fullWidth={false}
              loading={updateTeamName.isPending}
              onClick={() => void saveTeamName()}
              title="Save"
            />
          </>
        }
        onClose={closeEditor}
        open={isEditing}
        subtitle="This name is only for this league. Other leagues can use a different team name."
        title="Edit Team Name">
        <form
          className="flex flex-col gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void saveTeamName();
          }}>
          <TextInput
            autoCapitalize="words"
            error={teamNameError}
            label="Team name"
            maxLength={TEAM_NAME_MAX_LENGTH}
            onChange={(event) => {
              setTeamNameDraft(event.target.value);
              if (teamNameError) setTeamNameError(undefined);
            }}
            value={teamNameDraft}
          />
          <p className="text-right text-[11px] font-semibold text-white/45">
            {teamNameDraft.trim().length}/{TEAM_NAME_MAX_LENGTH}
          </p>
        </form>
      </Modal>
    </>
  );
}
