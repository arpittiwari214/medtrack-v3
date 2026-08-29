import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import {
  pendingReminderCount,
  requestPermission,
  rescheduleReminders,
} from '../notifications/index';
import { readOutbox } from '../storage/offline';
import { spacing, type, useTheme } from '../theme';
import {
  ActionSecondary,
  Banner,
  ListRow,
  Panel,
  PanelBody,
  PanelHead,
  ScreenHeader,
  sharedStyles,
} from '../components/ui';
import { AlertTriangle } from '../components/icons';

export default function SettingsScreen() {
  const c = useTheme();
  const { user, cache, signOut, refresh, syncing } = useApp();

  const [scheduled, setScheduled] = useState(0);
  const [queued, setQueued] = useState(0);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'unknown'>('unknown');

  /**
   * Diagnostics that matter for a reminder app. "Are notifications actually
   * permitted, and how many are queued with the OS" is the first thing to check
   * when someone says reminders stopped — so it is visible to the user rather
   * than buried in a support request.
   */
  const loadDiagnostics = useCallback(async () => {
    const [count, outbox] = await Promise.all([pendingReminderCount(), readOutbox()]);
    setScheduled(count);
    setQueued(outbox.length);
  }, []);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics, cache]);

  async function enableNotifications() {
    const result = await requestPermission();
    setPermission(result.granted ? 'granted' : 'denied');

    if (result.granted) {
      await rescheduleReminders(cache.medicines);
      await loadDiagnostics();
      return;
    }

    if (!result.canAskAgain) {
      // iOS will not re-prompt once denied — the only route is Settings, so say
      // that plainly instead of showing a button that silently does nothing.
      Alert.alert(
        'Notifications are turned off',
        'MedTrack cannot remind you without notification permission. You can turn it back on in your device settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
    }
  }

  function confirmSignOut() {
    Alert.alert(
      'Sign out?',
      'Your reminders stop on this device and your offline data is removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  }

  return (
    <ScrollView
      style={[sharedStyles.screen, { backgroundColor: c.bg }]}
      contentContainerStyle={sharedStyles.content}
    >
      <ScreenHeader eyebrow={user?.email} title="Settings" />

      <View style={sharedStyles.stack}>
        <Panel>
          <PanelHead label="Account" />
          <View>
            <ListRow title={user?.name ?? '—'} subtitle="Name" />
            <ListRow title={user?.timezone ?? '—'} subtitle="Timezone" last />
          </View>
        </Panel>

        <Panel>
          <PanelHead label="Reminders" />
          <PanelBody>
            <View style={sharedStyles.rowBetween}>
              <Text style={[type.sm, { color: c.text2 }]}>Scheduled on this device</Text>
              <Text style={[type.base, { color: c.text, fontWeight: '700' }]}>{scheduled}</Text>
            </View>
            <Text style={[type.xs, { color: c.text2, marginTop: spacing.md, lineHeight: 19 }]}>
              Reminders are scheduled with your phone in advance, so they arrive even with the app
              closed and no internet.
            </Text>
            <View style={{ marginTop: spacing.lg }}>
              <ActionSecondary label="Check notification permission" onPress={enableNotifications} />
            </View>
            {permission === 'denied' && (
              <View style={{ marginTop: spacing.md }}>
                <Banner tone="danger" icon={<AlertTriangle size={16} color={c.dangerInk} />}>
                  Notifications are blocked. MedTrack cannot remind you until you allow them.
                </Banner>
              </View>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label="Sync" />
          <PanelBody>
            <View style={sharedStyles.rowBetween}>
              <Text style={[type.sm, { color: c.text2 }]}>Last synced</Text>
              <Text style={[type.xs, { color: c.text }]}>
                {cache.syncedAt ? new Date(cache.syncedAt).toLocaleString() : 'Never'}
              </Text>
            </View>
            <View style={[sharedStyles.rowBetween, { marginTop: spacing.md }]}>
              <Text style={[type.sm, { color: c.text2 }]}>Waiting to send</Text>
              <Text style={[type.xs, { color: c.text }]}>
                {queued === 0 ? 'Nothing' : `${queued} changes`}
              </Text>
            </View>
            {queued > 0 && (
              <Text style={[type.xs, { color: c.text2, marginTop: spacing.md, lineHeight: 19 }]}>
                These are saved on your phone and go out automatically when you are back online.
              </Text>
            )}
            <View style={{ marginTop: spacing.lg }}>
              <ActionSecondary label={syncing ? 'Syncing…' : 'Sync now'} onPress={refresh} />
            </View>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label="About" />
          <PanelBody>
            <Text style={[type.xs, { color: c.text2, lineHeight: 19 }]}>
              MedTrack is a reminder tool, not a medical device. It does not give medical advice, and
              it should not be your only safeguard for an important medicine.
            </Text>
          </PanelBody>
          <View>
            <ListRow
              title="Medical disclaimer"
              onPress={() => void Linking.openURL('https://medtrack.app/medical-disclaimer')}
            />
            <ListRow
              title="Privacy policy"
              onPress={() => void Linking.openURL('https://medtrack.app/privacy')}
              last
            />
          </View>
        </Panel>

        <ActionSecondary label="Sign out" onPress={confirmSignOut} />
      </View>
    </ScrollView>
  );
}
