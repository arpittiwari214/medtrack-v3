/**
 * App shell.
 *
 * Handles the two things that must work for a medication reminder to be useful:
 * the notification action handlers (so "Taken" from the lock screen actually
 * records the dose), and the sign-in gate.
 */

import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';

import { AppProvider, useApp } from './src/context/AppContext.js';
import SignInScreen from './src/screens/SignInScreen.js';
import TodayScreen from './src/screens/TodayScreen.js';
import MedicinesScreen from './src/screens/MedicinesScreen.js';
import SettingsScreen from './src/screens/SettingsScreen.js';
import { colors, spacing, type } from './src/theme.js';

const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon glyph="🏠" color={color} /> }}
      />
      <Tab.Screen
        name="Medicines"
        component={MedicinesScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon glyph="💊" color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon glyph="⚙️" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

function Root() {
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
      if (action === 'TAKEN') void actOnDose(doseId, 'take');
      else if (action === 'SNOOZE') void actOnDose(doseId, 'snooze', 10);
      // A plain tap just opens the app on Today, where the dose is listed.
    });

    return () => {
      responseListener.current?.remove();
    };
  }, [actOnDose]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingIcon}>💊</Text>
        <ActivityIndicator color={colors.navy} />
        <Text style={styles.loadingText}>Loading MedTrack…</Text>
      </View>
    );
  }

  return user ? <Tabs /> : <SignInScreen />;
}

export default function App() {
  const scheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppProvider>
          <StatusBar style="auto" />
          <Root />
        </AppProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  loadingIcon: { fontSize: 44 },
  loadingText: { ...type.body, color: colors.textMuted },
});
