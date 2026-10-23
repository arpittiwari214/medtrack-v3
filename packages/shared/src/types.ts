import type { MedicineColor } from './recognition.js';
/**
 * MedTrack domain types.
 *
 * Two rules govern every date in this system, because breaking them is what
 * made v3 unreliable:
 *
 *   1. An *instant* is always UTC. On the wire it is an ISO-8601 string with a
 *      `Z` suffix; in memory it is a `Date`. Fields holding instants end in
 *      `At` (`scheduledAt`, `takenAt`).
 *   2. A *wall-clock* value is meaningless without a timezone, so it is always
 *      stored next to the IANA zone it belongs to. Fields holding wall-clock
 *      values are named explicitly (`localDate`, `localTime`).
 *
 * Never derive one from the other with `new Date().getHours()` or
 * `toISOString().split('T')[0]`. Use the helpers in `./time.ts`, which take the
 * zone as a required argument so the mistake is not expressible.
 */

/** Stable, client-generatable identifier (UUID v7). Lets offline clients create rows without a round-trip. */
export type Id = string;

/** ISO-8601 instant in UTC, e.g. `2026-08-25T02:30:00.000Z`. */
export type InstantISO = string;

/** Wall-clock calendar date in some timezone, `YYYY-MM-DD`. */
export type LocalDate = string;

/** Wall-clock time of day in some timezone, 24h `HH:MM`. */
export type LocalTime = string;

/** IANA timezone identifier, e.g. `Asia/Kolkata`. */
export type TimeZone = string;

/* ────────────────────────────── Users & access ────────────────────────────── */

export type UserRole = 'patient' | 'caregiver';

export interface User {
  id: Id;
  email: string;
  name: string;
  /** A single account can be both a patient and someone else's caregiver. */
  roles: UserRole[];
  timezone: TimeZone;
  dateOfBirth?: LocalDate | null;
  phone?: string | null;
  /** Who the medicines are for, if they said at signup. */
  setupFor?: 'self' | 'family' | null;
  /** When they declared they are 18 or over. */
  adultDeclaredAt?: InstantISO | null;
  /** Set while an erasure request is in its grace period. */
  deletionRequestedAt?: InstantISO | null;
  emailVerifiedAt?: InstantISO | null;
  /** Consent records required under the DPDP Act; see `docs/legal`. */
  consents: ConsentRecord[];
  createdAt: InstantISO;
  updatedAt: InstantISO;
}

export type ConsentKind =
  | 'terms_of_service'
  | 'privacy_policy'
  | 'health_data_processing'
  | 'caregiver_sharing'
  | 'marketing_email'
  | 'research_use';

export interface ConsentRecord {
  kind: ConsentKind;
  /** Version of the document consented to, so re-consent can be demanded on change. */
  documentVersion: string;
  /** The itemised notice it was given against (see CONSENT_SCOPE). Absent on early records. */
  purpose?: string;
  dataItems?: string[];
  /** Language the notice was shown in. */
  language?: string;
  grantedAt: InstantISO;
  withdrawnAt?: InstantISO | null;
}

/** What a caregiver is permitted to see. Enforced server-side on every read. */
export interface CarePermissions {
  viewMedicines: boolean;
  viewAdherence: boolean;
  viewAppointments: boolean;
  receiveAlerts: boolean;
  /** Acknowledge or resolve alerts on the patient's behalf. */
  manageAlerts: boolean;
}

export type CareLinkStatus = 'pending' | 'active' | 'revoked' | 'declined' | 'expired';

/**
 * Explicit, revocable link between a patient and a caregiver.
 * Health data is only ever shared through an `active` link — there is no
 * implicit sharing anywhere in the system.
 */
export interface CareLink {
  id: Id;
  patientId: Id;
  /** Null until the invited person accepts and an account exists. */
  caregiverId: Id | null;
  invitedEmail: string;
  /** Free-text label shown to the patient, e.g. "Daughter", "Dr. Rao". */
  relation: string;
  status: CareLinkStatus;
  permissions: CarePermissions;
  invitedAt: InstantISO;
  respondedAt?: InstantISO | null;
  revokedAt?: InstantISO | null;
  /** Invitations expire so a stale email cannot be redeemed months later. */
  expiresAt: InstantISO;
  createdAt: InstantISO;
  updatedAt: InstantISO;
}

