import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME_COLORS } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ICON_SIZE = 24;
const ICON_BOX = 28;

function TabBarIcon({ color, focused, name }: { color: string; focused: boolean; name: IoniconName }) {
  return (
    <View style={{ alignItems: 'center', height: ICON_BOX + 8, justifyContent: 'center', width: ICON_BOX + 24 }}>
      <View
        style={{
          alignItems: 'center',
          height: 3,
          justifyContent: 'center',
          marginBottom: 4,
          width: 22,
        }}>
        {focused ? (
          <View
            style={{
              backgroundColor: THEME_COLORS.electricGreen,
              borderRadius: 2,
              height: 3,
              shadowColor: THEME_COLORS.electricGreen,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: 4,
              width: 22,
            }}
          />
        ) : null}
      </View>
      <View style={{ alignItems: 'center', height: ICON_BOX, justifyContent: 'center', width: ICON_BOX }}>
        <Ionicons color={color} name={name} size={ICON_SIZE} />
      </View>
    </View>
  );
}

function TabButton({
  accessibilityLabel,
  accessibilityState,
  children,
  onPress,
  onPressIn,
  onPressOut,
  testID,
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      android_ripple={{ borderless: true, color: 'transparent' }}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => ({
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
      testID={testID}>
      {children as React.ReactNode}
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);
  const tabBarHeight = 64 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME_COLORS.electricGreen,
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarInactiveTintColor: THEME_COLORS.textMuted,
        tabBarItemStyle: {
          height: tabBarHeight,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 2,
          textTransform: 'none',
        },
        tabBarStyle: {
          backgroundColor: THEME_COLORS.background,
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon color={color} focused={focused} name={focused ? 'flame' : 'flame-outline'} />
          ),
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'Leagues',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name={focused ? 'shield' : 'shield-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bet-board"
        options={{
          title: 'Bet Board',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name={focused ? 'pulse' : 'pulse-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaders',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name={focused ? 'trophy' : 'trophy-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name={focused ? 'person-circle' : 'person-circle-outline'}
            />
          ),
        }}
      />
    </Tabs>
  );
}
