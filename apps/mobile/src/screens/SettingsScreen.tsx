import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Switch, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { readOutbox } from '../storage/offline';
import { spacing, type, useTheme } from '../theme';
import {
  ActionSecondary,
  ListRow,
  Panel,
  PanelBody,
  PanelHead,
  ScreenHeader,
  sharedStyles,
} from '../components/ui';
import { ReminderHealthPanel } from '../components/ReminderHealth';

export default function SettingsScreen() {
  const c = useTheme();
  const { user, cache, signOut, refresh, syncing, prefs, updatePrefs } = useApp();

  const [queued, setQueued] = useState(0);

  // Changes waiting to go to the server, shown in the Sync panel.
  const loadQueued = useCallback(async () => {
    setQueued((await readOutbox()).length);
  }, []);

  useEffect(() => {
    void loadQueued();
  }, [loadQueued, cache]);

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

        <ReminderHealthPanel />

        <Panel>
          <PanelHead label="Voice" />
          <PanelBody>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.base, { color: c.text, fontWeight: '600' }]}>
                  Read reminders aloud when I open them
                </Text>
                <Text style={[type.xs, { color: c.text2, marginTop: 2, lineHeight: 18 }]}>
                  Plays your voice note, or reads the medicine out. Others nearby will hear what it is for.
                </Text>
              </View>
              <Switch
                value={prefs.speakOnOpen}
                onValueChange={(value) => void updatePrefs({ speakOnOpen: value })}
                accessibilityLabel="Read reminders aloud when I open them"
              />
            </View>
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
