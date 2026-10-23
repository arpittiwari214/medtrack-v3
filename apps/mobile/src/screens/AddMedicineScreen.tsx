/**
 * Adding a medicine, recognition first.
 *
 * Order follows how patients actually identify medicines: in a 901-patient
 * Indian survey, by pill or strip colour far more often than by name — 71% of
 * the time among those educated to high school or below, against 11.9% by
 * name. So the screen opens with "photograph the strip", then colours, then
 * the patient's own word for what it is for. The name comes after, and can be
 * left for someone else to fill in later.
 *
 * Saves locally first; it works with no signal and syncs when it can.
 */

import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createMedicineSchema, describeMedicine, todayIn, type MedicineColor } from '@medtrack/shared';
import { useApp } from '../context/AppContext';
import { MIN_TOUCH, radius, spacing, type, useTheme } from '../theme';
import { ActionPrimary, ActionSecondary, Banner, Panel, PanelBody, PanelHead } from '../components/ui';
import { ColorSwatches, MedicinePhoto, SlotPicker } from '../components/recognition';
import { VoiceRecorder } from '../components/voice';
import { type Locale, type Params, type StringKey } from '../i18n';
import { useT } from '../i18n/useT';
import { AlertTriangle } from '../components/icons';

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/**
 * A name the patient will recognise when none was typed — the server needs
 * one, and "White tablet for BP" is more useful to this patient than nothing.
 */
function fallbackName(
  pillColor: MedicineColor | null,
  purpose: string,
  hasPhoto: boolean,
  locale: Locale,
  t: (key: StringKey, params?: Params) => string,
): string | null {
  if (pillColor) return describeMedicine({ name: '', form: 'tablet', pillColor, purpose }, locale);
  if (purpose.trim()) return t('name_fallback_purpose', { purpose: purpose.trim() });
  if (hasPhoto) return t('name_fallback_photo');
  return null;
}

export default function AddMedicineScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const { addMedicine, user } = useApp();
  const { t, locale } = useT();

  const [photo, setPhoto] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [pillColor, setPillColor] = useState<MedicineColor | null>(null);
  const [stripColor, setStripColor] = useState<MedicineColor | null>(null);
  const [purpose, setPurpose] = useState('');
  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [isCritical, setIsCritical] = useState(false);
  const [units, setUnits] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(source: 'camera' | 'library') {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t('camera_denied_title'),
          t('camera_denied_body'),
        );
        return;
      }
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      // A strip is legible well below full resolution, and these live on the
      // phone indefinitely.
      quality: 0.5,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  }

  async function save() {
    setError('');
    const finalName = name.trim() || fallbackName(pillColor, purpose, photo !== null, locale, t);
    if (!finalName) {
      setError(t('need_something'));
      return;
    }

    const unitCount = Number(units);
    const parsed = createMedicineSchema.safeParse({
      name: finalName,
      strength: strength.trim(),
      form: 'tablet',
      isCritical,
      pillColor,
      stripColor,
      purpose: purpose.trim() || null,
      schedule: { kind: 'daily', times, startDate: todayIn(user?.timezone ?? deviceZone()) },
      stock:
        units.trim() && Number.isFinite(unitCount) && unitCount > 0
          ? { unitsRemaining: unitCount, unitsPerDose: 1, lowThreshold: 6 }
          : null,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('check_details'));
      return;
    }

    setBusy(true);
    try {
      await addMedicine(parsed.data, { photo, voice });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('save_failed'));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    minHeight: MIN_TOUCH + 4,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    ...type.base,
    color: c.text,
  } as const;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[type.title, { color: c.text }]}>{t('add_title')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={{ minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.sm }}
          >
            <Text style={[type.base, { color: c.text2 }]}>{t('cancel')}</Text>
          </Pressable>
        </View>

        {error !== '' && (
          <Banner tone="danger" icon={<AlertTriangle size={18} color={c.dangerInk} />}>
            {error}
          </Banner>
        )}

        <Panel>
          <PanelHead label={t('step_photo')} />
          <PanelBody style={{ gap: spacing.md }}>
            <View style={{ alignItems: 'center' }}>
              <MedicinePhoto uri={photo ?? undefined} color={pillColor} size={160} />
            </View>
            <ActionPrimary label={t(photo ? 'retake_photo' : 'take_photo')} onPress={() => void pick('camera')} />
            <ActionSecondary label={t('choose_gallery')} onPress={() => void pick('library')} />
            <Text style={[type.xs, { color: c.text3, lineHeight: 18 }]}>{t('photo_note')}</Text>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label={t('step_voice')} />
          <PanelBody style={{ gap: spacing.md }}>
            <Text style={[type.sm, { color: c.text2, lineHeight: 20 }]}>{t('voice_help')}</Text>
            <VoiceRecorder value={voice} onChange={setVoice} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label={t('step_look')} />
          <PanelBody style={{ gap: spacing.lg }}>
            <ColorSwatches label={t('tablet_colour')} value={pillColor} onChange={setPillColor} />
            <ColorSwatches label={t('strip_colour')} value={stripColor} onChange={setStripColor} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label={t('step_purpose')} />
          <PanelBody style={{ gap: spacing.md }}>
            <TextInput
              style={inputStyle}
              value={purpose}
              onChangeText={setPurpose}
              maxLength={40}
              placeholder={t('purpose_placeholder')}
              placeholderTextColor={c.text3}
              accessibilityLabel={t('step_purpose')}
            />
            <Text style={[type.sm, { color: c.text, fontWeight: '600', marginTop: spacing.sm }]}>
              {t('name_optional')}
            </Text>
            <TextInput
              style={inputStyle}
              value={name}
              onChangeText={setName}
              maxLength={200}
              placeholder={t('name_placeholder')}
              placeholderTextColor={c.text3}
              accessibilityLabel={t('name_optional')}
            />
            <Text style={[type.sm, { color: c.text, fontWeight: '600' }]}>{t('strength_optional')}</Text>
            <TextInput
              style={inputStyle}
              value={strength}
              onChangeText={setStrength}
              maxLength={100}
              placeholder={t('strength_placeholder')}
              placeholderTextColor={c.text3}
              accessibilityLabel={t('strength_optional')}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label={t('step_when')} />
          <PanelBody>
            <SlotPicker times={times} onChange={setTimes} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label={t('step_more')} />
          <PanelBody style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.base, { color: c.text, fontWeight: '600' }]}>{t('important_toggle')}</Text>
                <Text style={[type.xs, { color: c.text2, lineHeight: 18 }]}>{t('important_help')}</Text>
              </View>
              <Switch value={isCritical} onValueChange={setIsCritical} accessibilityLabel={t('important_toggle')} />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.base, { color: c.text, fontWeight: '600' }]}>{t('tablets_count')}</Text>
              <TextInput
                style={inputStyle}
                value={units}
                onChangeText={(text) => setUnits(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={t('tablets_placeholder')}
                placeholderTextColor={c.text3}
                accessibilityLabel={t('tablets_count')}
              />
              <Text style={[type.xs, { color: c.text2, lineHeight: 18 }]}>{t('tablets_help')}</Text>
            </View>
          </PanelBody>
        </Panel>

        <ActionPrimary label={t(busy ? 'saving' : 'save_medicine')} onPress={() => void save()} disabled={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
