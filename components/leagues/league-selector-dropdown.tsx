import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Card, ModalShell, PressableScale } from '@/components/ui';
import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import type { LeagueRow } from '@/types/database';

type LeagueSelectorDropdownProps = {
  contextLabel?: string;
  leagues: LeagueRow[];
  modalEyebrow?: string;
  modalTitle?: string;
  onSelect: (leagueId: string) => void;
  selectedLeagueId: string | undefined;
  title?: string;
};

export function LeagueSelectorDropdown({
  contextLabel = 'Picking for',
  leagues,
  modalEyebrow = 'Switch League',
  modalTitle = 'Pick Where to Play',
  onSelect,
  selectedLeagueId,
  title = 'Active League',
}: LeagueSelectorDropdownProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (leagues.length <= 1) {
    return null;
  }

  const selected = leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0];

  return (
    <View className="gap-2">
      <Text
        className="text-[10px] font-black uppercase text-white/50"
        style={{ letterSpacing: 2 }}>
        {title}
      </Text>
      <PressableScale
        onPress={() => {
          haptics.selection();
          setPickerOpen(true);
        }}
        pressedScale={0.97}>
        <View
          className="flex-row items-center justify-between rounded-2xl border border-electric-green/35 bg-electric-green/[0.08] px-4 py-3"
          style={{
            shadowColor: THEME_COLORS.electricGreen,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
          }}>
          <View className="flex-1 flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-xl border border-electric-green/40 bg-electric-green/15">
              <Ionicons color={THEME_COLORS.electricGreen} name="trophy" size={14} />
            </View>
            <View className="flex-1">
              <Text
                className="text-[10px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 1.5 }}>
                {contextLabel}
              </Text>
              <Text
                className="text-base font-black text-white"
                numberOfLines={1}
                style={{ letterSpacing: -0.3 }}>
                {selected.name}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5">
              <Text
                className="text-[10px] font-black uppercase text-white/65"
                style={{ letterSpacing: 1 }}>
                {leagues.length}
              </Text>
            </View>
            <Ionicons color="rgba(255,255,255,0.6)" name="chevron-down" size={16} />
          </View>
        </View>
      </PressableScale>

      <Modal
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
        transparent
        visible={pickerOpen}>
        <ModalShell variant="overlay">
          <Pressable
            accessibilityRole="button"
            className="flex-1 justify-center bg-black/75 px-5"
            onPress={() => setPickerOpen(false)}>
            <Pressable accessibilityRole="none" onPress={() => undefined}>
              <Card>
                <View className="gap-4">
                  <View>
                    <Text
                      className="text-[10px] font-black uppercase text-electric-green"
                      style={{ letterSpacing: 2 }}>
                      {modalEyebrow}
                    </Text>
                    <Text
                      className="mt-1 text-2xl font-black uppercase text-white"
                      style={{ letterSpacing: -0.4 }}>
                      {modalTitle}
                    </Text>
                  </View>
                  <ScrollView style={{ maxHeight: 360 }}>
                    <View className="gap-2">
                      {leagues.map((league) => {
                        const isSelected = league.id === selected.id;
                        return (
                          <PressableScale
                            key={league.id}
                            onPress={() => {
                              haptics.selection();
                              onSelect(league.id);
                              setPickerOpen(false);
                            }}
                            pressedScale={0.97}>
                            <View
                              className={cn(
                                'flex-row items-center justify-between rounded-2xl border px-4 py-3',
                                isSelected
                                  ? 'border-electric-green/60 bg-electric-green/15'
                                  : 'border-white/10 bg-white/[0.04]',
                              )}>
                              <View className="flex-1 pr-2">
                                <Text
                                  className={cn(
                                    'text-sm font-black uppercase',
                                    isSelected ? 'text-electric-green' : 'text-white',
                                  )}
                                  numberOfLines={2}
                                  style={{ letterSpacing: 0.4 }}>
                                  {league.name}
                                </Text>
                                <Text
                                  className="mt-1 text-[11px] font-semibold text-white/45"
                                  numberOfLines={1}>
                                  Week {league.current_week} ·{' '}
                                  {league.type === 'h2h' ? 'Head-to-Head' : 'Cumulative'}
                                </Text>
                              </View>
                              <Ionicons
                                color={
                                  isSelected
                                    ? THEME_COLORS.electricGreen
                                    : 'rgba(255,255,255,0.35)'
                                }
                                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                                size={22}
                              />
                            </View>
                          </PressableScale>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <Button onPress={() => setPickerOpen(false)} title="Close" variant="secondary" />
                </View>
              </Card>
            </Pressable>
          </Pressable>
        </ModalShell>
      </Modal>
    </View>
  );
}
