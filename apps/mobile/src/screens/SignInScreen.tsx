import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, OfflineError } from '../api/client.js';
import { useApp } from '../context/AppContext.js';
import { colors, radius, spacing, type, MIN_TOUCH } from '../theme.js';

export default function SignInScreen() {
  const { signIn } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      if (caught instanceof OfflineError) {
        setError('No connection. You need to be online to sign in the first time.');
      } else {
        setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.logo}>💊</Text>
          <Text style={styles.title}>MedTrack</Text>
          <Text style={styles.subtitle}>Medication reminders that actually arrive</Text>
        </View>

        {error !== '' && (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@email.com"
            placeholderTextColor={colors.textSubtle}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="go"
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={colors.onDark} />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        {/* Account creation deliberately lives on the web. Signup needs the
            consent flow and the legal documents, and reproducing those inside a
            native screen invites the two drifting apart. */}
        <Text style={styles.footnote}>
          New to MedTrack? Create your account at medtrack.app, then sign in here.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  brand: { alignItems: 'center', marginBottom: spacing.lg },
  logo: { fontSize: 48, marginBottom: spacing.sm },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  field: { gap: spacing.sm },
  label: { ...type.label, color: colors.text },
  input: {
    minHeight: MIN_TOUCH + 4,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    ...type.body,
    color: colors.text,
  },
  button: {
    minHeight: 52,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...type.bodyStrong, color: colors.onDark },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  errorText: { ...type.body, color: colors.danger },
  footnote: {
    ...type.caption,
    color: colors.textSubtle,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
