import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, PressableScale, ScreenWrapper, TextInput } from '@/components/ui';
import {
  LEAGUE_SPORT_OPTIONS,
  LEAGUE_TYPE_OPTIONS,
  LEAGUE_VISIBILITY_OPTIONS,
  MAX_MEMBER_OPTIONS,
} from '@/constants/league-options';
import { THEME_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCreateLeagueMutation } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import type { LeagueSport, LeagueType, LeagueVisibility } from '@/types/database';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const LEAGUE_TYPE_ICONS: Record<LeagueType, IoniconName> = {
  h2h: 'people',
  cumulative: 'trending-up',
};

const VISIBILITY_ICONS: Record<LeagueVisibility, IoniconName> = {
  public: 'earth',
  private: 'lock-closed',
};

function SectionHeader({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <View className="gap-1">
      <Text
        className="text-[11px] font-black uppercase text-electric-green"
        style={{ letterSpacing: 2.5 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-sm font-semibold text-white/55">{subtitle}</Text>
      ) : null}
    </View>
  );
}

function ToggleOption({
  description,
  disabled,
  icon,
  isSelected,
  label,
  onPress,
}: {
  description?: string;
  disabled?: boolean;
  icon: IoniconName;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flex: 1 }}>
      <View
        className={cn(
          'flex-1 gap-3 rounded-2xl border p-4',
          isSelected
            ? 'border-electric-green bg-electric-green/10'
            : 'border-white/10 bg-white/[0.04]',
          disabled && 'opacity-40',
        )}
        style={
          isSelected
            ? {
                shadowColor: THEME_COLORS.electricGreen,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
              }
            : undefined
        }>
        <View className="flex-row items-center justify-between">
          <View
            className={cn(
              'h-10 w-10 items-center justify-center rounded-xl border',
              isSelected
                ? 'border-electric-green/40 bg-electric-green/15'
                : 'border-white/10 bg-white/[0.04]',
            )}>
            <Ionicons
              color={isSelected ? THEME_COLORS.electricGreen : 'rgba(255,255,255,0.65)'}
              name={icon}
              size={18}
            />
          </View>
          {isSelected ? (
            <Ionicons color={THEME_COLORS.electricGreen} name="checkmark-circle" size={20} />
          ) : (
            <View className="h-5 w-5 rounded-full border border-white/15" />
          )}
        </View>
        <View className="gap-1">
          <Text
            className={cn(
              'text-sm font-black uppercase',
              isSelected ? 'text-white' : 'text-white/85',
            )}
            style={{ letterSpacing: 0.5 }}>
            {label}
          </Text>
          {description ? (
            <Text className="text-xs font-semibold leading-4 text-white/55">{description}</Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

export default function CreateLeagueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const createLeague = useCreateLeagueMutation(user?.id);
  const [name, setName] = useState('');
  const [type, setType] = useState<LeagueType>('h2h');
  const [visibility, setVisibility] = useState<LeagueVisibility>('private');
  const [maxMembers, setMaxMembers] = useState(10);
  const [sport, setSport] = useState<LeagueSport>('nfl');
  const [nameError, setNameError] = useState<string | undefined>();

  const handleSubmit = async () => {
    setNameError(undefined);

    if (name.trim().length < 2) {
      setNameError('League name needs at least 2 characters.');
      return;
    }

    try {
      const leagueId = await createLeague.mutateAsync({
        maxMembers,
        name,
        sport,
        type,
        visibility,
      });
      router.replace({ pathname: '/leagues/[leagueId]', params: { leagueId } });
    } catch (error) {
      Alert.alert('Could not create league', error instanceof Error ? error.message : 'Try again.');
    }
  };

  return (
    <ScreenWrapper scroll>
      <View className="gap-4">
        <View>
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            <Text
              className="text-[11px] font-semibold uppercase text-electric-green"
              style={{ letterSpacing: 1.2 }}>
              New League
            </Text>
          </View>
          <Text
            className="mt-1 text-2xl font-extrabold text-white"
            style={{ letterSpacing: -0.4 }}>
            Create League
          </Text>
          <Text className="mt-1 text-sm font-medium text-white/55">
            Set the format now. You can tune deeper rules later as commissioner.
          </Text>
        </View>

        <View>
          <Card>
            <View className="gap-7">
              <TextInput
                error={nameError}
                label="League name"
                onChangeText={setName}
                placeholder="Sunday Syndicate"
                value={name}
              />

              <View className="gap-3">
                <SectionHeader
                  subtitle="Pick how members compete each week."
                  title="League Format"
                />
                <View className="flex-row gap-3">
                  {LEAGUE_TYPE_OPTIONS.map((option) => (
                    <ToggleOption
                      description={option.description}
                      icon={LEAGUE_TYPE_ICONS[option.value]}
                      isSelected={type === option.value}
                      key={option.value}
                      label={option.label}
                      onPress={() => setType(option.value)}
                    />
                  ))}
                </View>
              </View>

              <View className="gap-3">
                <SectionHeader
                  subtitle="Public rooms appear in browse. Private requires the invite code."
                  title="Visibility"
                />
                <View className="flex-row gap-3">
                  {LEAGUE_VISIBILITY_OPTIONS.map((option) => (
                    <ToggleOption
                      description={option.description}
                      icon={VISIBILITY_ICONS[option.value]}
                      isSelected={visibility === option.value}
                      key={option.value}
                      label={option.label}
                      onPress={() => setVisibility(option.value)}
                    />
                  ))}
                </View>
              </View>

              <View className="gap-3">
                <SectionHeader subtitle="Cap your roster anywhere from 4 to 12." title="Max Members" />
                <View className="flex-row flex-wrap gap-2">
                  {MAX_MEMBER_OPTIONS.map((option) => {
                    const selected = maxMembers === option;
                    return (
                      <Pressable key={option} onPress={() => setMaxMembers(option)}>
                        <View
                          className={cn(
                            'h-14 w-16 items-center justify-center rounded-2xl border',
                            selected
                              ? 'border-electric-green bg-electric-green/15'
                              : 'border-white/10 bg-white/[0.04]',
                          )}
                          style={
                            selected
                              ? {
                                  shadowColor: THEME_COLORS.electricGreen,
                                  shadowOffset: { width: 0, height: 0 },
                                  shadowOpacity: 0.4,
                                  shadowRadius: 10,
                                }
                              : undefined
                          }>
                          <Text
                            className={cn(
                              'text-lg font-black',
                              selected ? 'text-electric-green' : 'text-white',
                            )}>
                            {option}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="gap-3">
                <SectionHeader subtitle="Launching with NFL. NBA & MLB drop next season." title="Sport" />
                <View className="flex-row flex-wrap gap-2">
                  {LEAGUE_SPORT_OPTIONS.map((option) => {
                    const selected = sport === option.value;
                    return (
                      <Pressable
                        disabled={option.disabled}
                        key={option.value}
                        onPress={() => setSport(option.value)}>
                        <View
                          className={cn(
                            'flex-row items-center gap-2 rounded-full border px-4 py-3',
                            selected
                              ? 'border-electric-green bg-electric-green/15'
                              : 'border-white/10 bg-white/[0.04]',
                            option.disabled && 'opacity-35',
                          )}>
                          {selected ? (
                            <Ionicons
                              color={THEME_COLORS.electricGreen}
                              name="checkmark"
                              size={14}
                            />
                          ) : null}
                          <Text
                            className={cn(
                              'text-sm font-black',
                              selected ? 'text-electric-green' : 'text-white',
                            )}
                            style={{ letterSpacing: 1 }}>
                            {option.label}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <Badge label="NFL only at launch" tone="gold" />
              </View>

              <Button
                loading={createLeague.isPending}
                title="Create League"
                onPress={handleSubmit}
              />
            </View>
          </Card>
        </View>
      </View>
    </ScreenWrapper>
  );
}
