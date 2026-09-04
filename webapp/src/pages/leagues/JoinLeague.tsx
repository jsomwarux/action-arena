import { useEffect, useState, type FormEvent } from 'react';

import { Globe, KeyRound, Search } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Badge } from '@/components/leagues/Badge';
import { Button, Card, Notice, Skeleton, TextInput } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import {
  useJoinLeagueMutation,
  usePublicLeagues,
  type PublicLeagueSummary,
} from '@/hooks/use-leagues';
import { formatLeagueType, formatSport } from '@/lib/format';
import { clearPendingInviteCode, normalizeInviteCode } from '@/lib/invite-code';
import { ROUTES, buildRoute } from '@/lib/routes';

const INVITE_CODE_LENGTH = 6;

type JoinLeagueLocationState = {
  inviteCode?: string;
} | null;

function PublicLeagueCard({
  isJoining,
  item,
  onJoin,
}: {
  isJoining: boolean;
  item: PublicLeagueSummary;
  onJoin: (leagueId: string) => void;
}) {
  const isFull = item.memberCount >= item.league.max_members;

  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10">
          <Globe aria-hidden className="h-5 w-5 text-cyan-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-black uppercase text-white">{item.league.name}</h3>
          <p className="text-xs font-semibold text-white/50">
            Commissioner · {item.commissioner?.display_name ?? 'Unknown'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">
            Members
          </p>
          <p className="mt-1 text-base font-black text-white">
            {item.memberCount}
            <span className="text-white/40">/{item.league.max_members}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          label={formatLeagueType(item.league.type)}
          tone={item.league.type === 'h2h' ? 'cyan' : 'gold'}
        />
        <Badge label={formatSport(item.league.sport)} tone="green" />
        {isFull ? <Badge label="Full Roster" tone="red" /> : null}
      </div>

      <Button
        className="mt-auto"
        disabled={isFull}
        loading={isJoining}
        onClick={() => onJoin(item.league.id)}
        title={isFull ? 'Roster Full' : 'Join League'}
      />
    </Card>
  );
}

function PublicLeagueSkeletons() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <Card className="flex flex-col gap-4" key={item}>
          <div className="flex items-center gap-3">
            <Skeleton height={48} radius={16} width={48} />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton height={20} width="68%" />
              <Skeleton height={14} width="48%" />
            </div>
          </div>
          <Skeleton height={48} radius={16} />
        </Card>
      ))}
    </div>
  );
}

function EmptyPublicLeagues() {
  return (
    <Card className="flex flex-col items-center gap-4 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-accent/30 bg-cyan-accent/10">
        <Search aria-hidden className="h-6 w-6 text-cyan-accent" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="arena-heading text-2xl leading-none">No Public Rooms</h3>
        <p className="text-base font-semibold text-white/55">
          Try another search or create the room everyone joins next.
        </p>
      </div>
      <Link
        className="rounded-full border border-electric-green/40 bg-electric-green/15 px-5 py-2 text-xs font-black uppercase tracking-[0.15em] text-electric-green transition hover:bg-electric-green/25"
        to={ROUTES.leagueCreate}>
        Create League
      </Link>
    </Card>
  );
}

/**
 * Port of app/(app)/leagues/join.tsx — the same two ways in, the same copy.
 *
 * The one thing mobile has no equivalent for is the invite code arriving from
 * /join/:inviteCode. That route banks the code, sends the player through auth
 * if they need it, and hands it here in navigation state; this screen prefills
 * the field with it and is the only place that consumes it.
 */
export function JoinLeaguePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState(() =>
    normalizeInviteCode((location.state as JoinLeagueLocationState)?.inviteCode),
  );
  const [search, setSearch] = useState('');
  const [joinError, setJoinError] = useState<string | undefined>();
  const [joiningLeagueId, setJoiningLeagueId] = useState<string | null>(null);

  const publicLeagues = usePublicLeagues(search);
  const joinLeague = useJoinLeagueMutation(user?.id);

  // The auth flow parks the code in localStorage so it survives login, signup
  // and the disclosure gate; this screen is where it gets spent. Clearing it on
  // arrival stops a stale code from redirecting the next sign-in back here.
  useEffect(() => {
    void clearPendingInviteCode();
  }, []);

  const handleJoin = async (input: { inviteCode?: string; leagueId?: string }) => {
    setJoinError(undefined);
    setJoiningLeagueId(input.leagueId ?? null);

    try {
      const leagueId = await joinLeague.mutateAsync(input);
      navigate(buildRoute.league(leagueId), { replace: true });
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Try again.');
    } finally {
      setJoiningLeagueId(null);
    }
  };

  const leagues = publicLeagues.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <header>
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-green">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
          Find a League
        </span>
        <h1 className="arena-heading mt-1 text-5xl leading-none">Join League</h1>
        <p className="mt-1 text-sm font-medium text-white/55">
          Enter a private invite code or browse public rooms.
        </p>
      </header>

      {joinError ? <Notice tone="error">Could not join league. {joinError}</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="flex h-fit flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-electric-green/30 bg-electric-green/10">
              <KeyRound aria-hidden className="h-[18px] w-[18px] text-electric-green" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-electric-green">
                Private League
              </p>
              <p className="text-base font-black text-white">Got an Invite Code?</p>
            </div>
          </div>

          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void handleJoin({ inviteCode });
            }}>
            <TextInput
              autoCapitalize="characters"
              autoComplete="off"
              className="font-mono tracking-[0.28em]"
              label="Invite Code"
              maxLength={INVITE_CODE_LENGTH}
              onChange={(event) => setInviteCode(normalizeInviteCode(event.target.value))}
              placeholder="A1B2C3"
              value={inviteCode}
            />
            <Button
              loading={joinLeague.isPending && joiningLeagueId === null}
              title="Join by Code"
              type="submit"
            />
          </form>
        </Card>

        <div className="flex flex-col gap-5">
          <TextInput
            containerClassName="max-w-md"
            label="Browse public leagues"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by league name"
            value={search}
          />

          {publicLeagues.isLoading ? (
            <PublicLeagueSkeletons />
          ) : leagues.length === 0 ? (
            <EmptyPublicLeagues />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {leagues.map((item) => (
                <PublicLeagueCard
                  isJoining={joinLeague.isPending && joiningLeagueId === item.league.id}
                  item={item}
                  key={item.league.id}
                  onJoin={(leagueId) => void handleJoin({ leagueId })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
