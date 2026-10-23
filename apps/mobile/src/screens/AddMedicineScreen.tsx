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
function fallbackName(pillColor: MedicineColor | null, purpose: string, hasPhoto: boolean): string | null {
  if (pillColor) return describeMedicine({ name: '', form: 'tablet', pillColor, purpose });
  if (purpose.trim()) return `Medicine for ${purpose.trim()}`;
  if (hasPhoto) return 'Medicine in the photo';
  return null;
}

export default function AddMedicineScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const { addMedicine, user } = useApp();

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
          'Camera not allowed',
          'You can still choose a photo from your gallery, or skip the photo and pick the colours.',
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
    const finalName = name.trim() || fallbackName(pillColor, purpose, photo !== null);
    if (!finalName) {
      setError('Add a photo, a colour or a name, so you can recognise it later.');
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
      setError(parsed.error.issues[0]?.message ?? 'Please check the details.');
      return;
    }

    setBusy(true);
    try {
      await addMedicine(parsed.data, { photo, voice });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this medicine.');
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
          <Text style={[type.title, { color: c.text }]}>Add a medicine</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={{ minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.sm }}
          >
            <Text style={[type.base, { color: c.text2 }]}>Cancel</Text>
          </Pressable>
        </View>

        {error !== '' && (
          <Banner tone="danger" icon={<AlertTriangle size={18} color={c.dangerInk} />}>
            {error}
          </Banner>
        )}

        <Panel>
          <PanelHead label="1 · Photo of the strip" />
          <PanelBody style={{ gap: spacing.md }}>
            <View style={{ alignItems: 'center' }}>
              <MedicinePhoto uri={photo ?? undefined} color={pillColor} size={160} />
            </View>
            <ActionPrimary label={photo ? 'Take it again' : 'Take a photo'} onPress={() => void pick('camera')} />
            <ActionSecondary label="Choose from gallery" onPress={() => void pick('library')} />
            <Text style={[type.xs, { color: c.text3, lineHeight: 18 }]}>
              The photo stays on this phone. It helps you tell look-alike medicines apart.
            </Text>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label="Voice note (optional)" />
          <PanelBody style={{ gap: spacing.md }}>
            <Text style={[type.sm, { color: c.text2, lineHeight: 20 }]}>
              Say what it is in your own words — for example, “the white one for BP, after breakfast”.
              It plays when you tap the speaker. Family can record it for you.
            </Text>
            <VoiceRecorder value={voice} onChange={setVoice} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label="2 · How does it look?" />
          <PanelBody style={{ gap: spacing.lg }}>
            <ColorSwatches label="Tablet colour" value={pillColor} onChange={setPillColor} />
            <ColorSwatches label="Strip colour" value={stripColor} onChange={setStripColor} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label="3 · What is it for?" />
          <PanelBody style={{ gap: spacing.md }}>
            <TextInput
              style={inputStyle}
              value={purpose}
              onChangeText={setPurpose}
              maxLength={40}
              placeholder="BP, sugar, thyroid…"
              placeholderTextColor={c.text3}
              accessibilityLabel="What is it for"
            />
            <Text style={[type.sm, { color: c.text, fontWeight: '600', marginTop: spacing.sm }]}>
              Name on the strip (optional)
            </Text>
            <TextInput
              style={inputStyle}
              value={name}
              onChangeText={setName}
              maxLength={200}
              placeholder="e.g. Telma 40"
              placeholderTextColor={c.text3}
              accessibilityLabel="Name on the strip"
            />
            <Text style={[type.sm, { color: c.text, fontWeight: '600' }]}>Strength (optional)</Text>
            <TextInput
              style={inputStyle}
              value={strength}
              onChangeText={setStrength}
              maxLength={100}
              placeholder="e.g. 40 mg"
              placeholderTextColor={c.text3}
              accessibilityLabel="Strength"
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label="4 · When" />
          <PanelBody>
            <SlotPicker times={times} onChange={setTimes} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead label="5 · More (optional)" />
          <PanelBody style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.base, { color: c.text, fontWeight: '600' }]}>This one is important</Text>
                <Text style={[type.xs, { color: c.text2, lineHeight: 18 }]}>
                  Your caregivers are told the first time it is missed.
                </Text>
              </View>
              <Switch value={isCritical} onValueChange={setIsCritical} accessibilityLabel="This one is important" />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.base, { color: c.text, fontWeight: '600' }]}>How many tablets do you have?</Text>
              <TextInput
                style={inputStyle}
                value={units}
                onChangeText={(text) => setUnits(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="e.g. 30"
                placeholderTextColor={c.text3}
                accessibilityLabel="How many tablets you have"
              />
              <Text style={[type.xs, { color: c.text2, lineHeight: 18 }]}>
                We will tell you before you run out.
              </Text>
            </View>
          </PanelBody>
        </Panel>

        <ActionPrimary label={busy ? 'Saving…' : 'Save medicine'} onPress={() => void save()} disabled={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
