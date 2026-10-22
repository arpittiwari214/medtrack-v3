/**
 * Seed a demo account with about a month of realistic dose history.
 *
 *   node scripts/seed-demo.mjs
 *
 * Requires the API and MongoDB to be running. Idempotent — re-running updates
 * the same account rather than creating a second one.
 *
 * Dose materialisation in the API is deliberately forward-only: it never
 * invents doses for days before a medicine existed. So the history here is
 * written straight to the database, using `expandMedicine` from the shared
 * package so every row carries exactly the deterministic id, UTC instant and
 * local fields the real engine would have produced. Seeded data is therefore
 * indistinguishable from data the app generated itself.
 */

import { MongoClient } from 'mongodb';
import { addDays, expandMedicine, todayIn } from '@medtrack/shared';

const API = process.env.API_URL ?? 'http://localhost:5000/api';
const MONGO = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/medtrack';

const EMAIL = 'demo@medtrack.local';
const PASSWORD = 'demo-account-password';
const TZ = 'Asia/Kolkata';
const HISTORY_DAYS = 34;

const MEDICINES = [
  { name: 'Metformin', strength: '500 mg', times: ['08:00', '21:00'], isCritical: false, stock: 26 },
  { name: 'Amlodipine', strength: '5 mg', times: ['09:00'], isCritical: true, stock: 9 },
  { name: 'Atorvastatin', strength: '10 mg', times: ['22:00'], isCritical: false, stock: 4 },
];

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, json };
}

/* ── Account ─────────────────────────────────────────────────────────────── */

let auth = await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
if (auth.status !== 200) {
  auth = await call('/auth/signup', {
    method: 'POST',
    body: {
      email: EMAIL,
      password: PASSWORD,
      name: 'Demo Patient',
      timezone: TZ,
      acceptedTerms: true,
      acceptedPrivacy: true,
    },
  });
}
if (!auth.json?.accessToken) {
  console.error(`Could not sign in or sign up (http ${auth.status}). Is the API running?`);
  process.exit(1);
}
const token = auth.json.accessToken;

const today = todayIn(TZ);
const startDate = addDays(today, -HISTORY_DAYS);

/**
 * Reuse any medicine that already exists by name.
 *
 * Relying on the API's duplicate check is not enough: its uniqueness key
 * includes the start date, and `startDate` here is relative to *today*. A run
 * on a later day therefore produced a second, legitimately-distinct course of
 * the same medicine — so re-seeding accumulated duplicates instead of being
 * idempotent, which is what this script promises.
 */
const existing = await call('/medicines', { token });
const existingNames = new Set(
  (existing.json?.medicines ?? []).map((m) => m.name.toLowerCase()),
);

for (const medicine of MEDICINES) {
  if (existingNames.has(medicine.name.toLowerCase())) continue;

  const res = await call('/medicines', {
    method: 'POST',
    token,
    body: {
      name: medicine.name,
      strength: medicine.strength,
      form: 'tablet',
      isCritical: medicine.isCritical,
      schedule: { kind: 'daily', times: medicine.times, startDate },
      stock: { unitsRemaining: medicine.stock, unitsPerDose: 1, lowThreshold: 6 },
    },
  });
  if (res.status !== 201 && res.status !== 409) {
    console.warn(`  ${medicine.name}: http ${res.status}`);
  }
}

/* ── Appointments ────────────────────────────────────────────────────────── */

const APPOINTMENTS = [
  {
    kind: 'lab_test',
    title: 'HbA1c and lipid panel',
    offsetDays: 3,
    localTime: '08:30',
    provider: 'Apollo Diagnostics',
    location: 'Sector 62, Noida',
    requiresFasting: true,
    notes: 'Nothing to eat after 10pm the night before.',
  },
  {
    kind: 'doctor',
    title: 'Diabetes review',
    offsetDays: 12,
    localTime: '16:00',
    provider: 'Dr. Rao',
    location: 'Fortis, Noida',
    requiresFasting: false,
    notes: null,
  },
  {
    kind: 'doctor',
    title: 'Blood pressure check',
    offsetDays: -9,
    localTime: '11:00',
    provider: 'Dr. Rao',
    location: null,
    requiresFasting: false,
    notes: null,
  },
];

// Both scopes: one of the seeded appointments is deliberately in the past, and
// checking only `upcoming` recreated it on every run.
const [upcomingRes, pastRes] = await Promise.all([
  call('/appointments?scope=upcoming', { token }),
  call('/appointments?scope=past', { token }),
]);
const existingByTitle = new Map(
  [...(upcomingRes.json?.appointments ?? []), ...(pastRes.json?.appointments ?? [])].map((a) => [
    a.title.toLowerCase(),
    a,
  ]),
);

