/**
 * Today's doses.
 *
 * Same information design as the web: one focal block answering "what do I take
 * next", then a schedule rail — time down a left spine with state dots — which
 * is the shape of a medication chart rather than a stack of cards.
 *
 * Reads entirely from the offline cache, so it renders instantly on a cold
 * start with no signal. Actions apply locally and queue; the network is never
 * on the critical path between tapping "Taken" and seeing it.
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  describeMedicine,
  dosesRemainingInStock,
  formatTimeFor,
  isLowStock,
  projectedRunOutDate,
  splitToday,
  summarise,
  todayIn,
  type Appointment,
  type DoseEvent,
  type Medicine,
} from '@medtrack/shared';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { SNOOZE_OPTIONS } from '../config';
import { MIN_TOUCH, TABULAR, radius, spacing, type, useTheme } from '../theme';
import {
  ActionPrimary,
  ActionSecondary,
  Banner,
  DaySegments,
  EmptyState,
  MetricStrip,
  Micro,
  Panel,
  PanelBody,
  PanelHead,
  RailRow,
  SectionHead,
  sharedStyles,
} from '../components/ui';
import { AlertTriangle, Calendar, Check, Clock, Package, Pill, SkipForward } from '../components/icons';
import { ReminderAlertBanner } from '../components/ReminderHealth';
import { ColorDot, MedicinePhoto } from '../components/recognition';
import { SayButton, useSayMedicine } from '../components/voice';
import { dosesLeft, formatDate, type StringKey } from '../i18n';
import { useT } from '../i18n/useT';

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export default function TodayScreen() {
  const c = useTheme();
  const { user, cache, syncing, refresh, actOnDose, photos, voices, prefs, announceDoseId, setAnnounceDoseId } =
    useApp();
  const { t, locale } = useT();
  const say = useSayMedicine(locale === 'hi' ? 'hi-IN' : 'en-IN');

  const medicinesById = useMemo(
    () => new Map((cache.medicines as Medicine[]).map((medicine) => [medicine.id, medicine])),
    [cache.medicines],
  );
  const [snoozeTarget, setSnoozeTarget] = useState<DoseEvent | null>(null);

  const zone = user?.timezone ?? deviceZone();
  const today = todayIn(zone);

  const { upcoming, taken, missed, skipped } = useMemo(
    () => splitToday(cache.doses, zone, today),
    [cache.doses, zone, today],
  );

  const summary = useMemo(
    () => summarise(cache.doses, { timezone: zone, today }),
    [cache.doses, zone, today],
  );

  const ordered = useMemo(
    () =>
      [...upcoming, ...taken, ...missed, ...skipped].sort((a, b) =>
        a.scheduledAt.localeCompare(b.scheduledAt),
      ),
    [upcoming, taken, missed, skipped],
  );

  /** The earliest dose still needing action. A missed one outranks an upcoming one. */
  const focus = useMemo(() => {
    const byTime = (list: DoseEvent[]) =>
      [...list].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return byTime(missed)[0] ?? byTime(upcoming)[0] ?? null;
  }, [missed, upcoming]);

  /** Play the patient's voice label, or read the description aloud. */
  const sayDose = (dose: DoseEvent) => {
    const medicine = medicinesById.get(dose.medicineId);
    const headline = medicine ? describeMedicine(medicine, locale) : dose.medicineName;
    say(voices[dose.medicineId], `${headline}. ${formatTimeFor(dose.localTime, locale)}.`);
  };

  // Opened from a reminder: read that dose aloud once, if the patient asked for it.
  useEffect(() => {
    if (!announceDoseId) return;
    const dose = cache.doses.find((item) => item.id === announceDoseId);
    if (dose && prefs.speakOnOpen) sayDose(dose);
    setAnnounceDoseId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announceDoseId]);

  const total = ordered.length;
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <>
      <ScrollView
        style={[sharedStyles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={sharedStyles.content}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={c.brand} />
        }
      >
        {/* Header */}
        <View
          style={{
            paddingTop: spacing.xl,
            paddingBottom: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
            marginBottom: spacing.xl,
          }}
        >
          <Text style={[type.micro, TABULAR, { color: c.text3, textTransform: 'uppercase' }]}>
            {formatDate(locale, today, 'long')}
          </Text>
          <Text style={[type.title, { color: c.text, marginTop: 4 }]}>
            {t(greetingKey())}
            {firstName ? `, ${firstName}` : ''}
          </Text>
        </View>

        <View style={sharedStyles.stack}>
          {/* First, because nothing else on this screen matters if the
              reminders behind it will not ring. */}
          <ReminderAlertBanner />

          {cache.syncedAt === null && (
            <Banner tone="info">{t('offline_banner')}</Banner>
          )}

          {total === 0 ? (
            <EmptyState
              icon={(colour) => <Pill size={22} color={colour} />}
              title={t('today_empty_title')}
              description={t('today_empty_body')}
            />
          ) : focus ? (
            <NextDose
              dose={focus}
              medicine={medicinesById.get(focus.medicineId)}
              photo={photos[focus.medicineId]}
              onSay={() => sayDose(focus)}
              onTake={() => void actOnDose(focus.id, 'take')}
              onSnooze={() => setSnoozeTarget(focus)}
              onSkip={() => void actOnDose(focus.id, 'skip')}
            />
          ) : (
            <EmptyState
              icon={(colour) => <Check size={22} color={colour} />}
              title={t('today_done_title')}
              description={t('today_done_body', { taken: taken.length, total })}
            />
          )}

          <CarePanel medicines={[...medicinesById.values()]} appointments={cache.appointments} />

          {total > 0 && (
            <>
              <View style={[sharedStyles.row, { marginTop: spacing.sm }]}>
                <Micro>{t('today_label')}</Micro>
                <DaySegments statuses={ordered.map((d) => d.status)} />
                {/* Taken, not "dealt with": four missed doses once read as 4/5. */}
                <Text
                  accessibilityLabel={t('today_done_body', { taken: taken.length, total })}
                  style={[type.xs, TABULAR, { color: c.text2, fontWeight: '700' }]}
                >
                  {taken.length}/{total}
                </Text>
              </View>

              <MetricStrip
                items={[
                  { value: `${summary.ratePercent}%`, label: t('metric_30_days') },
                  { value: summary.streakDays, label: t('metric_streak') },
                  { value: summary.missed, label: t('metric_missed') },
                ]}
              />

              <SectionHead title={t('schedule')} />

              <View>
                {ordered.map((dose, index) => (
                  <RailRow
                    key={dose.id}
                    time={formatTimeFor(dose.localTime, locale)}
                    name={dose.medicineName}
                    strength={dose.medicineStrength}
                    purpose={medicinesById.get(dose.medicineId)?.purpose}
                    person={medicinesById.get(dose.medicineId)?.person}
                    leading={<ColorDot color={medicinesById.get(dose.medicineId)?.pillColor} />}
                    status={dose.status}
                    critical={dose.isCritical}
                    first={index === 0}
                    last={index === ordered.length - 1}
                    onPress={() =>
                      void actOnDose(
                        dose.id,
                        dose.status === 'taken' || dose.status === 'skipped' ? 'undo' : 'take',
                      )
                    }
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={snoozeTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSnoozeTarget(null)}
      >
        <SafeAreaProvider>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(12,18,21,0.55)', justifyContent: 'flex-end' }}
            onPress={() => setSnoozeTarget(null)}
          >
            <Pressable
              style={{
                backgroundColor: c.surface,
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                padding: spacing.xl,
                gap: spacing.md,
              }}
              onPress={(event) => event.stopPropagation()}
            >
              <Text style={[type.lg, { color: c.text }]}>{t('snooze_title')}</Text>
              <Text style={[type.sm, { color: c.text2, marginBottom: spacing.sm }]}>
                {t('snooze_body')}
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {SNOOZE_OPTIONS.map((minutes) => (
                  <Pressable
                    key={minutes}
                    onPress={() => {
                      if (snoozeTarget) void actOnDose(snoozeTarget.id, 'snooze', minutes);
                      setSnoozeTarget(null);
                    }}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      flexBasis: '45%',
                      minHeight: 52,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: c.borderStrong,
                      backgroundColor: pressed ? c.surface2 : c.surface,
                    })}
                  >
                    <Text style={[type.base, TABULAR, { color: c.text, fontWeight: '700' }]}>
                      {t('minutes', { n: minutes })}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => setSnoozeTarget(null)}
                style={{ minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={[type.sm, { color: c.text2 }]}>{t('cancel')}</Text>
              </Pressable>
              {/* Room for the phone's own nav buttons below the sheet. */}
              <SafeAreaView edges={['bottom']} />
            </Pressable>
          </Pressable>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

/* ── The focal block ─────────────────────────────────────────────────────── */

function NextDose({
  dose,
  medicine,
  photo,
  onSay,
  onTake,
  onSnooze,
  onSkip,
}: {
  dose: DoseEvent;
  medicine: Medicine | undefined;
  photo: string | undefined;
  onSay: () => void;
  onTake: () => void;
  onSnooze: () => void;
  onSkip: () => void;
}) {
  const c = useTheme();
  const { t, locale } = useT();
  const overdue = dose.status === 'missed';
  // A scheduled dose already past its time is not "next" — it is due now.
  const pastDue = !overdue && new Date(dose.scheduledAt).getTime() < Date.now();
  const headline = medicine ? describeMedicine(medicine, locale) : dose.medicineName;
  const showName = headline !== dose.medicineName;

  // Asked first: one stray tap used to record a deliberate skip, and nothing
  // on screen said so.
  const confirmSkip = () =>
    Alert.alert(t('skip_confirm'), t('skip_confirm_body', { name: headline, time: formatTimeFor(dose.localTime, locale) }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('skip'), style: 'destructive', onPress: onSkip },
    ]);

  return (
    <Panel critical={dose.isCritical}>
      <PanelHead
        label={t(overdue ? 'overdue' : pastDue ? 'due_now' : 'next_dose')}
        aside={
          <Text style={[type.xs, TABULAR, { color: c.text2, fontWeight: '600' }]}>
            {relativeTo(dose.scheduledAt, t)}
          </Text>
        }
      />

      <PanelBody style={{ paddingVertical: spacing.xl }}>
        {/* What the patient sees on the strip leads; the name supports it. */}
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
          <MedicinePhoto uri={photo} color={medicine?.pillColor} size={88} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: c.text }}>
              {headline}
            </Text>
            <Text style={[type.sm, TABULAR, { color: c.text2, marginTop: 4 }]}>
              {[showName ? dose.medicineName : null, dose.medicineStrength || null, formatTimeFor(dose.localTime, locale)]
                .filter(Boolean)
                .join(' · ')}
              {dose.isCritical ? ` · ${t('important')}` : ''}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <SayButton onPress={onSay} label={t('hear_it')} />
        </View>

        {overdue && (
          <View style={{ marginTop: spacing.lg }}>
            <Banner tone="warn" icon={<AlertTriangle size={16} color={c.warnInk} />}>
              {t('overdue_note')}
            </Banner>
          </View>
        )}
      </PanelBody>

      {/* One unmistakable primary, two quiet secondaries. Previously all three
          were the same size, so "Skip" competed with "Taken". */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
        <ActionPrimary
          label={t('mark_taken')}
          icon={(colour) => <Check size={20} color={colour} />}
          onPress={onTake}
        />
        <View style={sharedStyles.split}>
          <ActionSecondary
            label={t('snooze')}
            icon={(colour) => <Clock size={16} color={colour} />}
            onPress={onSnooze}
            style={{ flex: 1 }}
          />
          <ActionSecondary
            label={t('skip')}
            icon={(colour) => <SkipForward size={16} color={colour} />}
            onPress={confirmSkip}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Panel>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/* ── Supply and visits ───────────────────────────────────────────────────── */

/**
 * In India the bigger failure is falling out of care — running out and not
 * refilling, or never going back to the doctor — rather than one missed dose.
 * 43% of patients in one national programme never returned for a first
 * follow-up. So both sit on Today, computed from offline data.
 */
function CarePanel({ medicines, appointments }: { medicines: Medicine[]; appointments: Appointment[] }) {
  const c = useTheme();
  const { t, locale } = useT();
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();

  const running = medicines
    .filter((medicine) => !medicine.archivedAt && isLowStock(medicine))
    .map((medicine) => ({
      medicine,
      runOut: projectedRunOutDate(medicine),
      left: dosesRemainingInStock(medicine) ?? 0,
    }))
    // Run-out is a date, so ties go to whichever has fewer doses left.
    .sort((a, b) => (a.runOut ?? '9999').localeCompare(b.runOut ?? '9999') || a.left - b.left)
    .slice(0, 3);

  const now = Date.now();
  const nextVisit = [...appointments]
    .filter((a) => a.status === 'scheduled' && new Date(a.scheduledAt).getTime() >= now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

  if (running.length === 0 && medicines.length === 0) return null;

  return (
    <Panel>
      <PanelHead label={t('care_title')} />
      <View>
        {running.map(({ medicine, runOut, left }) => {
          return (
            <Pressable
              key={medicine.id}
              accessibilityRole="button"
              onPress={() => navigation.navigate('Medicines')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 60,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
                backgroundColor: pressed ? c.surface2 : 'transparent',
              })}
            >
              <Package size={18} color={c.warnInk} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <ColorDot color={medicine.pillColor} />
                  <Text style={[type.base, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
                    {medicine.name}
                  </Text>
                </View>
                <Text style={[type.xs, { color: c.text2, marginTop: 2 }]}>
                  {dosesLeft(locale, left)}
                  {runOut ? ` · ${t('runs_out_around', { date: formatDate(locale, runOut, 'short') })}` : ''}
                </Text>
              </View>
              <Text style={[type.micro, { color: c.warnInk, textTransform: 'uppercase' }]}>
                {t('buy_more')}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Visits')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            minHeight: 60,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? c.surface2 : 'transparent',
          })}
        >
          <Calendar size={18} color={c.text2} />
          <View style={{ flex: 1 }}>
            <Text style={[type.base, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
              {nextVisit ? nextVisit.title : t('no_visit')}
            </Text>
            <Text style={[type.xs, TABULAR, { color: c.text2, marginTop: 2 }]}>
              {nextVisit
                ? `${formatDate(locale, nextVisit.localDate, 'short')} · ${formatTimeFor(nextVisit.localTime, locale)}${nextVisit.requiresFasting ? ` · ${t('fasting')}` : ''}`
                : t('no_visit_body')}
            </Text>
          </View>
        </Pressable>
      </View>
    </Panel>
  );
}

function greetingKey(): StringKey {
  const hour = new Date().getHours();
  if (hour < 12) return 'greet_morning';
  if (hour < 17) return 'greet_afternoon';
  return 'greet_evening';
}

/** A duration is easier to act on than a clock time. */
function relativeTo(instant: string, t: ReturnType<typeof useT>['t']): string {
  const deltaMinutes = Math.round((new Date(instant).getTime() - Date.now()) / 60_000);
  const abs = Math.abs(deltaMinutes);
  if (abs < 1) return t('rel_now');

  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span =
    h > 0 ? t(m ? 'span_hours_minutes' : 'span_hours', { h, m }) : t('span_minutes', { m });
  return t(deltaMinutes > 0 ? 'rel_in' : 'rel_ago', { span });
}
