/**
 * Validation schemas, shared by the API and both clients.
 *
 * v3 hand-rolled per-field checks in every route (`if (!name?.trim() ...)`),
 * which meant NoSQL injection was blocked only incidentally — by a stray
 * `.toLowerCase()` throwing on a non-string — rather than by design. Parsing
 * every request through a schema makes the type guarantee explicit, and lets
 * the clients reuse the exact same rules for form validation so the two cannot
 * drift apart.
 */

import { z } from 'zod';
import { MEDICINE_COLORS } from './recognition.js';
import { isValidLocalDate, isValidLocalTime, isValidTimeZone } from './time.js';

/* ──────────────────────────────── Primitives ────────────────────────────── */

export const idSchema = z.string().uuid({ message: 'Must be a UUID.' });

export const localDateSchema = z
  .string()
  .refine(isValidLocalDate, { message: 'Must be a calendar date in YYYY-MM-DD form.' });

export const localTimeSchema = z
  .string()
  .refine(isValidLocalTime, { message: 'Must be a 24-hour time in HH:MM form.' });

export const timeZoneSchema = z
  .string()
  .refine(isValidTimeZone, { message: 'Must be a valid IANA timezone, e.g. Asia/Kolkata.' });

export const instantSchema = z.string().datetime({
  offset: false,
  message: 'Must be an ISO-8601 UTC instant ending in Z.',
});

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Enter a valid email address.' })
  .max(254);

/**
 * Password policy. Length is the property that actually resists guessing, so
 * the floor is 10 rather than v3's 6 — this is health data. A composition rule
 * ("one uppercase, one symbol") is deliberately not imposed; it pushes people
 * towards `Password1!` without adding real entropy. The upper bound exists
 * because bcrypt silently truncates beyond 72 bytes.
 */
export const passwordSchema = z
  .string()
  .min(10, { message: 'Use at least 10 characters — length matters more than symbols.' })
  .max(72, { message: 'Passwords are limited to 72 characters.' });

/* ────────────────────────────────── Auth ────────────────────────────────── */

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'Your name is required.').max(120),
  timezone: timeZoneSchema,
  dateOfBirth: localDateSchema.nullish(),
  /** Both consents are mandatory to create an account under the DPDP Act. */
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service.' }),
  }),
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Privacy Policy.' }),
  }),
  /** Opt-in, defaulting to off. Never pre-ticked in the UI. */
  marketingEmail: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  timezone: timeZoneSchema.optional(),
  dateOfBirth: localDateSchema.nullish(),
  phone: z.string().trim().max(20).nullish(),
});

/* ──────────────────────────────── Medicines ─────────────────────────────── */

export const medicineFormSchema = z.enum([
  'tablet', 'capsule', 'liquid', 'injection',
  'inhaler', 'drops', 'patch', 'cream', 'other',
]);

export const weekdaySchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4),
  z.literal(5), z.literal(6), z.literal(7),
]);

/**
 * A schedule is only meaningful when its kind and its parameters agree, so the
 * cross-field rules live in the schema rather than in each route.
 */
export const doseScheduleSchema = z
  .object({
    kind: z.enum(['daily', 'interval_days', 'days_of_week', 'cyclic', 'as_needed']),
    times: z.array(localTimeSchema).max(12, 'A medicine can have at most 12 doses a day.'),
    startDate: localDateSchema,
    endDate: localDateSchema.nullish(),
    intervalDays: z.number().int().min(1).max(365).nullish(),
    weekdays: z.array(weekdaySchema).min(1).max(7).nullish(),
    cycleOnDays: z.number().int().min(1).max(365).nullish(),
    cycleOffDays: z.number().int().min(0).max(365).nullish(),
  })
  .superRefine((schedule, ctx) => {
    if (schedule.kind !== 'as_needed' && schedule.times.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['times'],
        message: 'Add at least one time of day.',
      });
    }
    if (schedule.kind === 'interval_days' && !schedule.intervalDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['intervalDays'],
        message: 'Say how many days apart the doses are.',
      });
    }
    if (schedule.kind === 'days_of_week' && !schedule.weekdays?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weekdays'],
        message: 'Pick at least one day of the week.',
      });
    }
    if (schedule.kind === 'cyclic') {
      if (!schedule.cycleOnDays) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cycleOnDays'],
          message: 'Say how many days on.',
        });
      }
      if (schedule.cycleOffDays === null || schedule.cycleOffDays === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cycleOffDays'],
          message: 'Say how many days off.',
        });
      }
    }
    if (schedule.endDate && schedule.endDate < schedule.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'The end date cannot be before the start date.',
      });
    }
  });