for (const appointment of APPOINTMENTS) {
  // Upsert rather than skip. Dates here are relative to today, so skipping an
  // existing one left the demo's "upcoming" list empty once the seed was a few
  // weeks old — which is exactly the state the Appointments screen is meant to
  // show. Patching the date keeps it idempotent *and* keeps it useful.
  const body = {
    kind: appointment.kind,
    title: appointment.title,
    localDate: addDays(today, appointment.offsetDays),
    localTime: appointment.localTime,
    provider: appointment.provider,
    location: appointment.location,
    notes: appointment.notes,
    requiresFasting: appointment.requiresFasting,
    durationMinutes: 30,
    reminderOffsetsMinutes: [1440, 60],
  };

  const found = existingByTitle.get(appointment.title.toLowerCase());
  const res = found
    ? await call(`/appointments/${found.id}`, {
        method: 'PATCH',
        token,
        // A past appointment that has rolled forward is scheduled again.
        body: { ...body, status: appointment.offsetDays < 0 ? 'completed' : 'scheduled' },
      })
    : await call('/appointments', { method: 'POST', token, body });

  const expected = found ? 200 : 201;
  if (res.status !== expected) console.warn(`  ${appointment.title}: http ${res.status}`);
}

/* ── History ─────────────────────────────────────────────────────────────── */

const client = new MongoClient(MONGO);
await client.connect();
const db = client.db(new URL(MONGO.replace('mongodb://', 'http://')).pathname.slice(1) || 'medtrack');

const user = await db.collection('users').findOne({ email: EMAIL });
const medicines = await db.collection('medicines').find({ userId: user._id }).toArray();

/**
 * A believable adherence pattern rather than uniform noise: mostly adherent,
 * measurably weaker late in the evening, with one rough stretch a fortnight
 * back. That gives the insights engine a real time-of-day signal to find.
 */
function outcomeFor(localDate, localTime, index) {
  const hour = Number(localTime.slice(0, 2));
  const age = Math.round((new Date(today).getTime() - new Date(localDate).getTime()) / 86_400_000);

  if (age < 0) return 'scheduled';
  if (age === 0) return index % 2 === 0 ? 'taken' : 'scheduled';
  if (age >= 12 && age <= 15) return index % 3 === 0 ? 'taken' : 'missed';
  if (hour >= 21) return index % 4 === 0 ? 'missed' : 'taken';
  if (index % 19 === 0) return 'skipped';
  return 'taken';
}

const operations = [];
let index = 0;

for (const med of medicines) {
  const domain = {
    id: med._id,
    userId: med.userId,
    name: med.name,
    strength: med.strength,
    form: med.form,
    timezone: med.timezone,
    isCritical: med.isCritical,
    instructions: med.instructions ?? '',
    prescribedBy: null,
    missedAfterMinutes: med.missedAfterMinutes ?? null,
    archivedAt: null,
    createdAt: med.createdAt.toISOString(),
    updatedAt: med.updatedAt.toISOString(),
    rev: med.rev,
    stock: null,
    schedule: {
      kind: med.schedule.kind,
      times: med.schedule.times,
      startDate: med.schedule.startDate,
      endDate: med.schedule.endDate ?? null,
      intervalDays: med.schedule.intervalDays ?? null,
      weekdays: med.schedule.weekdays ?? null,
      cycleOnDays: med.schedule.cycleOnDays ?? null,
      cycleOffDays: med.schedule.cycleOffDays ?? null,
    },
  };

  for (const dose of expandMedicine(domain, { from: startDate, to: today })) {
    const status = outcomeFor(dose.localDate, dose.localTime, index++);
    const scheduledAt = new Date(dose.scheduledAt);

    operations.push({
      updateOne: {
        filter: { _id: dose.id },
        update: {
          $set: {
            userId: dose.userId,
            medicineId: dose.medicineId,
            scheduledAt,
            localDate: dose.localDate,
            localTime: dose.localTime,
            timezone: dose.timezone,
            status,
            takenAt: status === 'taken' ? scheduledAt : null,
            snoozedUntil: null,
            snoozeCount: 0,
            skipReason: status === 'skipped' ? 'Felt unwell' : null,
            medicineName: dose.medicineName,
            medicineStrength: dose.medicineStrength,
            isCritical: dose.isCritical,
            isAdHoc: false,
            missedAt: new Date(dose.missedAt),
            graceMinutes: 60,
            // Marked as already alerted, so the miss sweep does not email the
            // demo account's caregivers about a month of backdated misses.
            missAlertedAt: status === 'missed' ? scheduledAt : null,
            rev: 1,
            createdAt: scheduledAt,
            updatedAt: scheduledAt,
          },
        },
        upsert: true,
      },
    });
  }
}

const written = await db.collection('doseevents').bulkWrite(operations, { ordered: false });
await client.close();

/* ── Report ──────────────────────────────────────────────────────────────── */

const analytics = await call('/doses/analytics?days=30', { token });
const summary = analytics.json?.summary;

console.log(`\nSeeded ${EMAIL}`);
console.log(`  password   ${PASSWORD}`);
console.log(`  medicines  ${medicines.length}`);
console.log(`  doses      ${written.upsertedCount} created, ${written.modifiedCount} updated`);
console.log(`  adherence  ${summary?.ratePercent}%  ·  streak ${summary?.streakDays}d  ·  ${summary?.taken} taken, ${summary?.missed} missed`);
console.log(`  insights   ${(analytics.json?.insights ?? []).map((i) => i.kind).join(', ') || 'none'}`);
