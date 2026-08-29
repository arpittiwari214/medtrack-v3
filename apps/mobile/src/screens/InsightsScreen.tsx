/**
 * Adherence insight.
 *
 * Computed entirely from the offline cache with the shared analytics functions,
 * so the screen works with no signal — the web client asks the API for the same
 * numbers, but the phone already holds every dose it needs.
 *
 * Same tone as the web: the chart is a **single series**, so it gets a single
 * hue. Colouring each bar by its own value spends the reserved status palette on
 * a continuum and makes an ordinary week look like an alarm panel. Status
 * appears once, on the headline figure, paired with a word.
 */

import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  addDays,
  byMedicine,
  dailySeries,
  formatLocalDate,
  insights as deriveInsights,
  summarise,
  todayIn,
  type DailyAdherencePoint,
} from '@medtrack/shared';
import { useApp } from '../context/AppContext';
import { TABULAR, radius, spacing, type, useTheme } from '../theme';
import {
  Badge,
  Banner,
  EmptyState,
  MetricStrip,
  Panel,
  PanelBody,
  PanelHead,
  ScreenHeader,
  sharedStyles,
} from '../components/ui';
import { Chart as ChartIcon, Info } from '../components/icons';

const RANGES = [7, 30, 90] as const;

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/** Status band for a rate. Always rendered with its label, never colour alone. */
function band(rate: number): { label: string; tone: 'ok' | 'warn' | 'danger' } {
  if (rate >= 80) return { label: 'On track', tone: 'ok' };
  if (rate >= 50) return { label: 'Slipping', tone: 'warn' };
  return { label: 'Needs attention', tone: 'danger' };
}