/* ──────────────────────────────── Medicines ──────────────────────────────── */

export type ScheduleKind =
  /** Every day, at each time in `times`. */
  | 'daily'
  /** Every N days from `startDate`, at each time in `times`. */
  | 'interval_days'
  /** Only on the listed weekdays, at each time in `times`. */
  | 'days_of_week'
  /** N days on, M days off, repeating from `startDate`. */
  | 'cyclic'
  /** No schedule; the patient logs doses when they take them. */
  | 'as_needed';

/** ISO-8601 weekday numbering: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DoseSchedule {
  kind: ScheduleKind;
  /** Wall-clock times in the owning user's timezone. Empty for `as_needed`. */
  times: LocalTime[];
  /** Inclusive first day the medicine is active, in the user's timezone. */
  startDate: LocalDate;
  /** Inclusive last day, or null for open-ended. */
  endDate?: LocalDate | null;
  /** For `interval_days`: gap between dosing days. `2` means every other day. */
  intervalDays?: number | null;
  /** For `days_of_week`: which weekdays the medicine is taken. */
  weekdays?: Weekday[] | null;
  /** For `cyclic`: consecutive dosing days, then rest days. */
  cycleOnDays?: number | null;
  cycleOffDays?: number | null;
}

/** Remaining-supply tracking, so a patient is warned before they run out. */
export interface StockInfo {
  /** Units currently on hand. Decremented when a dose is marked taken. */
  unitsRemaining: number;
  /** Units consumed per dose — 2 for "two tablets". */
  unitsPerDose: number;
  /** Warn at or below this many units remaining. */
  lowThreshold: number;
  lastRefillAt?: InstantISO | null;
  lastRefillUnits?: number | null;
}

export type MedicineForm =
  | 'tablet' | 'capsule' | 'liquid' | 'injection'
  | 'inhaler' | 'drops' | 'patch' | 'cream' | 'other';

export interface Medicine {
  id: Id;
  userId: Id;
  name: string;
  /** Free text as prescribed, e.g. "500 mg", "2 puffs". */
  strength: string;
  form: MedicineForm;
  schedule: DoseSchedule;
  /** Timezone the schedule's wall-clock times are interpreted in. */
  timezone: TimeZone;
  instructions?: string;
  prescribedBy?: string | null;
  /** Missing one dose of a critical medicine escalates immediately. */
  isCritical: boolean;
  /**
   * How the patient recognises it. Most Indian patients identify a medicine by
   * colour rather than by name; see recognition.ts.
   */
  pillColor?: MedicineColor | null;
  stripColor?: MedicineColor | null;
  /** The patient's own words for what it is for: "BP", "sugar", "थायराइड". */
  purpose?: string | null;
  /**
   * Who takes it, when one phone looks after several people ("Papa"). Null
   * means the account holder. Shared phones are common: CoWIN let one number
   * enrol five people for the same reason.
   */
  person?: string | null;
  /** Null when the patient is not tracking supply for this medicine. */
  stock?: StockInfo | null;
  /** Grace period before a due dose counts as missed. Overrides the default. */
  missedAfterMinutes?: number | null;
  archivedAt?: InstantISO | null;
  createdAt: InstantISO;
  updatedAt: InstantISO;
  /** Monotonic revision for offline sync conflict resolution. */
  rev: number;
}

/* ─────────────────────────────── Dose events ─────────────────────────────── */

/**
 * Dose lifecycle. Unlike v3, `snoozed` is *not* terminal — a snoozed dose
 * becomes due again once `snoozedUntil` passes, and `scheduledAt` is never
 * mutated, so the prescribed time survives for analytics.
 *
 *   scheduled ──▶ snoozed ──▶ (due again) ──▶ taken | skipped | missed
 *       └────────────────────────────────────▶ taken | skipped | missed
 *   missed ──▶ taken            (logged late, within the late-log window)
 */
export type DoseStatus = 'scheduled' | 'snoozed' | 'taken' | 'skipped' | 'missed';

export interface DoseEvent {
  id: Id;
  userId: Id;
  medicineId: Id;

  /** Authoritative UTC instant the dose is prescribed for. Immutable. */
  scheduledAt: InstantISO;
  /** Wall-clock date/time in `timezone`, denormalised for grouping and display. */
  localDate: LocalDate;
  localTime: LocalTime;
  /** Zone used at generation time, so a later zone change stays auditable. */
  timezone: TimeZone;

