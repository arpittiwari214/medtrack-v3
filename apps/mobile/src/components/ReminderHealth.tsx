/**
 * Telling the patient whether their reminders can be trusted — and how to fix
 * it when they cannot.
 *
 * The banner sits on Today and is deliberately loud: a medication reminder that
 * silently does not ring is the worst failure this app has, and the patient is
 * the only person who can flip the switches involved.
 */

import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { requestPermission } from '../notifications/index';
import {
  openAutostartSettings,
  openBatterySettings,
  openExactAlarmSettings,
} from '../../modules/medtrack-alarms';
import type { ReminderProblem } from '../reminder-problems';
import type { ReminderHealth } from '../notifications/health';
import { radius, spacing, type, useTheme } from '../theme';
import { ActionPrimary, ActionSecondary, Banner, Panel, PanelBody, PanelHead } from './ui';
import { AlertTriangle, Check, ChevronRight } from './icons';
import { formatDate, type Params, type StringKey } from '../i18n';
import { useT } from '../i18n/useT';

interface ProblemCopy {
  headline: string;
  detail: string;
  fixLabel: string;
}

type T = (key: StringKey, params?: Params) => string;

function copyFor(problem: ReminderProblem, health: ReminderHealth, t: T): ProblemCopy {
  switch (problem) {
    case 'notifications_off':
      return {
        headline: t('p_notifications_h'),
        detail: t('p_notifications_d'),
        fixLabel: t('p_notifications_f'),
      };
    case 'exact_alarms_off':
      return { headline: t('p_exact_h'), detail: t('p_exact_d'), fixLabel: t('p_exact_f') };
    case 'arriving_late':
      return {
        headline: t('p_late_h'),
        detail: t('p_late_d', { n: health.delivery.medianLateMinutes ?? '?' }),
        fixLabel: t('p_battery_f'),
      };
    case 'battery_restricted':
      return {
        headline: t('p_battery_h'),
        detail: t('p_battery_d', { vendor: health.vendor.label }),
        fixLabel: t('p_battery_f'),
      };
    case 'nothing_scheduled':
      return { headline: t('p_none_h'), detail: t('p_none_d'), fixLabel: t('p_none_f') };
  }
}

/** Run the fix for one problem. */
async function fix(problem: ReminderProblem, health: ReminderHealth, reschedule: () => Promise<unknown>) {
  switch (problem) {
    case 'notifications_off': {
      // Once denied, the OS will not ask again — only Settings can undo it.
      if (health.notifications === 'denied') await Linking.openSettings();
      else if ((await requestPermission()).granted) await reschedule();
      return;
    }
    case 'exact_alarms_off':
      await openExactAlarmSettings();
      return;
    case 'arriving_late':
    case 'battery_restricted':
      await openBatterySettings();
      return;
    case 'nothing_scheduled':
      await reschedule();
      return;
  }
}

/** The loud version, for Today. Renders nothing when reminders look healthy. */
export function ReminderAlertBanner() {
  const c = useTheme();
  const { health } = useApp();
  const { t } = useT();
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();

  const first = health?.problems[0];
  if (!health || !first) return null;
  const copy = copyFor(first, health, t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.headline}. ${copy.detail}`}
      onPress={() => navigation.navigate('Settings')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'center',
        padding: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.danger,
        backgroundColor: pressed ? c.dangerBg : c.surface,
      })}
    >
      <AlertTriangle size={22} color={c.danger} />
      <View style={{ flex: 1 }}>
        <Text style={[type.base, { color: c.text, fontWeight: '700' }]}>{copy.headline}</Text>
        <Text style={[type.xs, { color: c.text2, marginTop: 2, lineHeight: 18 }]} numberOfLines={2}>
          {copy.detail}
        </Text>
      </View>
      <Text style={[type.sm, { color: c.dangerInk, fontWeight: '700' }]}>{t('rh_fix')}</Text>
      <ChevronRight size={16} color={c.dangerInk} />
    </Pressable>
  );
}

/** The full checklist, for Settings. */
export function ReminderHealthPanel() {
  const c = useTheme();
  const { health, rescheduleNow, refreshHealth } = useApp();
  const { t, locale } = useT();
  const [showSteps, setShowSteps] = useState(false);

  if (!health) return null;

  const run = async (problem: ReminderProblem) => {
    await fix(problem, health, () => rescheduleNow());
    await refreshHealth();
  };

  const runwayDays = health.runwayUntil
    ? Math.max(0, Math.round((health.runwayUntil.getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <Panel>
      <PanelHead label={t('rh_title')} />
      <PanelBody>
        {health.problems.length === 0 ? (
          <Banner tone="ok" icon={<Check size={18} color={c.okInk} />}>
            {t('rh_healthy')}
          </Banner>
        ) : (
          <View style={{ gap: spacing.lg }}>
            {health.problems.map((problem) => {
              const copy = copyFor(problem, health, t);
              return (
                <View key={problem} style={{ gap: spacing.sm }}>
                  <Text style={[type.base, { color: c.text, fontWeight: '700' }]}>{copy.headline}</Text>
                  <Text style={[type.sm, { color: c.text2, lineHeight: 20 }]}>{copy.detail}</Text>
                  <ActionPrimary label={copy.fixLabel} onPress={() => void run(problem)} />
                </View>
              );
            })}
          </View>
        )}

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Row label={t('rh_set')} value={String(health.scheduled)} />
          <Row
            label={t('rh_covered')}
            value={
              runwayDays === null
                ? '—'
                : t('rh_covered_value', {
                    date: formatDate(locale, health.runwayUntil!.toISOString().slice(0, 10), 'short'),
                    n: runwayDays,
                  })
            }
          />
          <Row
            label={t('rh_delay')}
            value={
              health.delivery.medianLateMinutes === null
                ? t('rh_delay_none')
                : t('rh_delay_value', {
                    n: health.delivery.medianLateMinutes,
                    count: health.delivery.count,
                  })
            }
          />
          {!health.canInspect && (
            <Text style={[type.xs, { color: c.text3, lineHeight: 18 }]}>
              {t('rh_cannot_inspect')}
            </Text>
          )}
        </View>

        {health.vendor.severity >= 3 && (
          <View style={{ marginTop: spacing.xl }}>
            <ActionSecondary
              label={showSteps ? t('rh_hide_steps') : t('rh_steps_for', { vendor: health.vendor.label })}
              onPress={() => setShowSteps((value) => !value)}
            />
            {showSteps && (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {health.vendor.steps.map((step, index) => (
                  <Text key={step} style={[type.sm, { color: c.text, lineHeight: 21 }]}>
                    {index + 1}. {step}
                  </Text>
                ))}
                <View style={{ marginTop: spacing.sm }}>
                  <ActionSecondary
                    label={t('rh_open_settings')}
                    onPress={() => void openAutostartSettings()}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </PanelBody>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Text style={[type.sm, { color: c.text2 }]}>{label}</Text>
      <Text style={[type.sm, { color: c.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>
        {value}
      </Text>
    </View>
  );
}
