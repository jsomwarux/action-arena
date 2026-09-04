import { useEffect, useState } from 'react';

import { Check, Copy, Link2 } from 'lucide-react';

import { Badge, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { buildRoute } from '@/lib/routes';


type CopyState = 'code' | 'error' | 'link' | null;

export function buildInviteUrl(inviteCode: string) {
  // window.location.origin keeps the link correct on localhost, on a preview
  // deploy, and in production without a build-time base URL to configure.
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${buildRoute.invite(inviteCode)}`;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

/**
 * The invite panel from app/(app)/(tabs)/leagues/[leagueId].tsx (InviteCodeCard),
 * plus the desktop-only half of the job: a full /join/:inviteCode URL, which is
 * what a player on a laptop actually wants to paste into a group chat.
 *
 * Same visibility rule as mobile — the card disappears once the season is under
 * way or the roster is full, because there is nothing left to invite anyone to.
 */
export function InviteShare({
  inviteCode,
  maxMembers,
  memberCount,
  seasonInProgress,
}: {
  inviteCode: string;
  maxMembers: number;
  memberCount: number;
  seasonInProgress: boolean;
}) {
  const [copied, setCopied] = useState<CopyState>(null);
  const inviteUrl = buildInviteUrl(inviteCode);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (seasonInProgress || memberCount >= maxMembers) {
    return null;
  }

  const handleCopy = async (value: string, state: CopyState) => {
    try {
      await copyText(value);
      setCopied(state);
    } catch {
      setCopied('error');
    }
  };

  const buttonClasses = (active: boolean) =>
    cn(
      'flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3',
      'text-sm font-black uppercase tracking-[0.15em] transition duration-150 ease-arena',
      active
        ? 'border-electric-green bg-electric-green/15 text-electric-green shadow-[0_0_12px_rgba(0,255,135,0.45)]'
        : 'border-white/15 bg-white/[0.05] text-white hover:bg-white/10',
    );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
            Invite Code
          </p>
          <p className="mt-1 font-mono text-3xl font-black tracking-[0.28em] text-electric-green">
            {inviteCode}
          </p>
        </div>
        <Badge label={`${memberCount}/${maxMembers}`} tone="gold" />
      </div>

      <p className="truncate rounded-xl border border-white/[0.08] bg-arena-bg/60 px-3 py-2 font-mono text-xs text-white/55">
        {inviteUrl}
      </p>

      <div className="flex gap-3">
        <button
          className={buttonClasses(copied === 'code')}
          onClick={() => void handleCopy(inviteCode, 'code')}
          type="button">
          {copied === 'code' ? (
            <Check aria-hidden className="h-4 w-4" />
          ) : (
            <Copy aria-hidden className="h-4 w-4" />
          )}
          {copied === 'code' ? 'Code Copied' : 'Copy Code'}
        </button>
        <button
          className={buttonClasses(copied === 'link')}
          onClick={() => void handleCopy(inviteUrl, 'link')}
          type="button">
          {copied === 'link' ? (
            <Check aria-hidden className="h-4 w-4" />
          ) : (
            <Link2 aria-hidden className="h-4 w-4" />
          )}
          {copied === 'link' ? 'Link Copied' : 'Copy Link'}
        </button>
      </div>

      {copied === 'error' ? (
        <p className="text-xs font-semibold text-coral-red">
          Your browser blocked the clipboard. Select the code above and copy it manually.
        </p>
      ) : null}
    </Card>
  );
}
