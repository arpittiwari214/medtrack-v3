/**
 * Appointments and lab tests.
 *
 * Reads from the offline cache like every other screen, so it works with no
 * signal. Marking one done applies locally and queues.
 *
 * Creating an appointment stays on the web, consistent with medicines and
 * signup: it needs a date and time picker, which would mean another native
 * dependency for one form, and the reminder offsets are easier to get right on
 * a bigger screen. Reminders themselves fire on the phone regardless.
 */

import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatTimeFor, type Appointment, type AppointmentKind, type Locale } from '@medtrack/shared';
import { useApp } from '../context/AppContext';
import { WEB_URL } from '../config';
import { TABULAR, radius, spacing, type, useTheme } from '../theme';
import {
  ActionSecondary,
  Badge,
  Banner,
  EmptyState,
  Panel,
  PanelBody,
  PanelHead,
  ScreenHeader,
  sharedStyles,
} from '../components/ui';
import { AlertTriangle, Calendar, Check } from '../components/icons';
import { formatDate, type StringKey } from '../i18n';
import { useT } from '../i18n/useT';

const KIND_LABEL: Record<AppointmentKind, StringKey> = {
  doctor: 'kind_doctor',
  lab_test: 'kind_lab_test',
  procedure: 'kind_procedure',
  vaccination: 'kind_vaccination',
  other: 'kind_other',
};

const STATUS_LABEL: Record<string, StringKey> = {
  completed: 'status_completed',
  cancelled: 'status_cancelled',
  missed: 'status_missed',
};

type Scope = 'upcoming' | 'past';

export default function AppointmentsScreen() {
  const c = useTheme();
  const { cache, syncing, refresh, updateAppointment } = useApp();
  const { t, locale } = useT();
  const [scope, setScope] = useState<Scope>('upcoming');

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const all = [...cache.appointments];

    return {
      upcoming: all
        .filter((a) => a.status === 'scheduled' && new Date(a.scheduledAt).getTime() >= now)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
      past: all
        .filter((a) => a.status !== 'scheduled' || new Date(a.scheduledAt).getTime() < now)
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    };
  }, [cache.appointments]);

  const shown = scope === 'upcoming' ? upcoming : past;

  function confirmDone(appointment: Appointment) {
    Alert.alert(t('mark_done_confirm'), appointment.title, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('mark_done'),
        onPress: () =>
          void updateAppointment(appointment.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
          }),
      },
    ]);
  }

  return (
    <ScrollView
      style={[sharedStyles.screen, { backgroundColor: c.bg }]}
      contentContainerStyle={sharedStyles.content}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={c.brand} />}
    >
      <ScreenHeader
        eyebrow={t('visits_eyebrow')}
        title={t('appointments_title')}
        action={
          <View
            style={{
              flexDirection: 'row',
              padding: 3,
              gap: 3,
              backgroundColor: c.surface2,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.sm,
            }}
          >
            {(['upcoming', 'past'] as Scope[]).map((option) => {
              const active = scope === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setScope(option)}
                  style={{
                    minHeight: 38,
                    paddingHorizontal: spacing.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.xs,
                    backgroundColor: active ? c.surface : 'transparent',
                  }}
                >
                  <Text style={[type.xs, { color: active ? c.text : c.text2, fontWeight: '600' }]}>
                    {t(option === 'upcoming' ? 'upcoming' : 'past')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={(colour) => <Calendar size={22} color={colour} />}
          title={t(scope === 'upcoming' ? 'visits_empty_up' : 'visits_empty_past')}
          description={t('visits_empty_body')}
          // Adding happens on the website; without this the screen was a dead end.
          action={
            <ActionSecondary
              label={t('open_website')}
              onPress={() => void Linking.openURL(`${WEB_URL}/app/appointments`)}
            />
          }
        />
      ) : (
        <View style={sharedStyles.stack}>
          {shown.map((appointment) => (
            <Panel key={appointment.id}>
              <PanelHead
                label={t(KIND_LABEL[appointment.kind] ?? 'kind_other')}
                aside={
                  <Text style={[type.xs, TABULAR, { color: c.text2, fontWeight: '600' }]}>
                    {relativeDay(appointment.scheduledAt, appointment.localDate, locale, t)} ·{' '}
                    {formatTimeFor(appointment.localTime, locale)}
                  </Text>
                }
              />

              <PanelBody>
                <View style={sharedStyles.rowBetween}>
                  <Text style={[type.lg, { color: c.text, flex: 1 }]} numberOfLines={2}>
                    {appointment.title}
                  </Text>
                  {appointment.status !== 'scheduled' && (
                    <Badge
                      label={STATUS_LABEL[appointment.status] ? t(STATUS_LABEL[appointment.status]!) : appointment.status}
                      tone={appointment.status === 'completed' ? 'ok' : 'neutral'}
                    />
                  )}
                </View>

                {appointment.provider ? (
                  <Text style={[type.xs, { color: c.text3, marginTop: 4 }]}>
                    {t('with_provider', { provider: appointment.provider })}
                  </Text>
                ) : null}
                {appointment.location ? (
                  <Text style={[type.xs, { color: c.text3, marginTop: 2 }]}>
                    {appointment.location}
                  </Text>
                ) : null}

                {appointment.requiresFasting && appointment.status === 'scheduled' && (
                  <View style={{ marginTop: spacing.md }}>
                    <Banner tone="warn" icon={<AlertTriangle size={16} color={c.warnInk} />}>
                      {t('fasting_required')}
                    </Banner>
                  </View>
                )}

                {appointment.notes ? (
                  <Text
                    style={[type.xs, { color: c.text2, marginTop: spacing.md, lineHeight: 19 }]}
                  >
                    {appointment.notes}
                  </Text>
                ) : null}

                {appointment.status === 'scheduled' && (
                  <View style={{ marginTop: spacing.lg }}>
                    <ActionSecondary
                      label={t('mark_done')}
                      icon={(colour) => <Check size={16} color={colour} />}
                      onPress={() => confirmDone(appointment)}
                    />
                  </View>
                )}
              </PanelBody>
            </Panel>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/**
 * "Tomorrow" beats a date you have to decode. Falls back to the stored local
 * date beyond a few days, which is the point at which a weekday stops helping.
 */
function relativeDay(
  scheduledAt: string,
  localDate: string,
  locale: Locale,
  t: ReturnType<typeof useT>['t'],
): string {
  const days = Math.round((new Date(scheduledAt).getTime() - Date.now()) / 86_400_000);

  if (days === 0) return t('day_today');
  if (days === 1) return t('day_tomorrow');
  if (days === -1) return t('day_yesterday');
  if (days > 1 && days <= 6) {
    return new Date(`${localDate}T00:00:00Z`).toLocaleDateString(
      locale === 'hi' ? 'hi-IN-u-nu-latn' : 'en-GB',
      { weekday: 'long', timeZone: 'UTC' },
    );
  }
  return formatDate(locale, localDate, 'short');
}
