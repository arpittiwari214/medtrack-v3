import { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  dosesRemainingInStock,
  formatTimeFor,
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
import { dosesLeft, type StringKey } from '../i18n';
import { useT } from '../i18n/useT';

export default function MedicinesScreen() {
  const c = useTheme();
  const { cache, syncing, refresh, photos } = useApp();
  const { t, locale } = useT();
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
      <Text style={[type.sm, { color: c.onBrand, fontWeight: '700' }]}>{t('add')}</Text>
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
          eyebrow={active.length > 0 ? t('active_count', { n: active.length }) : undefined}
          title={t('medicines_title')}
          action={addButton}
        />

        {active.length === 0 ? (
          <EmptyState
            icon={(colour) => <Pill size={22} color={colour} />}
            title={t('medicines_empty_title')}
            description={t('medicines_empty_body')}
          />
        ) : (
          <View style={sharedStyles.stack}>
            {active.map((medicine) => {
              const remaining = dosesRemainingInStock(medicine);
              const low = isLowStock(medicine);

              return (
                <Panel key={medicine.id} critical={medicine.isCritical}>
                  <PanelHead
                    label={`${t(`sched_${medicine.schedule.kind}` as StringKey)} · ${slotNotation(medicine.schedule.times)}`}
                    aside={medicine.isCritical ? <Badge label={t('important')} tone="danger" /> : undefined}
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
                          {[medicine.strength, medicine.purpose && t('for_purpose', { purpose: medicine.purpose })]
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
                              {formatTimeFor(time, locale)}
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
                          {`${dosesLeft(locale, remaining)}${low ? t('buy_more_suffix') : ''}`}
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
