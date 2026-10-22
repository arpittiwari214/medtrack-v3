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

interface ProblemCopy {
  headline: string;
  detail: string;
  fixLabel: string;
}

function copyFor(problem: ReminderProblem, health: ReminderHealth): ProblemCopy {
  switch (problem) {
    case 'notifications_off':
      return {
        headline: 'Notifications are off',
        detail: 'MedTrack cannot remind you until notifications are allowed.',
        fixLabel: 'Turn on notifications',
      };
    case 'exact_alarms_off':
      return {
        headline: 'Reminders may come late',
        detail:
          'Your phone is set to deliver reminders "roughly on time", which can mean hours late. Allow exact reminders to fix this.',
        fixLabel: 'Allow exact reminders',
      };
    case 'arriving_late':
      return {
        headline: 'Recent reminders arrived late',
        detail: `They came about ${health.delivery.medianLateMinutes ?? '?'} minutes after the dose time. Your phone's battery settings are the usual cause.`,
        fixLabel: 'Fix battery settings',
      };
    case 'battery_restricted':
      return {
        headline: 'Battery saver can stop reminders',
        detail: `${health.vendor.label} phones often close apps in the background. Allow MedTrack to run so reminders still ring.`,
        fixLabel: 'Fix battery settings',
      };
    case 'nothing_scheduled':
      return {
        headline: 'No reminders are set',
        detail: 'Your medicines have no upcoming reminders on this phone.',
        fixLabel: 'Set up reminders',
      };
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
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();

  const first = health?.problems[0];
  if (!health || !first) return null;
  const copy = copyFor(first, health);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.headline}. ${copy.detail} Open settings to fix.`}
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
      <Text style={[type.sm, { color: c.dangerInk, fontWeight: '700' }]}>Fix</Text>
      <ChevronRight size={16} color={c.dangerInk} />
    </Pressable>
  );
}

/** The full checklist, for Settings. */
export function ReminderHealthPanel() {
  const c = useTheme();
  const { health, rescheduleNow, refreshHealth } = useApp();
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
      <PanelHead label="Reminders on this phone" />
      <PanelBody>
        {health.problems.length === 0 ? (
          <Banner tone="ok" icon={<Check size={18} color={c.okInk} />}>
            Reminders look healthy on this phone.
          </Banner>
        ) : (
          <View style={{ gap: spacing.lg }}>
            {health.problems.map((problem) => {
              const copy = copyFor(problem, health);
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
          <Row label="Reminders set" value={String(health.scheduled)} />
          <Row
            label="Covered until"
            value={
              runwayDays === null
                ? '—'
                : `${health.runwayUntil!.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} (${runwayDays} days)`
            }
          />
          <Row
            label="Measured delay"
            value={
              health.delivery.medianLateMinutes === null
                ? 'Not enough data yet'
                : `${health.delivery.medianLateMinutes} min (last ${health.delivery.count})`
            }
          />
          {!health.canInspect && (
            <Text style={[type.xs, { color: c.text3, lineHeight: 18 }]}>
              This test build cannot read your phone's alarm and battery settings. The full app can.
            </Text>
          )}
        </View>

        {health.vendor.severity >= 3 && (
          <View style={{ marginTop: spacing.xl }}>
            <ActionSecondary
              label={showSteps ? 'Hide steps' : `Steps for ${health.vendor.label}`}
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
                    label="Open these settings"
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
