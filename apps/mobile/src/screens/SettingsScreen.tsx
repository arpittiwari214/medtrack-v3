import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext.js';
import {
  pendingReminderCount,
  requestPermission,
  rescheduleReminders,
} from '../notifications/index.js';
import { readOutbox } from '../storage/offline.js';
import { colors, radius, spacing, type, MIN_TOUCH } from '../theme.js';

export default function SettingsScreen() {
  const { user, cache, signOut, refresh, syncing } = useApp();

  const [scheduled, setScheduled] = useState(0);
  const [queued, setQueued] = useState(0);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'unknown'>('unknown');

  /**
   * Diagnostics that matter for a reminder app.
   *
   * "Are notifications actually permitted, and how many are queued with the OS"
   * is the first thing to check when someone says reminders stopped — so it is
   * visible to the user rather than buried in a support request.
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
      'Your reminders will stop on this device and your offline data will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Row label="Name" value={user?.name ?? '—'} />
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Timezone" value={user?.timezone ?? '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reminders</Text>
        <Row label="Scheduled on this device" value={String(scheduled)} />
        <Text style={styles.hint}>
          Reminders are scheduled with your phone in advance, so they arrive even with the app closed
          and no internet.
        </Text>
        <Button label="Check notification permission" onPress={enableNotifications} />
        {permission === 'denied' && (
          <Text style={styles.warning}>
            Notifications are blocked. MedTrack cannot remind you until you allow them.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync</Text>
        <Row
          label="Last synced"
          value={cache.syncedAt ? new Date(cache.syncedAt).toLocaleString() : 'Never'}
        />
        <Row label="Waiting to send" value={queued === 0 ? 'Nothing' : `${queued} changes`} />
        {queued > 0 && (
          <Text style={styles.hint}>
            These are saved on your phone and will be sent automatically when you are back online.
          </Text>
        )}
        <Button label={syncing ? 'Syncing…' : 'Sync now'} onPress={refresh} disabled={syncing} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.hint}>
          MedTrack is a reminder tool, not a medical device. It does not give medical advice, and it
          should not be your only safeguard for an important medicine.
        </Text>
        <Button
          label="Read the medical disclaimer"
          onPress={() => void Linking.openURL('https://medtrack.app/medical-disclaimer')}
        />
        <Button
          label="Privacy policy"
          onPress={() => void Linking.openURL('https://medtrack.app/privacy')}
        />
      </View>

      <Button label="Sign out" tone="danger" onPress={confirmSignOut} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  tone = 'neutral',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        tone === 'danger' && styles.buttonDanger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonText, tone === 'danger' && styles.buttonTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...type.display, color: colors.text, marginBottom: spacing.sm },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { ...type.heading, color: colors.text },

  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...type.body, color: colors.textMuted },
  rowValue: { ...type.body, color: colors.text, flexShrink: 1, textAlign: 'right' },

  hint: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  warning: { ...type.caption, color: colors.danger },

  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonDanger: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  buttonText: { ...type.label, fontWeight: '600', color: colors.text },
  buttonTextDanger: { color: colors.danger },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