export const stockSchema = z.object({
  unitsRemaining: z.number().min(0).max(100_000),
  unitsPerDose: z.number().positive().max(100),
  lowThreshold: z.number().min(0).max(100_000),
});

export const createMedicineSchema = z.object({
  /** Client-supplied so an offline device can create without a round-trip. */
  id: idSchema.optional(),
  name: z.string().trim().min(1, 'What is the medicine called?').max(200),
  // Optional: it is printed on the strip, and the strip photo captures it. A
  // patient who cannot read it must still be able to add the medicine.
  strength: z.string().trim().max(100).default(''),
  form: medicineFormSchema.default('tablet'),
  schedule: doseScheduleSchema,
  instructions: z.string().trim().max(1000).optional(),
  prescribedBy: z.string().trim().max(200).nullish(),
  isCritical: z.boolean().default(false),
  pillColor: z.enum(MEDICINE_COLORS).nullish(),
  stripColor: z.enum(MEDICINE_COLORS).nullish(),
  purpose: z.string().trim().max(40, 'Keep it short — a word or two.').nullish(),
  stock: stockSchema.nullish(),
  missedAfterMinutes: z.number().int().min(5).max(1440).nullish(),
});

export const updateMedicineSchema = createMedicineSchema.partial().omit({ id: true });

export const refillSchema = z.object({
  /** Units added to the current supply. */
  units: z.number().positive().max(100_000),
});

/* ─────────────────────────────── Dose actions ───────────────────────────── */

export const takeDoseSchema = z.object({
  /** When the dose was actually taken. Lets an offline client report the real time. */
  takenAt: instantSchema.optional(),
});

export const snoozeDoseSchema = z.object({
  minutes: z.number().int().min(1).max(360),
});

export const skipDoseSchema = z.object({
  reason: z.string().trim().max(500).nullish(),
});

export const logAdHocDoseSchema = z.object({
  id: idSchema.optional(),
  medicineId: idSchema,
  takenAt: instantSchema.optional(),
});

export const listDosesSchema = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  medicineId: idSchema.optional(),
  status: z.enum(['scheduled', 'snoozed', 'taken', 'skipped', 'missed']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  cursor: z.string().optional(),
});

/* ─────────────────────────────── Care links ─────────────────────────────── */

export const carePermissionsSchema = z.object({
  viewMedicines: z.boolean().default(true),
  viewAdherence: z.boolean().default(true),
  viewAppointments: z.boolean().default(false),
  receiveAlerts: z.boolean().default(true),
  manageAlerts: z.boolean().default(false),
});

export const inviteCaregiverSchema = z.object({
  email: emailSchema,
  relation: z.string().trim().min(1, 'How are they related to you?').max(100),
  permissions: carePermissionsSchema.default({
    viewMedicines: true,
    viewAdherence: true,
    viewAppointments: false,
    receiveAlerts: true,
    manageAlerts: false,
  }),
});

export const respondToInviteSchema = z.object({
  token: z.string().min(1),
  accept: z.boolean(),
});

export const updateCareLinkSchema = z.object({
  permissions: carePermissionsSchema.partial().optional(),
  relation: z.string().trim().min(1).max(100).optional(),
});

