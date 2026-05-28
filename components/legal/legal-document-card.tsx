import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { ArenaLogo, Button, Card } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';

type LegalDocumentCardProps = {
  title: string;
  body: string;
  chips: readonly [string, string];
  buttonLabel: string;
  buttonLoading?: boolean;
  onButtonPress: () => void;
};

export function LegalDocumentCard({
  title,
  body,
  chips,
  buttonLabel,
  buttonLoading,
  onButtonPress,
}: LegalDocumentCardProps) {
  return (
    <Card tone="highlight">
      <View className="items-center gap-6 py-2">
        <ArenaLogo className="items-center" eyebrow="FREE · FANTASY · PICKS" size="md" />
        <View
          className="h-14 w-14 items-center justify-center rounded-3xl border border-electric-green/45 bg-electric-green/15"
          style={{
            shadowColor: THEME_COLORS.electricGreen,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.45,
            shadowRadius: 16,
          }}>
          <Ionicons color={THEME_COLORS.electricGreen} name="shield-checkmark" size={28} />
        </View>
        <View className="items-center gap-3">
          <Text
            className="text-center text-3xl font-black uppercase text-white"
            style={{ letterSpacing: 0, lineHeight: 34 }}>
            {title}
          </Text>
          <Text className="text-center text-base font-semibold leading-6 text-white/65">
            {body}
          </Text>
        </View>
        <View className="w-full flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-electric-green/25 bg-electric-green/10 px-4 py-3">
            <Text className="text-center text-xs font-black uppercase text-electric-green">
              {chips[0]}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl border border-electric-green/25 bg-electric-green/10 px-4 py-3">
            <Text className="text-center text-xs font-black uppercase text-electric-green">
              {chips[1]}
            </Text>
          </View>
        </View>
        <View className="w-full">
          <Button loading={buttonLoading} onPress={onButtonPress} title={buttonLabel} />
        </View>
      </View>
    </Card>
  );
}
