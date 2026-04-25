import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import type { BetType } from '@/types/database';

export type BadgeTone = 'green' | 'red' | 'amber' | 'cyan' | 'gold';

type BadgeProps = {
  betType?: BetType;
  label?: string;
  tone?: BadgeTone;
};

const containerByTone: Record<BadgeTone, string> = {
  green: 'border-electric-green/40 bg-electric-green/15',
  red: 'border-coral-red/40 bg-coral-red/15',
  amber: 'border-amber-accent/40 bg-amber-accent/15',
  cyan: 'border-cyan-accent/40 bg-cyan-accent/15',
  gold: 'border-gold/40 bg-gold/15',
};

const textByTone: Record<BadgeTone, string> = {
  green: 'text-electric-green',
  red: 'text-coral-red',
  amber: 'text-amber-accent',
  cyan: 'text-cyan-accent',
  gold: 'text-gold',
};

const toneByBetType: Record<BetType, BadgeTone> = {
  straight: 'green',
  parlay: 'amber',
  teaser: 'cyan',
};

const defaultBetTypeLabels: Record<BetType, string> = {
  straight: 'Straight',
  parlay: 'Parlay',
  teaser: 'Teaser',
};

export function Badge({ betType, label, tone }: BadgeProps) {
  const resolvedTone: BadgeTone = tone ?? (betType ? toneByBetType[betType] : 'green');
  const resolvedLabel = label ?? (betType ? defaultBetTypeLabels[betType] : '');

  return (
    <View
      className={cn(
        'self-start rounded-full border px-3 py-1',
        containerByTone[resolvedTone],
      )}>
      <Text
        className={cn('text-[10px] font-black uppercase', textByTone[resolvedTone])}
        style={{ letterSpacing: 1.5 }}>
        {resolvedLabel}
      </Text>
    </View>
  );
}
