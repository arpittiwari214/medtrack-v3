import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, OfflineError } from '../api/client';
import { useApp } from '../context/AppContext';
import { MIN_TOUCH, radius, spacing, type, useTheme } from '../theme';
import { ActionSecondary, Banner } from '../components/ui';
import { AlertTriangle, Info, Pill } from '../components/icons';
import { useT } from '../i18n/useT';

export default function SignInScreen() {
  const c = useTheme();
  const { signIn, startLocally, isLocal, setWantsSignIn } = useApp();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      if (caught instanceof OfflineError) {
        setError(t('sign_in_offline'));
      } else {
        setError(caught instanceof ApiError ? caught.message : t('sign_in_failed'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pill size={22} color={c.brand} />
            <Text style={[type.lg, { color: c.text }]}>MedTrack</Text>
          </View>
          <Text style={[type.display, { color: c.text, marginTop: spacing.lg }]}>
            {t(isLocal ? 'sign_in_title_local' : 'welcome_back')}
          </Text>
          <Text style={[type.sm, { color: c.text2, marginTop: spacing.sm }]}>
            {t('sign_in_sub')}
          </Text>
        </View>

        {isLocal && (
          <Banner tone="info" icon={<Info size={18} color={c.infoInk} />}>
            {t('local_merge_note')}
          </Banner>
        )}

        {error !== '' && (
          <Banner tone="danger" icon={<AlertTriangle size={18} color={c.dangerInk} />}>
            {error}
          </Banner>
        )}

        <View style={{ gap: spacing.sm }}>
          <Text style={[type.sm, { color: c.text, fontWeight: '600' }]}>{t('email')}</Text>
          <TextInput
            style={{
              minHeight: MIN_TOUCH + 4,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.borderStrong,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              ...type.base,
              color: c.text,
            }}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@email.com"
            placeholderTextColor={c.text3}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[type.sm, { color: c.text, fontWeight: '600' }]}>{t('password')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(showPassword ? 'hide_password' : 'show_password')}
              onPress={() => setShowPassword(!showPassword)}
              style={{ minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.sm }}
            >
              <Text style={[type.sm, { color: c.brand, fontWeight: '600' }]}>
                {t(showPassword ? 'hide' : 'show')}
              </Text>
            </Pressable>
          </View>
          <TextInput
            style={{
              minHeight: MIN_TOUCH + 4,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.borderStrong,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              ...type.base,
              color: c.text,
            }}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="go"
          />
        </View>

        {/* The deeper brand step, not --brand: white on the lighter step is
            3.73:1, under AA, and this is the screen's only action. */}
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => ({
            minHeight: 52,
            borderRadius: radius.sm,
            backgroundColor: c.brandStrong,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing.sm,
            opacity: busy ? 0.6 : pressed ? 0.9 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={c.onBrand} />
          ) : (
            <Text style={{ ...type.base, fontWeight: '700', color: c.onBrand }}>{t('sign_in')}</Text>
          )}
        </Pressable>

        {isLocal ? (
          <ActionSecondary label={t('back')} onPress={() => setWantsSignIn(false)} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <ActionSecondary label={t('use_locally')} onPress={() => void startLocally()} />
            <Text style={[type.xs, { color: c.text2, textAlign: 'center', lineHeight: 18 }]}>
              {t('use_locally_note')}
            </Text>
          </View>
        )}

        {/* Account creation deliberately lives on the web. Signup needs the
            consent flow and the legal documents, and reproducing those in a
            native screen invites the two drifting apart. */}
        <Text style={[type.xs, { color: c.text3, textAlign: 'center', marginTop: spacing.md }]}>
          {t('new_account_note')}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
