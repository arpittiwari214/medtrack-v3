import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { dosesRemainingInStock, formatTime12h, isLowStock, type Medicine } from '@medtrack/shared';
import { useApp } from '../context/AppContext.js';
import { colors, radius, spacing, type } from '../theme.js';

const SCHEDULE_LABEL: Record<string, string> = {
  daily: 'Every day',
  interval_days: 'Every few days',
  days_of_week: 'Certain days',
  cyclic: 'On and off',
  as_needed: 'When needed',
};

export default function MedicinesScreen() {
  const { cache, syncing, refresh } = useApp();

  const active = useMemo(
    () => (cache.medicines as Medicine[]).filter((medicine) => !medicine.archivedAt),
    [cache.medicines],
  );

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={colors.navy} />
      }
    >
      <Text style={styles.title}>Medicines</Text>

      {active.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💊</Text>
          <Text style={styles.emptyTitle}>No medicines yet</Text>
          <Text style={styles.emptyBody}>
            Add your medicines on the web app and they will sync here.
          </Text>
        </View>
      ) : (
        active.map((medicine) => {
          const remaining = dosesRemainingInStock(medicine);
          const low = isLowStock(medicine);

          return (
            <View key={medicine.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{medicine.name}</Text>
                {medicine.isCritical && (
                  <View style={[styles.badge, { backgroundColor: colors.dangerBg }]}>
                    <Text style={[styles.badgeText, { color: colors.danger }]}>Critical</Text>
                  </View>
                )}
              </View>

              <Text style={styles.meta}>
                {medicine.strength} · {SCHEDULE_LABEL[medicine.schedule.kind] ?? medicine.schedule.kind}
              </Text>

              {medicine.schedule.times.length > 0 && (
                <View style={styles.timeRow}>
                  {medicine.schedule.times.map((time) => (
                    <View key={time} style={styles.timeChip}>
                      <Text style={styles.timeChipText}>{formatTime12h(time)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {medicine.instructions ? (
                <Text style={styles.instructions}>{medicine.instructions}</Text>
              ) : null}

              {remaining !== null && (
                <View
                  style={[
                    styles.stock,
                    { backgroundColor: low ? colors.warnBg : colors.surface2 },
                  ]}
                >
                  <Text style={[styles.stockText, { color: low ? colors.warn : colors.textMuted }]}>
                    {remaining} {remaining === 1 ? 'dose' : 'doses'} left
                    {low ? ' — time to reorder' : ''}
                  </Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...type.display, color: colors.text, marginBottom: spacing.sm },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...type.heading, color: colors.text, flexShrink: 1 },
  meta: { ...type.caption, color: colors.textMuted },
  instructions: { ...type.caption, color: colors.textMuted, fontStyle: 'italic' },

  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeChip: {
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  timeChipText: { ...type.caption, color: colors.text, fontVariant: ['tabular-nums'] },

  badge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 2 },
  badgeText: { ...type.caption, fontWeight: '600' },

  stock: { borderRadius: radius.sm, padding: spacing.md },
  stockText: { ...type.caption, fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyBody: { ...type.body, color: colors.textMuted, textAlign: 'center' },
});
