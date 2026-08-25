/**
 * Background jobs.
 *
 * v3 ran `node-cron` in-process on a free tier that sleeps after 15 minutes of
 * inactivity, so the scheduler died with the instance and reminders silently
 * stopped. This runs on a host that stays up, but the jobs are still written to
 * be safe if they miss a run or overlap: every one is idempotent and works from
 * durable state rather than from "what happened since I last ran".
 *
 * Each job also guards against overlapping with itself. A slow sweep must not
 * be re-entered by the next tick, or a missed dose could be alerted twice.
 */

import cron, { type ScheduledTask } from 'node-cron';
import {
  addDays,
  dosesRemainingInStock,
  isLowStock,
  todayIn,
} from '@medtrack/shared';
import { env } from '../config/env.js';
import { childLogger } from '../config/logger.js';
import { Appointment } from '../models/Appointment.js';
import { DoseEvent } from '../models/DoseEvent.js';
import { Medicine } from '../models/Medicine.js';
import { User } from '../models/User.js';
import { purgeDeletedAccounts } from '../routes/account.js';
import { raiseAlert } from './alerts.js';
import {
  MATERIALISE_AHEAD_DAYS,
  generateDosesForUser,
  toDomainMedicine,
  type MedicineSource,
} from './doses.js';
import { pushToUser } from './push.js';

const log = childLogger('scheduler');

const tasks: ScheduledTask[] = [];

/** Consecutive misses of a non-critical medicine before escalating. */
const CONSECUTIVE_MISS_THRESHOLD = 3;

/** How many recent doses to inspect when counting a run of misses. */
const MISS_LOOKBACK = 10;

/* ─────────────────────────── Overlap guard ──────────────────────────────── */

const running = new Set<string>();

/**
 * Run a job unless it is already running.
 *
 * Skipping is the right response, not queueing: these jobs are idempotent
 * sweeps over current state, so the next tick picks up whatever this one missed.
 */
async function guarded(name: string, job: () => Promise<void>): Promise<void> {
  if (running.has(name)) {
    log.warn({ job: name }, 'Previous run still in progress — skipping this tick');
    return;
  }
  running.add(name);
  const startedAt = Date.now();
  try {
    await job();
  } catch (error) {
    // A throwing job must never take the process down.
    log.error({ job: name, err: (error as Error).message }, 'Scheduled job failed');
  } finally {
    running.delete(name);
    log.debug({ job: name, ms: Date.now() - startedAt }, 'Job finished');
  }
}

/* ───────────────────────── Dose materialisation ─────────────────────────── */

/**
 * Keep every user's dose agenda populated.
 *
 * Runs per user so each person's own timezone decides what "today" means —
 * a single server-wide "today" is what made v3 generate the wrong days.
 */
export async function materialiseDoses(): Promise<void> {
  const cursor = User.find({ deletionRequestedAt: null })
    .select({ _id: 1, timezone: 1 })
    .cursor();

  let users = 0;
  let created = 0;

  for await (const user of cursor) {
    users++;
    created += await generateDosesForUser(
      String(user._id),
      user.timezone,
      MATERIALISE_AHEAD_DAYS,
    );
  }

  if (created > 0) log.info({ users, created }, 'Dose agenda extended');
}

/* ───────────────────────── Missed-dose detection ────────────────────────── */

/**
 * Flag overdue doses and escalate where warranted.
 *
 * The query is a bounded, indexed range scan over `missedAt` restricted to
 * unresolved doses, so cost tracks the number of *currently overdue* doses
 * rather than the size of the history.
 */
export async function detectMissedDoses(now: Date = new Date()): Promise<void> {
  const overdue = await DoseEvent.find({
    status: { $in: ['scheduled', 'snoozed'] },
    missedAt: { $lte: now },
  })
    .limit(1000)
    .lean();

  if (overdue.length === 0) return;

  const ids = overdue.map((dose) => dose._id);
  await DoseEvent.updateMany(
    { _id: { $in: ids }, status: { $in: ['scheduled', 'snoozed'] } },
    { $set: { status: 'missed', snoozedUntil: null }, $inc: { rev: 1 } },
  );

  log.info({ count: overdue.length }, 'Doses marked missed');

  for (const dose of overdue) {
    // Never alert twice for the same dose, even across restarts.
    if (dose.missAlertedAt) continue;
    await escalateMissedDose(String(dose._id));
  }
}

