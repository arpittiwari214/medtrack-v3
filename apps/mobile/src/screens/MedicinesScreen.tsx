import { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  dosesRemainingInStock,
  formatTime12h,
  isLowStock,
  slotNotation,
  type Medicine,
} from '@medtrack/shared';
import { useApp } from '../context/AppContext';
import { MIN_TOUCH, TABULAR, radius, spacing, type, useTheme } from '../theme';
import { Badge, Banner, EmptyState, Panel, PanelBody, PanelHead, ScreenHeader, sharedStyles } from '../components/ui';
import { ColorDot, MedicinePhoto } from '../components/recognition';
import { Package, Pill } from '../components/icons';
import AddMedicineScreen from './AddMedicineScreen';

const SCHEDULE_LABEL: Record<string, string> = {
  daily: 'Every day',
  interval_days: 'Every few days',
  days_of_week: 'Certain days',
  cyclic: 'On and off',
  as_needed: 'When needed',
};

export default function MedicinesScreen() {
  const c = useTheme();
  const { cache, syncing, refresh, photos } = useApp();
  const [adding, setAdding] = useState(false);

  const active = useMemo(
    () => (cache.medicines as Medicine[]).filter((medicine) => !medicine.archivedAt),
    [cache.medicines],
  );

  const addButton = (
    <Pressable
      accessibilityRole="button"
      onPress={() => setAdding(true)}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
        borderRadius: radius.sm,
        backgroundColor: c.brandStrong,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={[type.sm, { color: c.onBrand, fontWeight: '700' }]}>Add</Text>
    </Pressable>
  );

  return (
    <>
      <ScrollView
        style={[sharedStyles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={sharedStyles.content}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={c.brand} />}
      >
        <ScreenHeader
          eyebrow={active.length > 0 ? `${active.length} active` : undefined}
          title="Medicines"
          action={addButton}
        />

        {active.length === 0 ? (
          <EmptyState
            icon={(colour) => <Pill size={22} color={colour} />}
            title="No medicines yet"
            description="Tap Add and photograph the strip. You do not need to type the name."
          />
        ) : (
          <View style={sharedStyles.stack}>
            {active.map((medicine) => {
              const remaining = dosesRemainingInStock(medicine);
              const low = isLowStock(medicine);

              return (
                <Panel key={medicine.id} critical={medicine.isCritical}>
                  <PanelHead
                    label={`${SCHEDULE_LABEL[medicine.schedule.kind] ?? medicine.schedule.kind} · ${slotNotation(medicine.schedule.times)}`}
                    aside={medicine.isCritical ? <Badge label="Important" tone="danger" /> : undefined}
                  />

                  <PanelBody>
                    {/* The photo is larger than the name: it is what the
                        patient actually recognises. */}
                    <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
                      <MedicinePhoto uri={photos[medicine.id]} color={medicine.pillColor} size={84} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <ColorDot color={medicine.pillColor} size={14} />
                          <ColorDot color={medicine.stripColor} size={14} />
                          <Text style={[type.lg, { color: c.text, flexShrink: 1 }]} numberOfLines={2}>
                            {medicine.name}
                          </Text>
                        </View>
                        <Text style={[type.sm, { color: c.text2 }]}>
                          {[medicine.strength, medicine.purpose && `for ${medicine.purpose}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                    </View>

                    {medicine.schedule.times.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                        {medicine.schedule.times.map((time) => (
                          <View
                            key={time}
                            style={{ backgroundColor: c.surface2, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 3 }}
                          >
                            <Text style={[type.xs, TABULAR, { color: c.text2, fontWeight: '600' }]}>
                              {formatTime12h(time)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Supply in doses, not units — "6 doses left" is actionable;
                        "12 tablets" needs arithmetic. */}
                    {remaining !== null && (
                      <View style={{ marginTop: spacing.md }}>
                        <Banner
                          tone={low ? 'warn' : 'neutral'}
                          icon={<Package size={16} color={low ? c.warnInk : c.text2} />}
                        >
                          {`${remaining} ${remaining === 1 ? 'dose' : 'doses'} left${low ? ' — time to buy more' : ''}`}
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

      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
        <AddMedicineScreen onDone={() => setAdding(false)} />
      </Modal>
    </>
  );
}
