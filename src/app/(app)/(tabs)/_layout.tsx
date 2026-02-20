import { type IconProps } from '@expo/vector-icons/build/createIconSet.js';
import _MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons.js';
import { Tabs } from 'expo-router';
import { fbs } from 'fbtee';
import { FC } from 'react';

// Types in `@expo/vector-icons` do not currently work correctly in `"type": "module"` packages.
const MaterialCommunityIcons = _MaterialCommunityIcons as unknown as FC<IconProps<string>>;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: '#000',
        },
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopWidth: 0,
          height: 78,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#0000fe',
        tabBarInactiveTintColor: '#9a9a9a',
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <MaterialCommunityIcons color={focused ? '#0000fe' : '#9a9a9a'} name="home" size={28} />
          ),
          title: String(fbs('Home', 'Home tab title')),
        }}
      />
      <Tabs.Screen
        name="contacto"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <MaterialCommunityIcons
              color={focused ? '#0000fe' : '#9a9a9a'}
              name="dots-horizontal"
              size={30}
            />
          ),
          title: 'Contacto',
        }}
      />
    </Tabs>
  );
}
