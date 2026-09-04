import { useEffect, useMemo, useState } from 'react';

import { getNflTeamPrimaryColor, resolveNflTeamData } from '@/lib/nfl-teams';

/** Port of components/ui/nfl-team-logo.tsx. */
export function NflTeamLogo({ size = 28, teamName }: { size?: number; teamName: string }) {
  const team = useMemo(() => resolveNflTeamData(teamName), [teamName]);
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackColor = team?.primaryColor ?? getNflTeamPrimaryColor(teamName);
  const fallbackInitial = (team?.shortName ?? teamName ?? '?').charAt(0).toUpperCase();

  useEffect(() => {
    setImageFailed(false);
  }, [team?.logoUrl]);

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.18]"
      style={{ backgroundColor: fallbackColor, height: size, width: size }}>
      {team?.logoUrl && !imageFailed ? (
        <img
          alt=""
          className="object-contain"
          height={Math.round(size * 0.84)}
          onError={() => setImageFailed(true)}
          src={team.logoUrl}
          width={Math.round(size * 0.84)}
        />
      ) : (
        <span
          className="font-black text-white"
          style={{ fontSize: Math.max(9, Math.round(size * 0.43)) }}>
          {fallbackInitial}
        </span>
      )}
    </span>
  );
}
