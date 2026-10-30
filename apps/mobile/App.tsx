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
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/context/AppContext';
import { recordDelivery } from './src/notifications/health';
import { useT } from './src/i18n/useT';
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
  const { t } = useT();
  // Android draws the app behind the system bars, so the tab bar has to clear
  // the gesture strip or the three nav buttons itself.
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.text3,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ tabBarLabel: t('tab_today'), tabBarIcon: ({ color }) => <Home size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Medicines"
        component={MedicinesScreen}
        options={{ tabBarLabel: t('tab_medicines'), tabBarIcon: ({ color }) => <Pill size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ tabBarLabel: t('tab_insights'), tabBarIcon: ({ color }) => <Chart size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Visits"
        component={AppointmentsScreen}
        options={{ tabBarLabel: t('tab_visits'), tabBarIcon: ({ color }) => <Calendar size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: t('tab_settings'), tabBarIcon: ({ color }) => <SettingsIcon size={22} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const c = useTheme();
  const { t } = useT();
  const { user, wantsSignIn, loading, actOnDose, setAnnounceDoseId } = useApp();
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
      void recordDelivery(response.notification);
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
      // A plain tap opens Today, where the dose is listed — and is read aloud
      // there if the patient turned that on.
      else setAnnounceDoseId(doseId);
    });

    // A reminder arriving while the app is open is a delivery sample too.
    const received = Notifications.addNotificationReceivedListener((notification) => {
      void recordDelivery(notification);
    });

    return () => {
      responseListener.current?.remove();
      received.remove();
    };
  }, [actOnDose, setAnnounceDoseId]);

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
        <Text style={[type.sm, { color: c.text2 }]}>{t('loading')}</Text>
      </View>
    );
  }

  // The tab bar clears the nav buttons itself; the sign-in screen needs it done for it.
  return user && !wantsSignIn ? (
    <Tabs />
  ) : (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <SignInScreen />
    </SafeAreaView>
  );
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
          {/* Keeps every screen's heading below the clock and battery icons. */}
          <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.bg }}>
            <Root />
          </SafeAreaView>
        </AppProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
