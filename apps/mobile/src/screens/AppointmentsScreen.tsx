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
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatTime12h, type Appointment, type AppointmentKind } from '@medtrack/shared';
import { useApp } from '../context/AppContext';
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

const KIND_LABEL: Record<AppointmentKind, string> = {
  doctor: 'Doctor visit',
  lab_test: 'Lab test',
  procedure: 'Procedure',
  vaccination: 'Vaccination',
  other: 'Appointment',
};

type Scope = 'upcoming' | 'past';

export default function AppointmentsScreen() {
  const c = useTheme();
  const { cache, syncing, refresh, updateAppointment } = useApp();
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
    Alert.alert('Mark as done?', appointment.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark done',
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
        eyebrow="Visits and lab tests"
        title="Appointments"
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
                    {option === 'upcoming' ? 'Upcoming' : 'Past'}
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
          title={scope === 'upcoming' ? 'Nothing coming up' : 'Nothing in the past'}
          description="Add a doctor visit or lab test on the web app. Reminders arrive here the day before and an hour ahead."
        />
      ) : (
        <View style={sharedStyles.stack}>
          {shown.map((appointment) => (
            <Panel key={appointment.id}>
              <PanelHead
                label={KIND_LABEL[appointment.kind] ?? 'Appointment'}
                aside={
                  <Text style={[type.xs, TABULAR, { color: c.text2, fontWeight: '600' }]}>
                    {relativeDay(appointment.scheduledAt, appointment.localDate)} ·{' '}
                    {formatTime12h(appointment.localTime)}
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
                      label={appointment.status}
                      tone={appointment.status === 'completed' ? 'ok' : 'neutral'}
                    />
                  )}
                </View>

                {appointment.provider ? (
                  <Text style={[type.xs, { color: c.text3, marginTop: 4 }]}>
                    With {appointment.provider}
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
                      Fasting required — do not eat beforehand.
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
                      label="Mark as done"
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
function relativeDay(scheduledAt: string, localDate: string): string {
  const days = Math.round(
    (new Date(scheduledAt).getTime() - Date.now()) / 86_400_000,
  );

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days <= 6) {
    return new Date(`${localDate}T00:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'long',
      timeZone: 'UTC',
    });
  }
  return new Date(`${localDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
