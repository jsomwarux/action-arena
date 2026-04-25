import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';

import { THEME_COLORS } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ICON_SIZE = 26;

function TabIcon({ color, name }: { color: string; name: IoniconName }) {
  return <Ionicons color={color} name={name} size={ICON_SIZE} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME_COLORS.electricGreen,
        tabBarInactiveTintColor: THEME_COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.2,
          textTransform: 'none',
        },
        tabBarStyle: {
          backgroundColor: THEME_COLORS.background,
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          elevation: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="flame-outline" />,
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'Leagues',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="shield-outline" />,
        }}
      />
      <Tabs.Screen
        name="bet-board"
        options={{
          title: 'Bet Board',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="pulse-outline" />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaders',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="trophy-outline" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="person-circle-outline" />,
        }}
      />
    </Tabs>
  );
}
