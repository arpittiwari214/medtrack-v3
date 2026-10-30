import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { formatTimeFor, toLocalDate, toLocalTime } from '@medtrack/shared';
import { useApp } from '../context/AppContext';
import { WEB_URL } from '../config';
import { readOutbox } from '../storage/offline';
import { radius, spacing, type, useTheme } from '../theme';
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
import { formatDate } from '../i18n';
import { useT } from '../i18n/useT';

/** Android reports India's zone by its old name, "Asia/Calcutta"; say it plainly. */
const INDIA_ZONES = new Set(['Asia/Kolkata', 'Asia/Calcutta']);

/** Shown in their own script, so someone who cannot read English can still find theirs. */
const LANGUAGES: { value: string | null; label: string }[] = [
  { value: null, label: '' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
];

export default function SettingsScreen() {
  const c = useTheme();
  const { user, isLocal, setWantsSignIn, cache, signOut, refresh, syncing, prefs, updatePrefs } =
    useApp();
  const { t, locale } = useT();
  const zone = user?.timezone ?? 'Asia/Kolkata';

  const [queued, setQueued] = useState(0);

  // Changes waiting to go to the server, shown in the Sync panel.
  const loadQueued = useCallback(async () => {
    setQueued((await readOutbox()).length);
  }, []);

  useEffect(() => {
    void loadQueued();
  }, [loadQueued, cache]);

  function confirmSignOut() {
    Alert.alert(t(isLocal ? 'remove_all' : 'sign_out_title'), t(isLocal ? 'remove_all_body' : 'sign_out_body'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t(isLocal ? 'remove_all' : 'sign_out'), style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <ScrollView
      style={[sharedStyles.screen, { backgroundColor: c.bg }]}
      contentContainerStyle={sharedStyles.content}
    >
      <ScreenHeader title={t('settings_title')} />

      <View style={sharedStyles.stack}>
        {isLocal ? (
          <Panel>
            <PanelHead label={t('local_account')} />
            <PanelBody>
              <Text style={[type.sm, { color: c.text2, lineHeight: 20 }]}>{t('local_account_body')}</Text>
              <View style={{ marginTop: spacing.lg }}>
                <ActionSecondary label={t('back_up')} onPress={() => setWantsSignIn(true)} />
              </View>
            </PanelBody>
          </Panel>
        ) : (
          <Panel>
            <PanelHead label={t('account')} />
            <View>
              <ListRow title={user?.name ?? '—'} subtitle={t('name')} />
              <ListRow title={user?.email ?? '—'} subtitle={t('email')} />
              <ListRow title={INDIA_ZONES.has(zone) ? t('india_time') : zone} subtitle={t('timezone')} last />
            </View>
          </Panel>
        )}

        <Panel>
          <PanelHead label={t('language')} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.lg }}>
            {LANGUAGES.map((option) => {
              const selected = prefs.language === option.value;
              return (
                <Pressable
                  key={option.value ?? 'auto'}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => void updatePrefs({ language: option.value })}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.sm,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? c.brand : c.borderStrong,
                    backgroundColor: c.surface,
                  }}
                >
                  <Text style={[type.sm, { color: c.text, fontWeight: '600', textAlign: 'center' }]}>
                    {option.value === null ? t('language_auto') : option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Panel>

        <ReminderHealthPanel />

        <Panel>
          <PanelHead label={t('voice')} />
          <PanelBody>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.base, { color: c.text, fontWeight: '600' }]}>{t('speak_on_open')}</Text>
                <Text style={[type.xs, { color: c.text2, marginTop: 2, lineHeight: 18 }]}>
                  {t('speak_on_open_help')}
                </Text>
              </View>
              <Switch
                value={prefs.speakOnOpen}
                onValueChange={(value) => void updatePrefs({ speakOnOpen: value })}
                accessibilityLabel={t('speak_on_open')}
              />
            </View>
          </PanelBody>
        </Panel>

        {!isLocal && (
          <Panel>
            <PanelHead label={t('sync')} />
            <PanelBody>
              <View style={sharedStyles.rowBetween}>
                <Text style={[type.sm, { color: c.text2 }]}>{t('last_synced')}</Text>
                <Text style={[type.xs, { color: c.text }]}>
                  {cache.syncedAt
                    ? `${formatDate(locale, toLocalDate(cache.syncedAt, zone), 'short')}, ${formatTimeFor(toLocalTime(cache.syncedAt, zone), locale)}`
                    : t('never')}
                </Text>
              </View>
              <View style={[sharedStyles.rowBetween, { marginTop: spacing.md }]}>
                <Text style={[type.sm, { color: c.text2 }]}>{t('waiting_to_send')}</Text>
                <Text style={[type.xs, { color: c.text }]}>
                  {queued === 0 ? t('nothing') : t('changes_count', { n: queued })}
                </Text>
              </View>
              {queued > 0 && (
                <Text style={[type.xs, { color: c.text2, marginTop: spacing.md, lineHeight: 19 }]}>
                  {t('waiting_help')}
                </Text>
              )}
              <View style={{ marginTop: spacing.lg }}>
                <ActionSecondary label={t(syncing ? 'syncing' : 'sync_now')} onPress={refresh} />
              </View>
            </PanelBody>
          </Panel>
        )}

        <Panel>
          <PanelHead label={t('about')} />
          <PanelBody>
            <Text style={[type.xs, { color: c.text2, lineHeight: 19 }]}>{t('about_body')}</Text>
          </PanelBody>
          <View>
            <ListRow
              title={t('medical_disclaimer')}
              onPress={() => void Linking.openURL(`${WEB_URL}/medical-disclaimer`)}
            />
            <ListRow
              title={t('privacy_policy')}
              onPress={() => void Linking.openURL(`${WEB_URL}/privacy`)}
              last
            />
          </View>
        </Panel>

        <ActionSecondary label={t(isLocal ? 'remove_all' : 'sign_out')} onPress={confirmSignOut} />
      </View>
    </ScrollView>
  );
}
