import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { getNflTeamPrimaryColor, resolveNflTeamData } from '@/lib/nfl-teams';

type NflTeamLogoProps = {
  size?: number;
  teamName: string;
};

export function NflTeamLogo({ size = 28, teamName }: NflTeamLogoProps) {
  const team = useMemo(() => resolveNflTeamData(teamName), [teamName]);
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackColor = team?.primaryColor ?? getNflTeamPrimaryColor(teamName);
  const fallbackInitial = (team?.shortName ?? teamName ?? '?').charAt(0).toUpperCase();

  useEffect(() => {
    setImageFailed(false);
    if (team?.logoUrl) {
      void Image.prefetch(team.logoUrl);
    }
  }, [team?.logoUrl]);

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        backgroundColor: fallbackColor,
        borderColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        flexShrink: 0,
        height: size,
        overflow: 'hidden',
        width: size,
      }}>
      {team?.logoUrl && !imageFailed ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setImageFailed(true)}
          resizeMode="contain"
          source={{ cache: 'force-cache', uri: team.logoUrl }}
          style={{
            height: Math.round(size * 0.84),
            width: Math.round(size * 0.84),
          }}
        />
      ) : (
        <Text
          className="font-black text-white"
          style={{
            fontSize: Math.max(9, Math.round(size * 0.43)),
            letterSpacing: 0,
          }}>
          {fallbackInitial}
        </Text>
      )}
    </View>
  );
}
