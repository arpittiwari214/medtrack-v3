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

import { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  formatTime12h,
  splitToday,
  summarise,
  todayIn,
  type DoseEvent,
} from '@medtrack/shared';
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
import { AlertTriangle, Check, Clock, Pill, SkipForward } from '../components/icons';

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export default function TodayScreen() {
  const c = useTheme();
  const { user, cache, syncing, refresh, actOnDose } = useApp();
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

  const total = ordered.length;
  const done = taken.length + missed.length + skipped.length;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

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
            {longDate(today)}
          </Text>
          <Text style={[type.title, { color: c.text, marginTop: 4 }]}>
            {greeting()}, {firstName}
          </Text>
        </View>

        <View style={sharedStyles.stack}>
          {cache.syncedAt === null && (
            <Banner tone="info">
              Working offline. Your changes are saved and sync when you reconnect.
            </Banner>
          )}

          {total === 0 ? (
            <EmptyState
              icon={(colour) => <Pill size={22} color={colour} />}
              title="Nothing scheduled today"
              description="Add a medicine on the web app and your daily schedule builds itself."
            />
          ) : focus ? (
            <NextDose
              dose={focus}
              onTake={() => void actOnDose(focus.id, 'take')}
              onSnooze={() => setSnoozeTarget(focus)}
              onSkip={() => void actOnDose(focus.id, 'skip')}
            />
          ) : (
            <EmptyState
              icon={(colour) => <Check size={22} color={colour} />}
              title="All done for today"
              description={`${taken.length} of ${total} doses taken.`}
            />
          )}

          {total > 0 && (
            <>
              <View style={[sharedStyles.row, { marginTop: spacing.sm }]}>
                <Micro>Today</Micro>
                <DaySegments statuses={ordered.map((d) => d.status)} />
                <Text style={[type.xs, TABULAR, { color: c.text2, fontWeight: '700' }]}>
                  {done}/{total}
                </Text>
              </View>

              <MetricStrip
                items={[
                  { value: `${summary.ratePercent}%`, label: '30 days' },
                  { value: summary.streakDays, label: 'Streak' },
                  { value: summary.missed, label: 'Missed' },
                ]}
              />

              <SectionHead title="Schedule" />

              <View>
                {ordered.map((dose, index) => (
                  <RailRow
                    key={dose.id}
                    time={formatTime12h(dose.localTime)}
                    name={dose.medicineName}
                    strength={dose.medicineStrength}
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
            <Text style={[type.lg, { color: c.text }]}>Remind me again in…</Text>
            <Text style={[type.sm, { color: c.text2, marginBottom: spacing.sm }]}>
              The dose stays on today’s schedule either way.
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
                    {minutes} min
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setSnoozeTarget(null)}
              style={{ minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={[type.sm, { color: c.text2 }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* ── The focal block ─────────────────────────────────────────────────────── */

function NextDose({
  dose,
  onTake,
  onSnooze,
  onSkip,
}: {
  dose: DoseEvent;
  onTake: () => void;
  onSnooze: () => void;
  onSkip: () => void;
}) {
  const c = useTheme();
  const overdue = dose.status === 'missed';

  return (
    <Panel critical={dose.isCritical}>
      <PanelHead
        label={overdue ? 'Overdue' : 'Next dose'}
        aside={
          <Text style={[type.xs, TABULAR, { color: c.text2, fontWeight: '600' }]}>
            {relativeTo(dose.scheduledAt)}
          </Text>
        }
      />

      <PanelBody style={{ paddingVertical: spacing.xl }}>
        <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.8, color: c.text }}>
          {dose.medicineName}
        </Text>
        <Text style={[type.sm, TABULAR, { color: c.text2, marginTop: 4 }]}>
          {dose.medicineStrength} · {formatTime12h(dose.localTime)}
          {dose.isCritical ? ' · Critical' : ''}
        </Text>

        {overdue && (
          <View style={{ marginTop: spacing.lg }}>
            <Banner tone="warn" icon={<AlertTriangle size={16} color={c.warnInk} />}>
              This was due earlier. You can still record it if you took it.
            </Banner>
          </View>
        )}
      </PanelBody>

      {/* One unmistakable primary, two quiet secondaries. Previously all three
          were the same size, so "Skip" competed with "Taken". */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
        <ActionPrimary
          label="Mark as taken"
          icon={(colour) => <Check size={20} color={colour} />}
          onPress={onTake}
        />
        <View style={sharedStyles.split}>
          <ActionSecondary
            label="Snooze"
            icon={(colour) => <Clock size={16} color={colour} />}
            onPress={onSnooze}
            style={{ flex: 1 }}
          />
          <ActionSecondary
            label="Skip"
            icon={(colour) => <SkipForward size={16} color={colour} />}
            onPress={onSkip}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Panel>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function longDate(localDate: string): string {
  return new Date(`${localDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** A duration is easier to act on than a clock time. */
function relativeTo(instant: string): string {
  const deltaMinutes = Math.round((new Date(instant).getTime() - Date.now()) / 60_000);
  const abs = Math.abs(deltaMinutes);
  if (abs < 1) return 'now';

  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const span = hours > 0 ? `${hours} h${minutes ? ` ${minutes} m` : ''}` : `${minutes} min`;
  return deltaMinutes > 0 ? `in ${span}` : `${span} ago`;
}
