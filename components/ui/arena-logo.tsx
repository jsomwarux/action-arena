import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type ArenaLogoProps = {
  className?: string;
  eyebrow?: string;
  size?: 'lg' | 'md';
};

export function ArenaLogo({ className, eyebrow = 'ACTION · ARENA', size = 'lg' }: ArenaLogoProps) {
  const wordmarkSize = size === 'lg' ? 48 : 36;
  const wordmarkLeading = size === 'lg' ? 46 : 36;

  return (
    <View className={cn('items-start', className)}>
      <View className="flex-row items-center">
        <View className="mr-3 h-3 w-3 rounded-full bg-electric-green" />
        <Text
          className="text-[10px] font-black uppercase text-electric-green"
          style={{ letterSpacing: 4 }}>
          {eyebrow}
        </Text>
      </View>

      <View className="mt-3">
        <Text
          className="font-black uppercase text-white"
          style={{ fontSize: wordmarkSize, letterSpacing: -1, lineHeight: wordmarkLeading }}>
          Action
        </Text>
        <Text
          className="font-black uppercase text-electric-green"
          style={{ fontSize: wordmarkSize, letterSpacing: -1, lineHeight: wordmarkLeading }}>
          Arena
        </Text>
      </View>

      <View className="mt-4 h-1 w-14 rounded-full bg-electric-green" />
    </View>
  );
}
