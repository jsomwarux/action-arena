import { useMemo, useState } from 'react';

import { CosmeticAvatar } from '@/components/cosmetics';
import { useEquippedCosmeticsForUsers } from '@/hooks/use-cosmetics';
import {
  buildProfileSummary,
  type LeagueOption,
  type MemberComparison,
  type ProfileData,
} from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import {
  getLeagueMemberPrimaryName,
  getLeagueMemberSecondaryName,
} from '@/lib/league-member-display';

import { Achievements } from './Achievements';
import { Breakdown } from './Breakdown';
import { Comparison } from './Comparison';
import { HeroStats } from './HeroStats';
import { Highlights } from './Highlights';
import { PickHistory } from './PickHistory';

export type ProfileContentProps = {
  comparison?: MemberComparison;
  data: ProfileData;
  /** Shown in place of the pick list when the viewer is allowed to see nothing. */
  emptyHistoryHint?: string;
  initialLeagueId?: string | 'all';
  readOnlyLeague?: boolean;
  title: string;
};

type LeagueNameById = Record<string, string>;

/**
 * Which league the numbers cover.
 *
 * Hidden when the caller pinned a league (the member route arrives from a
 * league surface and stays in it) or when there is only one to pick — same rule
 * as mobile's LeagueSelector.
 */
function LeagueSelector({
  onSelect,
  options,
  readOnly,
  selectedLeagueId,
}: {
  onSelect: (leagueId: string | 'all') => void;
  options: LeagueOption[];
  readOnly?: boolean;
  selectedLeagueId: string | 'all';
}) {
  if (readOnly || options.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
        League Scope
      </p>
      <div className="flex flex-wrap gap-2">
        {[{ id: 'all', label: 'All Leagues' }, ...options].map((option) => {
          const active = option.id === selectedLeagueId;

          return (
            <button
              className={cn(
                'rounded-full border px-3 py-2 arena-tag',
                'transition duration-150 ease-arena',
                active
                  ? 'border-electric-green/55 bg-electric-green/15 text-electric-green'
                  : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white',
              )}
              key={option.id}
              onClick={() => onSelect(option.id)}
              type="button">
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The shared body of /profile and /members/:memberId.
 *
 * Port of components/profile/profile-content.tsx. The blocks, their order and
 * every number they show are the mobile screen's; what changes is that a
 * desktop viewport can put highlights and the pick-type breakdown side by side
 * instead of stacking the whole thing into one column.
 *
 * The same component serves both routes for the same reason it does on mobile:
 * a member profile is your own profile with the league pinned, a head-to-head
 * block added, and no scope switcher.
 */
export function ProfileContent({
  comparison,
  data,
  emptyHistoryHint,
  initialLeagueId = 'all',
  readOnlyLeague = false,
  title,
}: ProfileContentProps) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | 'all'>(initialLeagueId);
  const cosmeticsQuery = useEquippedCosmeticsForUsers([data.profile.id]);

  const resolvedLeagueId =
    readOnlyLeague && data.leagueOptions[0] ? data.leagueOptions[0].id : selectedLeagueId;
  const summary = useMemo(
    () => buildProfileSummary(data, resolvedLeagueId),
    [data, resolvedLeagueId],
  );

  const scopeLabel =
    resolvedLeagueId === 'all'
      ? 'All leagues'
      : (data.leagueOptions.find((option) => option.id === resolvedLeagueId)?.label ??
        'Selected league');
  const scopedMembership =
    resolvedLeagueId === 'all'
      ? null
      : (data.memberships.find((membership) => membership.league_id === resolvedLeagueId) ?? null);
  const isLeagueScoped = resolvedLeagueId !== 'all';

  // Inside a league a player is their team name first; across leagues there is
  // no single team name to show, so the account name leads.
  const primaryName = isLeagueScoped
    ? getLeagueMemberPrimaryName(scopedMembership, data.profile, 'Player')
    : data.profile.display_name;
  const secondaryName = isLeagueScoped
    ? (getLeagueMemberSecondaryName(scopedMembership, data.profile) ?? scopeLabel)
    : data.profile.display_name;
  const profileHeaderTitle = isLeagueScoped ? primaryName : title;

  const leagueNameById = useMemo(
    () =>
      data.leagues.reduce<LeagueNameById>((names, league) => {
        names[league.id] = league.name;
        return names;
      }, {}),
    [data.leagues],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <CosmeticAvatar
            cosmetics={cosmeticsQuery.data?.[data.profile.id]}
            name={primaryName}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
              <span className="text-xs font-semibold uppercase tracking-[1.2px] text-electric-green">
                Player Card
              </span>
            </div>
            <p className="mt-1 truncate text-3xl font-extrabold tracking-[-0.5px] text-white">
              {profileHeaderTitle}
            </p>
            <p className="mt-1 truncate text-base font-medium text-white/60">{secondaryName}</p>
          </div>
        </div>

        <LeagueSelector
          onSelect={setSelectedLeagueId}
          options={data.leagueOptions}
          readOnly={readOnlyLeague}
          selectedLeagueId={resolvedLeagueId}
        />
      </div>

      <HeroStats summary={summary} />

      {comparison ? <Comparison comparison={comparison} /> : null}

      {/* Highlights and the pick-type breakdown are the same width of content
          on the phone, one after the other. Side by side they read as one
          answer to "what is working". */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Highlights summary={summary} />
        <Breakdown breakdowns={summary.betTypeBreakdowns} teasers={summary.teaserBreakdowns} />
      </div>

      <Achievements achievements={summary.achievements} />

      <PickHistory
        bets={summary.bets}
        emptyHint={emptyHistoryHint}
        leagueId={resolvedLeagueId}
        leagueNameById={leagueNameById}
        scopeLabel={scopeLabel}
      />
    </div>
  );
}
