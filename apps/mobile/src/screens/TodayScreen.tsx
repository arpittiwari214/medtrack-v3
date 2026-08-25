/**
 * Today's doses.
 *
 * Reads entirely from the offline cache, so it renders instantly on a cold
 * start with no signal. Actions are applied locally and queued; the network is
 * never on the critical path between tapping "Taken" and seeing it.
 */

import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  formatTime12h,
  splitToday,
  summarise,
  todayIn,
  type DoseEvent,
  type DoseStatus,
} from '@medtrack/shared';
import { useApp } from '../context/AppContext.js';
import { SNOOZE_OPTIONS } from '../config.js';
import { colors, radius, spacing, type, MIN_TOUCH } from '../theme.js';

/** Status is carried by a word as well as a colour — never colour alone. */
const STATUS_META: Record<DoseStatus, { label: string; colour: string; background: string }> = {
  taken: { label: 'Taken', colour: colors.ok, background: colors.okBg },
  missed: { label: 'Missed', colour: colors.danger, background: colors.dangerBg },
  snoozed: { label: 'Snoozed', colour: colors.warn, background: colors.warnBg },
  skipped: { label: 'Skipped', colour: colors.textMuted, background: colors.surface2 },
  scheduled: { label: 'Due', colour: colors.info, background: colors.infoBg },
};

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export default function TodayScreen() {
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

  const total = upcoming.length + taken.length + missed.length + skipped.length;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={colors.navy} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{greeting().toUpperCase()}</Text>
          <Text style={styles.title}>{firstName}</Text>
        </View>

        {cache.syncedAt === null && (
          <View style={[styles.banner, { backgroundColor: colors.infoBg }]}>
            <Text style={[styles.bannerText, { color: colors.info }]}>
              Working offline. Your changes are saved and will sync when you reconnect.
            </Text>
          </View>
        )}

        <View style={styles.statRow}>
          <Stat value={`${taken.length}/${total}`} label="Today" />
          <Stat value={`${summary.ratePercent}%`} label="30 days" />
          <Stat value={String(summary.streakDays)} label="Streak" />
        </View>

        {missed.length > 0 && (
          <View style={[styles.banner, { backgroundColor: colors.warnBg }]}>
            <Text style={[styles.bannerText, { color: colors.warn }]}>
              {missed.length} missed {missed.length === 1 ? 'dose' : 'doses'}. You can still record
              them if you took them.
            </Text>
          </View>
        )}

        {total === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💊</Text>
            <Text style={styles.emptyTitle}>Nothing scheduled today</Text>
            <Text style={styles.emptyBody}>
              Add a medicine on the web app and it will appear here.
            </Text>
          </View>
        )}

        <DoseSection title="Still to take" doses={upcoming}>
          {(dose) => (
            <View style={styles.actions}>
              <ActionButton
                label="Taken"
                tone="success"
                onPress={() => void actOnDose(dose.id, 'take')}
              />
              <ActionButton label="Snooze" tone="neutral" onPress={() => setSnoozeTarget(dose)} />
              <ActionButton
                label="Skip"
                tone="ghost"
                onPress={() => void actOnDose(dose.id, 'skip')}
              />
            </View>
          )}
        </DoseSection>

        <DoseSection title="Missed" doses={missed}>
          {(dose) => (
            <View style={styles.actions}>
              <ActionButton
                label="I took this"
                tone="neutral"
                onPress={() => void actOnDose(dose.id, 'take')}
              />
            </View>
          )}
        </DoseSection>

        <DoseSection title="Done" doses={[...taken, ...skipped]}>
          {(dose) => (
            <View style={styles.actions}>
              <ActionButton
                label="Undo"
                tone="ghost"
                onPress={() => void actOnDose(dose.id, 'undo')}
              />
            </View>
          )}
        </DoseSection>
      </ScrollView>

      <Modal
        visible={snoozeTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSnoozeTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSnoozeTarget(null)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.sheetTitle}>Remind me again in…</Text>
            {SNOOZE_OPTIONS.map((minutes) => (
              <Pressable
                key={minutes}
                style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}
                onPress={() => {
                  if (snoozeTarget) void actOnDose(snoozeTarget.id, 'snooze', minutes);
                  setSnoozeTarget(null);
                }}
              >
                <Text style={styles.sheetOptionText}>{minutes} minutes</Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}
              onPress={() => setSnoozeTarget(null)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function DoseSection({
  title,
  doses,
  children,
}: {
  title: string;
  doses: DoseEvent[];
  children: (dose: DoseEvent) => React.ReactNode;
}) {
  if (doses.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{title.toUpperCase()}</Text>
      {doses.map((dose) => {
        const meta = STATUS_META[dose.status];
        return (
          <View key={dose.id} style={[styles.dose, { borderLeftColor: meta.colour }]}>
            <View style={styles.doseHeader}>
              <Text style={styles.doseTime}>{formatTime12h(dose.localTime)}</Text>
              <View style={[styles.badge, { backgroundColor: meta.background }]}>
                <Text style={[styles.badgeText, { color: meta.colour }]}>{meta.label}</Text>
              </View>
            </View>
            <Text style={styles.doseName}>{dose.medicineName}</Text>
            <Text style={styles.doseStrength}>
              {dose.medicineStrength}
              {dose.isCritical ? ' · Critical' : ''}
            </Text>
            {children(dose)}
          </View>
        );
      })}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'success' | 'neutral' | 'ghost';
  onPress: () => void;
}) {
  const toneStyle =
    tone === 'success'
      ? { backgroundColor: colors.ok }
      : tone === 'neutral'
        ? { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }
        : { backgroundColor: 'transparent' };

  const textColour = tone === 'success' ? '#FFFFFF' : colors.text;

  return (
    <Pressable
      style={({ pressed }) => [styles.actionButton, toneStyle, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.actionText, { color: textColour }]}>{label}</Text>
    </Pressable>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: 2 },
  eyebrow: { ...type.eyebrow, color: colors.textSubtle },
  title: { ...type.display, color: colors.text },

  statRow: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statValue: { ...type.title, color: colors.text },
  statLabel: { ...type.caption, color: colors.textMuted, marginTop: 2 },

  banner: { borderRadius: radius.md, padding: spacing.lg },
  bannerText: { ...type.body },

  section: { gap: spacing.sm },
  dose: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  doseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doseTime: { ...type.bodyStrong, color: colors.text, fontVariant: ['tabular-nums'] },
  doseName: { ...type.heading, color: colors.text },
  doseStrength: { ...type.caption, color: colors.textMuted },

  badge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
  badgeText: { ...type.caption, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { ...type.label, fontWeight: '600' },
  pressed: { opacity: 0.7 },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyBody: { ...type.body, color: colors.textMuted, textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(9,16,30,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: { ...type.heading, color: colors.text, marginBottom: spacing.sm },
  sheetOption: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: { ...type.bodyStrong, color: colors.text },
  sheetCancel: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  sheetCancelText: { ...type.body, color: colors.textMuted },
});