async function escalateMissedDose(doseId: string): Promise<void> {
  const dose = await DoseEvent.findById(doseId).lean();
  if (!dose || dose.missAlertedAt) return;

  const patientId = String(dose.userId);

  // Remind the patient first — a missed dose is theirs to fix before anyone
  // else is told about it.
  await pushToUser(patientId, {
    title: 'Missed dose',
    body: `You have not logged ${dose.medicineName}. Tap to record it.`,
    priority: dose.isCritical ? 'high' : 'default',
    data: { type: 'dose_missed', doseId: String(dose._id) },
  });

  if (dose.isCritical) {
    await raiseAlert({
      patientId,
      kind: 'critical_dose_missed',
      severity: 'critical',
      title: 'Critical dose missed',
      body: `${dose.medicineName} was not taken.`,
      medicineId: String(dose.medicineId),
      doseEventId: String(dose._id),
      emailContext: { medicineName: dose.medicineName },
    });
  } else {
    const streak = await countConsecutiveMisses(patientId, String(dose.medicineId));
    if (streak >= CONSECUTIVE_MISS_THRESHOLD) {
      await raiseAlert({
        patientId,
        kind: 'consecutive_misses',
        severity: 'warning',
        title: 'Repeated missed doses',
        body: `${dose.medicineName} has been missed ${streak} times in a row.`,
        medicineId: String(dose.medicineId),
        doseEventId: String(dose._id),
        emailContext: { medicineName: dose.medicineName, missCount: streak },
      });
    }
  }

  await DoseEvent.updateOne({ _id: doseId }, { $set: { missAlertedAt: new Date() } });
}

/**
 * Count the current run of missed doses for one medicine.
 *
 * Only resolved doses are considered, walking backwards from the most recent —
 * an unresolved future dose must not break the run, and a taken dose must.
 */
async function countConsecutiveMisses(userId: string, medicineId: string): Promise<number> {
  const recent = await DoseEvent.find({
    userId,
    medicineId,
    status: { $in: ['taken', 'missed', 'skipped'] },
  })
    .sort({ scheduledAt: -1 })
    .limit(MISS_LOOKBACK)
    .select({ status: 1 })
    .lean();

  let run = 0;
  for (const dose of recent) {
    if (dose.status === 'missed') run++;
    else break;
  }
  return run;
}

/* ──────────────────────────── Low stock ─────────────────────────────────── */

/** Warn once per medicine when the supply drops to the threshold. */
export async function checkLowStock(): Promise<void> {
  const medicines = await Medicine.find({
    archivedAt: null,
    stock: { $ne: null },
    lowStockNotifiedAt: null,
  }).lean();

  for (const doc of medicines) {
    const medicine = toDomainMedicine(doc as unknown as MedicineSource);
    if (!isLowStock(medicine)) continue;

    const remaining = dosesRemainingInStock(medicine) ?? 0;
    const patientId = String(doc.userId);

    await pushToUser(patientId, {
      title: 'Running low',
      body: `About ${remaining} doses of ${medicine.name} left.`,
      data: { type: 'low_stock', medicineId: medicine.id },
    });

    await raiseAlert({
      patientId,
      kind: 'low_stock',
      severity: 'info',
      title: 'Running low on a medicine',
      body: `About ${remaining} doses of ${medicine.name} remain.`,
      medicineId: medicine.id,
      emailContext: { medicineName: medicine.name, dosesRemaining: remaining },
    });

    // Latch, so the warning does not repeat every sweep until they refill.
    await Medicine.updateOne({ _id: doc._id }, { $set: { lowStockNotifiedAt: new Date() } });
  }
}

/* ────────────────────────── Appointment reminders ───────────────────────── */

/**
 * Fire appointment reminders at each configured offset.
 *
 * Offsets already sent are recorded on the appointment, so a restart or an
 * overlapping run cannot double-notify.
 */