/* ────────────────────────────── Appointments ────────────────────────────── */

export const createAppointmentSchema = z.object({
  id: idSchema.optional(),
  kind: z.enum(['doctor', 'lab_test', 'procedure', 'vaccination', 'other']),
  title: z.string().trim().min(1, 'Give the appointment a title.').max(200),
  /** Wall clock in the user's timezone; the API converts to a UTC instant. */
  localDate: localDateSchema,
  localTime: localTimeSchema,
  durationMinutes: z.number().int().min(5).max(1440).default(30),
  provider: z.string().trim().max(200).nullish(),
  location: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  reminderOffsetsMinutes: z
    .array(z.number().int().min(0).max(20_160))
    .max(5, 'At most five reminders per appointment.')
    .default([1440, 60]),
  requiresFasting: z.boolean().default(false),
});

export const updateAppointmentSchema = createAppointmentSchema.partial().omit({ id: true }).extend({
  status: z.enum(['scheduled', 'completed', 'cancelled', 'missed']).optional(),
});

/* ──────────────────────────────── Devices ───────────────────────────────── */

export const registerDeviceSchema = z.object({
  id: idSchema.optional(),
  platform: z.enum(['ios', 'android', 'web']),
  pushToken: z.string().min(1).max(500),
  timezone: timeZoneSchema,
  appVersion: z.string().max(50).nullish(),
});

/* ───────────────────────────────── Alerts ───────────────────────────────── */

export const listAlertsSchema = z.object({
  patientId: idSchema.optional(),
  acknowledged: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const sosSchema = z.object({
  /** Optional free-text the patient adds when triggering SOS. */
  message: z.string().trim().max(500).nullish(),
  /** Coarse location, only if the patient explicitly shares it. */
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .nullish(),
});

/* ─────────────────────────────── Offline sync ───────────────────────────── */

export const syncMutationSchema = z.object({
  /** Client-generated, so a retried request is applied at most once. */
  mutationId: idSchema,
  entity: z.enum(['medicine', 'dose', 'appointment']),
  operation: z.enum(['create', 'update', 'delete']),
  entityId: z.string().min(1),
  /** Instant the change was made on the device, used for conflict resolution. */
  clientUpdatedAt: instantSchema,
  payload: z.record(z.unknown()),
});

export const syncRequestSchema = z.object({
  /** Cursor from the previous sync; omit for a full pull. */
  since: instantSchema.optional(),
  mutations: z.array(syncMutationSchema).max(500, 'Too many queued changes — sync in batches.'),
  timezone: timeZoneSchema.optional(),
});

/* ─────────────────────────── Account & data rights ──────────────────────── */

/**
 * DPDP Act gives a Data Principal the right to erasure. Deletion is destructive
 * and irreversible, so it demands the password and an explicit typed
 * confirmation rather than a single tap.
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Confirm your password to delete your account.'),
  confirmation: z.literal('DELETE MY ACCOUNT', {
    errorMap: () => ({ message: 'Type DELETE MY ACCOUNT exactly to confirm.' }),
  }),
  reason: z.string().trim().max(1000).nullish(),
});

export const updateConsentSchema = z.object({
  kind: z.enum([
    'terms_of_service',
    'privacy_policy',
    'health_data_processing',
    'caregiver_sharing',
    'marketing_email',
  ]),
  granted: z.boolean(),
  documentVersion: z.string().min(1).max(20),
});

/* ──────────────────────────── Inferred types ────────────────────────────── */

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>;
export type DoseScheduleInput = z.infer<typeof doseScheduleSchema>;
export type SnoozeDoseInput = z.infer<typeof snoozeDoseSchema>;
export type InviteCaregiverInput = z.infer<typeof inviteCaregiverSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type SyncRequestInput = z.infer<typeof syncRequestSchema>;
export type SyncMutationInput = z.infer<typeof syncMutationSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type SosInput = z.infer<typeof sosSchema>;