  status: DoseStatus;
  /** When the patient actually took it. Null unless status is `taken`. */
  takenAt?: InstantISO | null;
  /** While snoozed, the instant it becomes due again. Never overwrites `scheduledAt`. */
  snoozedUntil?: InstantISO | null;
  /** How many times this dose has been snoozed, to cap runaway snoozing. */
  snoozeCount: number;
  skipReason?: string | null;

  /** Denormalised for offline display and to preserve history if the medicine changes. */
  medicineName: string;
  medicineStrength: string;
  isCritical: boolean;

  /** True when the patient logged an unscheduled `as_needed` dose. */
  isAdHoc: boolean;

  createdAt: InstantISO;
  updatedAt: InstantISO;
  rev: number;
}

/* ───────────────────────── Appointments & lab tests ──────────────────────── */

export type AppointmentKind = 'doctor' | 'lab_test' | 'procedure' | 'vaccination' | 'other';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'missed';

export interface Appointment {
  id: Id;
  userId: Id;
  kind: AppointmentKind;
  title: string;
  /** UTC instant of the appointment — the authoritative time. */
  scheduledAt: InstantISO;
  /** Wall-clock rendering of `scheduledAt` in `timezone`, as the user entered it. */
  localDate: LocalDate;
  localTime: LocalTime;
  timezone: TimeZone;
  /** Expected duration; used to decide when it has certainly passed. */
  durationMinutes: number;
  provider?: string | null;
  location?: string | null;
  notes?: string | null;
  /** Minutes before `scheduledAt` to remind, e.g. `[1440, 60]` for a day and an hour ahead. */
  reminderOffsetsMinutes: number[];
  status: AppointmentStatus;
  /** For lab tests: whether the patient must fast beforehand. */
  requiresFasting: boolean;
  completedAt?: InstantISO | null;
  createdAt: InstantISO;
  updatedAt: InstantISO;
  rev: number;
}

/* ──────────────────────────────── Alerting ───────────────────────────────── */

export type AlertKind =
  | 'dose_missed'
  | 'consecutive_misses'
  | 'critical_dose_missed'
  | 'low_stock'
  | 'appointment_upcoming'
  | 'appointment_missed'
  | 'sos';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: Id;
  /** The patient the alert is about. */
  patientId: Id;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  body: string;
  medicineId?: Id | null;
  appointmentId?: Id | null;
  /** Populated once delivery to caregivers has been attempted. */
  deliveries: AlertDelivery[];
  acknowledgedAt?: InstantISO | null;
  acknowledgedBy?: Id | null;
  createdAt: InstantISO;
  updatedAt: InstantISO;
}

export interface AlertDelivery {
  careLinkId: Id;
  channel: 'email' | 'push';
  /** Recorded even on failure, so a silent non-delivery is visible. */
  status: 'sent' | 'failed' | 'skipped';
  error?: string | null;
  attemptedAt: InstantISO;
}

/* ─────────────────────────────── Devices ─────────────────────────────────── */

export interface Device {
  id: Id;
  userId: Id;
  platform: 'ios' | 'android' | 'web';
  /** Expo push token, or a Web Push endpoint for browsers. */
  pushToken: string;
  timezone: TimeZone;
  appVersion?: string | null;
  lastSeenAt: InstantISO;
  createdAt: InstantISO;
}

/* ───────────────────────── Adherence reporting ───────────────────────────── */

export interface AdherenceSummary {
  /** Percentage 0–100 of resolved doses that were taken. */
  ratePercent: number;
  taken: number;
  missed: number;
  skipped: number;
  /** Doses not yet resolved; excluded from `ratePercent` so the rate never dips at midnight. */
  pending: number;
  /** Consecutive fully-complete days ending today. */
  streakDays: number;
}

export interface MedicineAdherence extends AdherenceSummary {
  medicineId: Id;
  medicineName: string;
}

export interface DailyAdherencePoint {
  localDate: LocalDate;
  taken: number;
  /** Resolved doses that day. Zero means no data, which is not the same as 0%. */
  total: number;
  /** Null when `total` is zero, so charts show a gap rather than a false zero. */
  ratePercent: number | null;
}