export async function sendAppointmentReminders(now: Date = new Date()): Promise<void> {
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const upcoming = await Appointment.find({
    status: 'scheduled',
    scheduledAt: { $gte: now, $lte: horizon },
  }).lean();

  for (const appointment of upcoming) {
    const minutesUntil = (appointment.scheduledAt.getTime() - now.getTime()) / 60_000;

    for (const offset of appointment.reminderOffsetsMinutes) {
      if (appointment.remindersSentMinutes.includes(offset)) continue;
      // Fire once the offset has been reached, within a tick's width.
      if (minutesUntil > offset) continue;

      await pushToUser(String(appointment.userId), {
        title: appointment.kind === 'lab_test' ? 'Upcoming test' : 'Upcoming appointment',
        body: buildAppointmentReminder(appointment.title, minutesUntil, appointment.requiresFasting),
        data: { type: 'appointment', appointmentId: String(appointment._id) },
      });

      await Appointment.updateOne(
        { _id: appointment._id },
        { $addToSet: { remindersSentMinutes: offset } },
      );
    }
  }
}

function buildAppointmentReminder(title: string, minutesUntil: number, fasting: boolean): string {
  const when = minutesUntil >= 720
    ? 'tomorrow'
    : minutesUntil >= 90
      ? `in about ${Math.round(minutesUntil / 60)} hours`
      : `in ${Math.max(1, Math.round(minutesUntil))} minutes`;
  return `${title} is ${when}.${fasting ? ' Remember not to eat beforehand.' : ''}`;
}

/** Mark appointments that are comfortably past as missed. */
export async function closeOutPastAppointments(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const result = await Appointment.updateMany(
    { status: 'scheduled', scheduledAt: { $lt: cutoff } },
    { $set: { status: 'missed' }, $inc: { rev: 1 } },
  );
  if (result.modifiedCount > 0) {
    log.info({ count: result.modifiedCount }, 'Past appointments closed out');
  }
}

/* ───────────────────────────── Registration ─────────────────────────────── */

/**
 * Start all jobs.
 *
 * Cron expressions run in UTC deliberately. Per-user work resolves the user's
 * own timezone from their record, so the schedule of the *sweep* is unrelated
 * to the schedule of any *patient* — conflating the two is what made v3
 * generate doses at 05:30 IST.
 */
export function startScheduler(): void {
  if (!env.SCHEDULER_ENABLED) {
    log.warn('Scheduler disabled by configuration');
    return;
  }

  // Catch up immediately on boot, in case the process was down over a boundary.
  void guarded('materialise', materialiseDoses);
  void guarded('detect-missed', () => detectMissedDoses());

  tasks.push(
    cron.schedule('*/5 * * * *', () => void guarded('detect-missed', () => detectMissedDoses())),
    cron.schedule('*/15 * * * *', () => void guarded('appointments', () => sendAppointmentReminders())),
    cron.schedule('0 * * * *', () => void guarded('materialise', materialiseDoses)),
    cron.schedule('30 * * * *', () => void guarded('low-stock', checkLowStock)),
    cron.schedule('0 2 * * *', () => void guarded('close-appointments', () => closeOutPastAppointments())),
    // Erasure is a promise made in the Privacy Policy, so it runs on a job
    // rather than depending on anyone remembering to trigger it.
    cron.schedule('30 3 * * *', () => void guarded('purge-accounts', runPurge)),
  );

  log.info({ jobs: tasks.length }, 'Scheduler started');
}

/** Stop all jobs — used on shutdown and between tests. */
export async function stopScheduler(): Promise<void> {
  await Promise.all(tasks.map((task) => task.destroy()));
  tasks.length = 0;
  running.clear();
}

/** Extend one user's agenda immediately, e.g. right after they add a medicine. */
export async function materialiseForUser(userId: string): Promise<number> {
  const user = await User.findById(userId).select({ timezone: 1 }).lean();
  if (!user) return 0;
  return generateDosesForUser(userId, user.timezone, MATERIALISE_AHEAD_DAYS);
}

/** Permanently erase accounts whose deletion grace period has elapsed. */
async function runPurge(): Promise<void> {
  const purged = await purgeDeletedAccounts();
  if (purged > 0) log.info({ count: purged }, 'Accounts purged after grace period');
}

/** Exposed for tests and for a manual admin trigger. */
export const jobs = {
  materialiseDoses,
  detectMissedDoses,
  checkLowStock,
  sendAppointmentReminders,
  closeOutPastAppointments,
  purgeDeletedAccounts: runPurge,
};

/** Convenience for computing a user's agenda window. */
export function agendaWindow(timezone: string): { from: string; to: string } {
  const from = todayIn(timezone);
  return { from, to: addDays(from, MATERIALISE_AHEAD_DAYS) };
}
