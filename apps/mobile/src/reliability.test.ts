import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addSamples, MAX_SAMPLES, sampleFrom, summariseDelivery } from './delivery-health.ts';
import { guideFor } from './oem-guide.ts';
import { reminderProblems, type ReminderSignals } from './reminder-problems.ts';

const healthy: ReminderSignals = {
  hasMedicines: true,
  notifications: 'granted',
  exactAlarms: true,
  batteryUnrestricted: true,
  vendorSeverity: 5,
  scheduled: 42,
  delivery: { count: 10, medianLateMinutes: 0, verdict: 'ok' },
};

test('a healthy setup reports no problems', () => {
  assert.deepEqual(reminderProblems(healthy), []);
});

test('no medicines means nothing to warn about', () => {
  assert.deepEqual(reminderProblems({ ...healthy, hasMedicines: false, notifications: 'denied' }), []);
});

test('notifications off outranks everything else', () => {
  assert.deepEqual(
    reminderProblems({ ...healthy, notifications: 'denied', exactAlarms: false }),
    ['notifications_off'],
  );
});

test('denied exact alarms is reported — the Android 14 default', () => {
  assert.deepEqual(reminderProblems({ ...healthy, exactAlarms: false }), ['exact_alarms_off']);
});

test('unknown exact-alarm state (Expo Go) is not reported as a problem', () => {
  assert.deepEqual(reminderProblems({ ...healthy, exactAlarms: null }), []);
});

test('battery restriction only matters on skins that kill apps', () => {
  assert.deepEqual(reminderProblems({ ...healthy, batteryUnrestricted: false, vendorSeverity: 1 }), []);
  assert.deepEqual(reminderProblems({ ...healthy, batteryUnrestricted: false, vendorSeverity: 5 }), [
    'battery_restricted',
  ]);
});

test('measured lateness is reported even when every setting looks right', () => {
  assert.deepEqual(
    reminderProblems({ ...healthy, delivery: { count: 6, medianLateMinutes: 25, verdict: 'late' } }),
    ['arriving_late'],
  );
});

const DUE = '2026-10-22T02:30:00.000Z';
const dueMs = Date.parse(DUE);

function late(minutes: number, i: number) {
  return sampleFrom(`n${i}`, DUE, dueMs + minutes * 60_000, i)!;
}

test('too few samples gives no verdict rather than a guess', () => {
  assert.equal(summariseDelivery([late(30, 1), late(30, 2)]).verdict, 'unknown');
});

test('reminders arriving within seconds are ok', () => {
  const log = [late(0, 1), late(0.2, 2), late(1, 3), late(0, 4)];
  assert.equal(summariseDelivery(log).verdict, 'ok');
});

test('reminders deferred by Doze are flagged late', () => {
  const log = [late(14, 1), late(22, 2), late(9, 3), late(41, 4), late(18, 5)];
  const summary = summariseDelivery(log);
  assert.equal(summary.verdict, 'late');
  assert.equal(summary.medianLateMinutes, 18);
});

test('one bad outlier does not condemn an otherwise healthy phone', () => {
  const log = [late(0, 1), late(0, 2), late(120, 3), late(1, 4), late(0, 5)];
  assert.equal(summariseDelivery(log).verdict, 'ok');
});

test('the same delivery is only counted once', () => {
  const sample = late(30, 1);
  assert.equal(addSamples([sample], [sample]).length, 1);
});

test('only the most recent samples are kept', () => {
  const many = Array.from({ length: MAX_SAMPLES + 10 }, (_, i) => late(0, i));
  const kept = addSamples([], many);
  assert.equal(kept.length, MAX_SAMPLES);
  assert.equal(kept[0]!.recordedAt, 10);
});

test('early delivery is clamped to zero, not counted as negative lateness', () => {
  assert.equal(sampleFrom('n', DUE, dueMs - 60_000, 0)!.lateMinutes, 0);
});

test('vendor names map to the right guide', () => {
  assert.equal(guideFor('Xiaomi').vendor, 'xiaomi');
  assert.equal(guideFor('Redmi').vendor, 'xiaomi');
  assert.equal(guideFor('POCO').vendor, 'xiaomi');
  assert.equal(guideFor('realme').vendor, 'realme');
  assert.equal(guideFor('OnePlus').vendor, 'oneplus');
  assert.equal(guideFor('OPPO').vendor, 'oppo');
  assert.equal(guideFor('vivo').vendor, 'vivo');
  assert.equal(guideFor('samsung').vendor, 'samsung');
  assert.equal(guideFor('Google').vendor, 'other');
  assert.equal(guideFor(null).vendor, 'other');
});
