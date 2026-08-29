import { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  dosesRemainingInStock,
  formatTime12h,
  isLowStock,
  type Medicine,
} from '@medtrack/shared';
import { useApp } from '../context/AppContext';
import { TABULAR, radius, spacing, type, useTheme } from '../theme';
import {
  Badge,
  Banner,
  EmptyState,
  Panel,
  PanelBody,
  PanelHead,
  ScreenHeader,
  sharedStyles,
} from '../components/ui';
import { Package, Pill } from '../components/icons';

const SCHEDULE_LABEL: Record<string, string> = {
  daily: 'Every day',
  interval_days: 'Every few days',
  days_of_week: 'Certain days',
  cyclic: 'On and off',
  as_needed: 'When needed',
};

export default function MedicinesScreen() {
  const c = useTheme();
  const { cache, syncing, refresh } = useApp();

  const active = useMemo(
    () => (cache.medicines as Medicine[]).filter((medicine) => !medicine.archivedAt),
    [cache.medicines],
  );

  return (
    <ScrollView
      style={[sharedStyles.screen, { backgroundColor: c.bg }]}
      contentContainerStyle={sharedStyles.content}
      refreshControl={
        <RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={c.brand} />
      }
    >
      <ScreenHeader
        eyebrow={active.length > 0 ? `${active.length} active` : undefined}
        title="Medicines"
      />

      {active.length === 0 ? (
        <EmptyState
          icon={(colour) => <Pill size={22} color={colour} />}
          title="No medicines yet"
          description="Add your medicines on the web app and they sync here."
        />
      ) : (
        <View style={sharedStyles.stack}>
          {active.map((medicine) => {
            const remaining = dosesRemainingInStock(medicine);
            const low = isLowStock(medicine);

            return (
              <Panel key={medicine.id} critical={medicine.isCritical}>
                <PanelHead
                  label={SCHEDULE_LABEL[medicine.schedule.kind] ?? medicine.schedule.kind}
                  aside={medicine.isCritical ? <Badge label="Critical" tone="danger" /> : undefined}
                />

                <PanelBody>
                  <Text style={[type.lg, { color: c.text }]} numberOfLines={1}>
                    {medicine.name}
                  </Text>
                  <Text style={[type.xs, { color: c.text3, marginTop: 2 }]}>
                    {medicine.strength}
                  </Text>

                  {medicine.schedule.times.length > 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: spacing.sm,
                        marginTop: spacing.md,
                      }}
                    >
                      {medicine.schedule.times.map((time) => (
                        <View
                          key={time}
                          style={{
                            backgroundColor: c.surface2,
                            borderRadius: radius.xs,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                          }}
                        >
                          <Text style={[type.micro, TABULAR, { color: c.text2 }]}>
                            {formatTime12h(time)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {medicine.instructions ? (
                    <Text style={[type.xs, { color: c.text3, marginTop: spacing.md }]}>
                      {medicine.instructions}
                    </Text>
                  ) : null}

                  {/* Supply is shown in doses, not units — "6 doses left" is
                      actionable; "12 tablets" needs mental arithmetic. */}
                  {remaining !== null && (
                    <View style={{ marginTop: spacing.md }}>
                      <Banner
                        tone={low ? 'warn' : 'neutral'}
                        icon={<Package size={16} color={low ? c.warnInk : c.text2} />}
                      >
                        {`${remaining} ${remaining === 1 ? 'dose' : 'doses'} left${low ? ' — time to reorder' : ''}`}
                      </Banner>
                    </View>
                  )}
                </PanelBody>
              </Panel>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