export default function InsightsScreen() {
  const c = useTheme();
  const { user, cache, syncing, refresh } = useApp();
  const [days, setDays] = useState<number>(30);

  const zone = user?.timezone ?? deviceZone();
  const today = todayIn(zone);
  const from = addDays(today, -(days - 1));

  const scoped = useMemo(
    () => cache.doses.filter((dose) => dose.localDate >= from && dose.localDate <= today),
    [cache.doses, from, today],
  );

  const context = useMemo(() => ({ timezone: zone, today }), [zone, today]);
  const summary = useMemo(() => summarise(scoped, context), [scoped, context]);
  const perMedicine = useMemo(() => byMedicine(scoped, context), [scoped, context]);
  const daily = useMemo(() => dailySeries(scoped, from, today), [scoped, from, today]);
  const found = useMemo(() => deriveInsights(scoped, context), [scoped, context]);

  const resolved = summary.taken + summary.missed;
  const status = band(summary.ratePercent);

  return (
    <ScrollView
      style={[sharedStyles.screen, { backgroundColor: c.bg }]}
      contentContainerStyle={sharedStyles.content}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={c.brand} />}
    >
      <ScreenHeader
        eyebrow={`Last ${days} days`}
        title="Insights"
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
            {RANGES.map((range) => {
              const active = days === range;
              return (
                <Pressable
                  key={range}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setDays(range)}
                  style={{
                    minHeight: 38,
                    paddingHorizontal: spacing.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.xs,
                    backgroundColor: active ? c.surface : 'transparent',
                  }}
                >
                  <Text
                    style={[
                      type.xs,
                      TABULAR,
                      { color: active ? c.text : c.text2, fontWeight: '600' },
                    ]}
                  >
                    {range}d
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
      />

      {resolved === 0 ? (
        <EmptyState
          icon={(colour) => <ChartIcon size={22} color={colour} />}
          title="Not enough history yet"
          description="Once you have logged a few doses, this is where the patterns show up."
        />
      ) : (
        <View style={sharedStyles.stack}>
          {/* The one number the screen leads with. Exactly one hero per view. */}
          <Panel>
            <PanelHead
              label="Doses taken"
              aside={<Badge label={status.label} tone={status.tone} />}
            />
            <PanelBody>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                <Text
                  style={{ fontSize: 48, fontWeight: '700', letterSpacing: -1.8, color: c.text }}
                >
                  {summary.ratePercent}
                </Text>
                <Text style={[type.title, { color: c.text3 }]}>%</Text>
              </View>
              <Text style={[type.sm, { color: c.text2, marginTop: spacing.sm, lineHeight: 20 }]}>
                {summary.taken} of {resolved} doses over {days} days.
                {summary.streakDays > 0 ? ` Currently on a ${summary.streakDays}-day streak.` : ''}
              </Text>
            </PanelBody>
          </Panel>

          <MetricStrip
            items={[
              { value: summary.streakDays, label: 'Streak' },
              { value: summary.missed, label: 'Missed' },
              { value: summary.skipped, label: 'Skipped' },
            ]}
          />

          {found.length > 0 && (
            <View style={sharedStyles.stackSm}>
              {found.slice(0, 2).map((insight) => (
                <Banner key={insight.kind} tone="info" icon={<Info size={18} color={c.infoInk} />}>
                  {insight.message}
                </Banner>
              ))}
            </View>
          )}

          <AdherenceChart daily={daily} from={from} to={today} />

          <Panel>
            <PanelHead label="By medicine" />
            <PanelBody>
              <View style={{ gap: spacing.lg }}>
                {perMedicine.map((medicine) => {
                  const level = band(medicine.ratePercent);
                  return (
                    <View key={medicine.medicineId}>
                      <View style={[sharedStyles.rowBetween, { marginBottom: spacing.sm }]}>
                        <Text
                          style={[type.sm, { color: c.text, fontWeight: '600', flex: 1 }]}
                          numberOfLines={1}
                        >
                          {medicine.medicineName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <Badge label={level.label} tone={level.tone} />
                          <Text
                            style={[type.sm, TABULAR, { color: c.text, fontWeight: '700' }]}
                          >
                            {medicine.ratePercent}%
                          </Text>
                        </View>
                      </View>

                      {/* The unfilled track is a lighter step of the same ramp,
                          so state reads across the whole bar. */}
                      <View
                        accessibilityRole="progressbar"
                        accessibilityLabel={`${medicine.medicineName}: ${medicine.ratePercent} percent taken, ${medicine.missed} missed of ${medicine.taken + medicine.missed}`}
                        style={{
                          height: 6,
                          backgroundColor: c.surface3,
                          borderRadius: radius.full,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${medicine.ratePercent}%`,
                            height: '100%',
                            backgroundColor: c.brand,
                            borderRadius: radius.full,
                          }}
                        />
                      </View>

                      <Text style={[type.xs, { color: c.text3, marginTop: 4 }]}>
                        {medicine.taken} taken · {medicine.missed} missed
                      </Text>
                    </View>
                  );
                })}
              </View>
            </PanelBody>
          </Panel>
        </View>
      )}
    </ScrollView>
  );
}

/**
 * Daily adherence, one column per day.
 *
 * Plain Views rather than SVG — these are rectangles, and reaching for a chart
 * library to draw rectangles costs a dependency and a lot of bundle for nothing.
 * Single series, so there is no legend: the panel header already says what is
 * plotted, and a one-swatch legend box would just restate it.
 */
function AdherenceChart({
  daily,
  from,
  to,
}: {
  daily: DailyAdherencePoint[];
  from: string;
  to: string;
}) {
  const c = useTheme();

  const withData = daily.filter((point) => point.ratePercent !== null);
  const average =
    withData.length > 0
      ? Math.round(
          withData.reduce((sum, point) => sum + (point.ratePercent ?? 0), 0) / withData.length,
        )
      : 0;

  const CHART_HEIGHT = 120;

  return (
    <Panel>
      <PanelHead
        label="Day by day"
        aside={
          <Text style={[type.xs, TABULAR, { color: c.text2 }]}>{average}% average</Text>
        }
      />
      <PanelBody>
        <View
          accessibilityRole="image"
          accessibilityLabel={`Daily adherence from ${from} to ${to}, averaging ${average} percent across ${withData.length} days with scheduled doses.`}
          style={{ height: CHART_HEIGHT, position: 'relative' }}
        >
          {/* Recessive hairline gridlines at 50% and 100%. */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: c.grid }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: CHART_HEIGHT / 2,
              height: 1,
              backgroundColor: c.grid,
            }}
          />

          {/* 2px of surface between bars does the separating — a stroke around
              each bar would add ink that is not data. */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: '100%' }}>
            {daily.map((point) => (
              <View key={point.localDate} style={{ flex: 1, justifyContent: 'flex-end', height: '100%' }}>
                {point.ratePercent === null ? (
                  // A day with no doses scheduled is a gap, not a zero.
                  <View
                    style={{ height: 3, borderRadius: 2, backgroundColor: c.borderStrong }}
                  />
                ) : (
                  <View
                    style={{
                      height: Math.max((point.ratePercent / 100) * CHART_HEIGHT, 3),
                      backgroundColor: c.brand,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                    }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={[sharedStyles.rowBetween, { marginTop: spacing.sm }]}>
          <Text style={[type.micro, TABULAR, { color: c.text3 }]}>{formatLocalDate(from)}</Text>
          <Text style={[type.micro, TABULAR, { color: c.text3 }]}>{formatLocalDate(to)}</Text>
        </View>

        <Text style={[type.xs, { color: c.text3, marginTop: spacing.md, lineHeight: 18 }]}>
          A flat tick marks a day with no doses scheduled — not a day you missed.
        </Text>
      </PanelBody>
    </Panel>
  );
}
