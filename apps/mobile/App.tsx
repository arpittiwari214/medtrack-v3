/**
 * App shell.
 *
 * Handles the two things that must work for a medication reminder to be useful:
 * the notification action handlers (so "Taken" from the lock screen actually
 * records the dose), and the sign-in gate.
 */

import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/context/AppContext';
import SignInScreen from './src/screens/SignInScreen';
import TodayScreen from './src/screens/TodayScreen';
import MedicinesScreen from './src/screens/MedicinesScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { Calendar, Chart, Home, Pill, Settings as SettingsIcon } from './src/components/icons';
import { spacing, staticPalette, type, useTheme } from './src/theme';

const Tab = createBottomTabNavigator();

function Tabs() {
  const c = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.text3,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ tabBarIcon: ({ color }) => <Home size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Medicines"
        component={MedicinesScreen}
        options={{ tabBarIcon: ({ color }) => <Pill size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ tabBarIcon: ({ color }) => <Chart size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Visits"
        component={AppointmentsScreen}
        options={{ tabBarIcon: ({ color }) => <Calendar size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ color }) => <SettingsIcon size={22} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const c = useTheme();
  const { user, loading, actOnDose } = useApp();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  /**
   * Handle taps and action buttons on a dose reminder.
   *
   * Recording a dose from the notification itself — without unlocking, opening
   * the app and finding the row — is what turns a reminder into a logged dose
   * rather than a dismissed banner.
   */
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { doseId?: string } | undefined;
      const doseId = data?.doseId;
      if (!doseId) return;

      const action = response.actionIdentifier;
      // The same response can be delivered twice — once parked while the app
      // was starting, once live — and acting on an already-taken dose is an
      // illegal transition. That is a harmless duplicate, not an error.
      const ignoreDuplicate = () => undefined;
      if (action === 'TAKEN') actOnDose(doseId, 'take').catch(ignoreDuplicate);
      else if (action === 'SNOOZE') actOnDose(doseId, 'snooze', 10).catch(ignoreDuplicate);
      // A plain tap just opens the app on Today, where the dose is listed.
    });

    return () => {
      responseListener.current?.remove();
    };
  }, [actOnDose]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.bg,
          gap: spacing.md,
        }}
      >
        <Pill size={36} color={c.brand} />
        <ActivityIndicator color={c.brand} />
        <Text style={[type.sm, { color: c.text2 }]}>Loading MedTrack…</Text>
      </View>
    );
  }

  return user ? <Tabs /> : <SignInScreen />;
}

export default function App() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? staticPalette.dark : staticPalette.light;

  /** Navigation's own theme, so its surfaces match ours rather than defaulting. */
  const navigationTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      primary: palette.brand,
      background: palette.bg,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
      notification: palette.dangerSolid,
    },
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <AppProvider>
          <StatusBar style="auto" />
          <Root />
        </AppProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
