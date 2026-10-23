/**
 * Voice: recording a label for a medicine, and saying it back.
 *
 * Research found Indian speech recognition still fails on drug names, but text
 * to speech is solid and a recorded voice needs no literacy at all. So the app
 * never listens for commands — it only plays the patient's own recording, or
 * reads the description aloud with the phone's built-in voice when there is no
 * recording. (In mDiabetes, voice messages were recalled by over 90% of
 * patients against 15.6% responding to SMS.)
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { MIN_TOUCH, radius, spacing, type, useTheme } from '../theme';
import { ActionSecondary } from './ui';
import { Volume } from './icons';

/** Play a recording if there is one, otherwise read the text aloud. */
export function useSayMedicine(language = 'en-IN') {
  const player = useRef<AudioPlayer | null>(null);

  useEffect(
    () => () => {
      player.current?.remove();
      void Speech.stop();
    },
    [],
  );

  return (voiceUri: string | undefined, text: string) => {
    player.current?.remove();
    player.current = null;
    void Speech.stop();

    if (voiceUri) {
      player.current = createAudioPlayer(voiceUri);
      player.current.play();
      return;
    }
    // Slightly slow: the people most likely to rely on this hear less well.
    Speech.speak(text, { language, rate: 0.9 });
  };
}

/** A large speaker button. */
export function SayButton({ onPress, label = 'Hear it' }: { onPress: () => void; label?: string }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        minHeight: MIN_TOUCH,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: c.borderStrong,
        backgroundColor: pressed ? c.surface2 : c.surface,
      })}
    >
      <Volume size={20} color={c.text2} />
      <Text style={[type.sm, { color: c.text2, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Record a short voice label. One tap to start, one to stop; the result can be
 * played back and recorded again before saving.
 */
export function VoiceRecorder({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (uri: string | null) => void;
}) {
  const c = useTheme();
  // Voice needs nothing better than low quality, and these files live on the
  // phone indefinitely.
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [recording, setRecording] = useState(false);
  const say = useSayMedicine();

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone not allowed', 'You can skip the voice note — the colours and photo still work.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }

  async function stop() {
    await recorder.stop();
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    onChange(recorder.uri);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Record a voice note'}
        onPress={() => void (recording ? stop() : start())}
        style={({ pressed }) => ({
          minHeight: 56,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.sm,
          backgroundColor: recording ? c.dangerSolid : c.brandStrong,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={[
            type.base,
            { color: recording ? c.dangerSolidInk : c.onBrand, fontWeight: '700' },
          ]}
        >
          {recording ? '■  Stop' : value ? '●  Record again' : '●  Record a voice note'}
        </Text>
      </Pressable>

      {value && !recording && (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <SayButton label="Play it back" onPress={() => say(value, '')} />
          </View>
          <View style={{ flex: 1 }}>
            <ActionSecondary label="Remove" onPress={() => onChange(null)} />
          </View>
        </View>
      )}
    </View>
  );
}
