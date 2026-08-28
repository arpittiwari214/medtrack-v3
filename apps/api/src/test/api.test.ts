/**
 * End-to-end API tests.
 *
 * Weighted towards the behaviours that failed in v3 and towards authorisation,
 * which is the highest-risk surface now that caregivers have accounts.
 */

import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { DoseEvent } from '../models/DoseEvent.js';
import { detectMissedDoses } from '../services/scheduler.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

const IST = 'Asia/Kolkata';

/**
 * Fixture start date, relative to today.
 *
 * Hardcoding a literal date made the suite rot: doses materialise forward from
 * today, so a fixed startDate drifts further into the past each day and changes
 * which rows exist.
 */
const TODAY_IST = new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date());

interface Account {
  token: string;
  refreshToken: string;
  userId: string;
  email: string;
}

let accountCounter = 0;

async function signup(overrides: Partial<{ email: string; timezone: string }> = {}): Promise<Account> {
  accountCounter += 1;
  const email = overrides.email ?? `user${accountCounter}@example.com`;

  const response = await request(app).post('/api/auth/signup').send({
    email,
    password: 'a-sufficiently-long-password',
    name: `Test User ${accountCounter}`,
    timezone: overrides.timezone ?? IST,
    acceptedTerms: true,
    acceptedPrivacy: true,
  });

  expect(response.status).toBe(201);
  return {
    token: response.body.accessToken,
    refreshToken: response.body.refreshToken,
    userId: response.body.user.id,
    email,
  };
}

function authed(account: Account) {
  return (req: request.Test) => req.set('Authorization', `Bearer ${account.token}`);
}

async function createMedicine(
  account: Account,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await authed(account)(request(app).post('/api/medicines')).send({
    name: 'Metformin',
    strength: '500 mg',
    form: 'tablet',
    schedule: {
      kind: 'daily',
      times: ['08:00', '21:00'],
      startDate: TODAY_IST,
    },
    ...overrides,
  });
  expect(response.status).toBe(201);
  return response.body.medicine;
}

/* ──────────────────────────────── Auth ─────────────────────────────────── */

describe('authentication', () => {
  it('creates an account and records both mandatory consents', async () => {
    const response = await request(app).post('/api/auth/signup').send({
      email: 'consent@example.com',
      password: 'a-sufficiently-long-password',
      name: 'Consent Tester',
      timezone: IST,
      acceptedTerms: true,
      acceptedPrivacy: true,
    });

    expect(response.status).toBe(201);
    const kinds = response.body.user.consents.map((c: { kind: string }) => c.kind);
    expect(kinds).toContain('terms_of_service');
    expect(kinds).toContain('privacy_policy');
    expect(kinds).toContain('health_data_processing');
    // The hash must never leave the server.
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('refuses signup without explicit consent', async () => {
    const response = await request(app).post('/api/auth/signup').send({
      email: 'noconsent@example.com',
      password: 'a-sufficiently-long-password',
      name: 'No Consent',
      timezone: IST,
      acceptedTerms: false,
      acceptedPrivacy: true,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects a short password', async () => {
    const response = await request(app).post('/api/auth/signup').send({
      email: 'short@example.com',
      password: 'abc123',
      name: 'Short',
      timezone: IST,
      acceptedTerms: true,
      acceptedPrivacy: true,
    });
    expect(response.status).toBe(400);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    await signup({ email: 'known@example.com' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'known@example.com', password: 'not-the-right-password' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'not-the-right-password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    // Identical wording, so the endpoint cannot be used to enumerate accounts.
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });

  it('rejects a request with no token', async () => {
    const response = await request(app).get('/api/medicines');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('invalidates the session on logout', async () => {
    const account = await signup();

    const before = await authed(account)(request(app).get('/api/auth/me'));
    expect(before.status).toBe(200);

    await authed(account)(request(app).post('/api/auth/logout')).expect(204);

    // v3 could not do this: its token stayed valid for seven days after logout.
    const after = await authed(account)(request(app).get('/api/auth/me'));
    expect(after.status).toBe(401);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const account = await signup();

    const first = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: account.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(account.refreshToken);

    // Presenting the original token again means it leaked.
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: account.refreshToken });
    expect(reuse.status).toBe(401);

    // ...and that invalidates the replacement too.
    const afterReuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: first.body.refreshToken });
    expect(afterReuse.status).toBe(401);
  });
});

/* ───────────────────────────── Medicines ───────────────────────────────── */

describe('medicines', () => {
  it('materialises doses at the correct UTC instants for the user timezone', async () => {
    const account = await signup();
    const medicine = await createMedicine(account);

    const doses = await DoseEvent.find({ medicineId: medicine['id'] }).sort({ scheduledAt: 1 }).lean();
    expect(doses.length).toBeGreaterThan(0);

    const first = doses[0];
    // 08:00 IST is 02:30 UTC. v3 stored "08:00" as a string and compared it
    // against a UTC server clock.
    expect(first?.scheduledAt.toISOString().slice(11, 19)).toBe('02:30:00');
    expect(first?.localTime).toBe('08:00');
    expect(first?.timezone).toBe(IST);
  });

  it('rejects a duplicate active medicine at the database level', async () => {
    const account = await signup();
    await createMedicine(account);

    const duplicate = await authed(account)(request(app).post('/api/medicines')).send({
      name: 'Metformin',
      strength: '500 mg',
      schedule: { kind: 'daily', times: ['08:00', '21:00'], startDate: TODAY_IST },
    });
    expect(duplicate.status).toBe(409);
  });

  it('archives rather than deletes, preserving dose history', async () => {
    const account = await signup();
    const medicine = await createMedicine(account);

    const doses = await DoseEvent.find({ medicineId: medicine['id'] }).sort({ scheduledAt: 1 }).lean();
    expect(doses.length).toBeGreaterThan(0);

    // Resolve one dose so there is real history to preserve.
    //
    // Asserting on "some dose survives" alone was date-dependent and quietly
    // wrong: doses are materialised forward from today, so on most days every
    // row is in the future and archiving legitimately removes all of them. The
    // guarantee worth testing is that a dose the patient *acted on* survives.
    const logged = doses[0]!;
    await authed(account)(request(app).post(`/api/doses/${logged._id}/take`)).send({}).expect(200);

    await authed(account)(request(app).delete(`/api/medicines/${medicine['id']}`)).expect(200);

    // v3 deleted every dose log along with the medicine, silently rewriting the
    // patient's adherence history.
    const survivor = await DoseEvent.findById(logged._id).lean();
    expect(survivor).not.toBeNull();
    expect(survivor!.status).toBe('taken');

    // ...while unresolved future doses are cleared, so nothing is still pending
    // for a medicine that is no longer being taken.
    const pending = await DoseEvent.countDocuments({
      medicineId: medicine['id'],
      status: { $in: ['scheduled', 'snoozed'] },
      scheduledAt: { $gt: new Date() },
    });
    expect(pending).toBe(0);
  });

  it('does not let one user read another user’s medicines', async () => {
    const owner = await signup();
    const stranger = await signup();
    const medicine = await createMedicine(owner);

    const response = await authed(stranger)(
      request(app).get(`/api/medicines/${medicine['id']}`),
    );
    expect(response.status).toBe(404);
  });
});

/* ─────────────────────────────── Doses ─────────────────────────────────── */

describe('dose actions', () => {
  async function firstDose(account: Account) {
    const medicine = await createMedicine(account);
    const dose = await DoseEvent.findOne({ medicineId: medicine['id'] }).sort({ scheduledAt: 1 }).lean();
    return { medicine, dose: dose! };
  }

  it('preserves scheduledAt when snoozing, and keeps the dose due', async () => {
    const account = await signup();
    const { dose } = await firstDose(account);
    const originalScheduledAt = dose.scheduledAt.toISOString();

    const response = await authed(account)(
      request(app).post(`/api/doses/${dose._id}/snooze`),
    ).send({ minutes: 15 });

    expect(response.status).toBe(200);
    expect(response.body.dose.status).toBe('snoozed');
    // The v3 bug: snoozing overwrote the prescribed time, which corrupted
    // analytics, could collide with another slot, and let the generator
    // recreate the original dose as a duplicate.
    expect(response.body.dose.scheduledAt).toBe(originalScheduledAt);
    expect(response.body.dose.snoozedUntil).not.toBeNull();

    const stored = await DoseEvent.findById(dose._id).lean();
    // missedAt must follow the snooze, or the sweep would flag it immediately.
    expect(stored!.missedAt.getTime()).toBeGreaterThan(
      new Date(response.body.dose.snoozedUntil).getTime() - 1,
    );
  });

  it('still marks a snoozed dose missed once the new deadline passes', async () => {
    const account = await signup();
    const { dose } = await firstDose(account);

    await authed(account)(request(app).post(`/api/doses/${dose._id}/snooze`))
      .send({ minutes: 5 })
      .expect(200);

    // Fast-forward by moving the deadline into the past.
    await DoseEvent.updateOne({ _id: dose._id }, { $set: { missedAt: new Date(Date.now() - 1000) } });
    await detectMissedDoses();

    const after = await DoseEvent.findById(dose._id).lean();
    // In v3 a snoozed dose left the system entirely: no second reminder, and
    // no caregiver alert if it was never taken.
    expect(after!.status).toBe('missed');
  });

  it('decrements and restores stock as a dose is taken and undone', async () => {
    const account = await signup();
    const medicine = await createMedicine(account, {
      stock: { unitsRemaining: 10, unitsPerDose: 2, lowThreshold: 4 },
    });
    const dose = await DoseEvent.findOne({ medicineId: medicine['id'] }).sort({ scheduledAt: 1 }).lean();

    await authed(account)(request(app).post(`/api/doses/${dose!._id}/take`)).send({}).expect(200);
    let list = await authed(account)(request(app).get('/api/medicines'));
    expect(list.body.medicines[0].stock.unitsRemaining).toBe(8);

    await authed(account)(request(app).post(`/api/doses/${dose!._id}/undo`)).expect(200);
    list = await authed(account)(request(app).get('/api/medicines'));
    // Exactly restored, not double-counted.
    expect(list.body.medicines[0].stock.unitsRemaining).toBe(10);
  });

  it('refuses an illegal transition', async () => {
    const account = await signup();
    const { dose } = await firstDose(account);

    await authed(account)(request(app).post(`/api/doses/${dose._id}/take`)).send({}).expect(200);

    const snoozeTaken = await authed(account)(
      request(app).post(`/api/doses/${dose._id}/snooze`),
    ).send({ minutes: 10 });

    expect(snoozeTaken.status).toBe(409);
    expect(snoozeTaken.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('does not let one user act on another user’s dose', async () => {
    const owner = await signup();
    const stranger = await signup();
    const { dose } = await firstDose(owner);

    const response = await authed(stranger)(
      request(app).post(`/api/doses/${dose._id}/take`),
    ).send({});
    expect(response.status).toBe(404);
  });
});

/* ────────────────────────────── Caregivers ─────────────────────────────── */

describe('care links', () => {
  it('refuses caregiver access without an active link', async () => {
    const patient = await signup();
    const stranger = await signup();

    const response = await authed(stranger)(
      request(app).get(`/api/care/patients/${patient.userId}/overview`),
    );
    // 404, not 403 — a 403 would confirm the patient id exists.
    expect(response.status).toBe(404);
  });

  it('grants access only after the invitation is accepted, and honours permissions', async () => {
    const patient = await signup();
    const caregiver = await signup();

    const invite = await authed(patient)(request(app).post('/api/care/caregivers')).send({
      email: caregiver.email,
      relation: 'Daughter',
      permissions: {
        viewMedicines: true,
        viewAdherence: true,
        viewAppointments: false,
        receiveAlerts: true,
        manageAlerts: false,
      },
    });
    expect(invite.status).toBe(201);

    // Still no access while the invitation is pending.
    const pending = await authed(caregiver)(
      request(app).get(`/api/care/patients/${patient.userId}/overview`),
    );
    expect(pending.status).toBe(404);

    const { CareLink } = await import('../models/CareLink.js');
    const link = await CareLink.findById(invite.body.caregiver.id).select('+inviteTokenHash');
    // Mint a token the same way the email would carry it.
    const { createInviteToken } = await import('../models/CareLink.js');
    const { token, tokenHash } = createInviteToken();
    link!.inviteTokenHash = tokenHash;
    await link!.save();

    await authed(caregiver)(request(app).post('/api/care/invitations/respond'))
      .send({ token, accept: true })
      .expect(200);

    const granted = await authed(caregiver)(
      request(app).get(`/api/care/patients/${patient.userId}/overview`),
    );
    expect(granted.status).toBe(200);
    expect(granted.body.patient.id).toBe(patient.userId);

    // Appointments were not granted, so that view stays closed.
    const appointments = await authed(caregiver)(
      request(app).get(`/api/care/patients/${patient.userId}/appointments`),
    );
    expect(appointments.status).toBe(403);
  });

  it('revokes access immediately when the patient withdraws it', async () => {
    const patient = await signup();
    const caregiver = await signup();

    const invite = await authed(patient)(request(app).post('/api/care/caregivers')).send({
      email: caregiver.email,
      relation: 'Son',
    });

    const { CareLink, createInviteToken } = await import('../models/CareLink.js');
    const link = await CareLink.findById(invite.body.caregiver.id).select('+inviteTokenHash');
    const { token, tokenHash } = createInviteToken();
    link!.inviteTokenHash = tokenHash;
    await link!.save();

    await authed(caregiver)(request(app).post('/api/care/invitations/respond'))
      .send({ token, accept: true })
      .expect(200);

    await authed(patient)(
      request(app).delete(`/api/care/caregivers/${invite.body.caregiver.id}`),
    ).expect(200);

    const afterRevoke = await authed(caregiver)(
      request(app).get(`/api/care/patients/${patient.userId}/overview`),
    );
    expect(afterRevoke.status).toBe(404);
  });

  it('does not let a leaked invite be redeemed by a different address', async () => {
    const patient = await signup();
    const intended = await signup();
    const attacker = await signup();

    const invite = await authed(patient)(request(app).post('/api/care/caregivers')).send({
      email: intended.email,
      relation: 'Doctor',
    });

    const { CareLink, createInviteToken } = await import('../models/CareLink.js');
    const link = await CareLink.findById(invite.body.caregiver.id).select('+inviteTokenHash');
    const { token, tokenHash } = createInviteToken();
    link!.inviteTokenHash = tokenHash;
    await link!.save();

    const response = await authed(attacker)(request(app).post('/api/care/invitations/respond'))
      .send({ token, accept: true });

    expect(response.status).toBe(403);
  });
});

/* ──────────────────────────────── Sync ─────────────────────────────────── */

describe('offline sync', () => {
  it('applies a queued mutation once, however many times it is replayed', async () => {
    const account = await signup();
    const medicine = await createMedicine(account);
    const dose = await DoseEvent.findOne({ medicineId: medicine['id'] }).sort({ scheduledAt: 1 }).lean();

    const mutationId = '11111111-1111-4111-8111-111111111111';
    const body = {
      mutations: [
        {
          mutationId,
          entity: 'dose',
          operation: 'update',
          entityId: String(dose!._id),
          clientUpdatedAt: new Date().toISOString(),
          payload: { status: 'taken', takenAt: new Date().toISOString() },
        },
      ],
    };

    const first = await authed(account)(request(app).post('/api/sync')).send(body);
    expect(first.status).toBe(200);
    expect(first.body.results[0].outcome).toBe('applied');

    // A retried request — flaky network, app killed mid-flight — must not
    // apply the change a second time.
    const replay = await authed(account)(request(app).post('/api/sync')).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.results[0].outcome).toBe('applied');

    const stored = await DoseEvent.findById(dose!._id).lean();
    expect(stored!.status).toBe('taken');
    // rev bumped exactly once, proving the second call was a replay not a write.
    expect(stored!.rev).toBe(2);
  });

  it('keeps a dose taken offline even when the server later marked it missed', async () => {
    const account = await signup();
    const medicine = await createMedicine(account);
    const dose = await DoseEvent.findOne({ medicineId: medicine['id'] }).sort({ scheduledAt: 1 }).lean();

    // Server decides it was missed at 09:00.
    await DoseEvent.updateOne(
      { _id: dose!._id },
      { $set: { status: 'missed', updatedAt: new Date('2026-08-25T09:00:00.000Z') } },
    );

    // Phone syncs later, reporting the patient took it at 08:30.
    const response = await authed(account)(request(app).post('/api/sync')).send({
      mutations: [
        {
          mutationId: '22222222-2222-4222-8222-222222222222',
          entity: 'dose',
          operation: 'update',
          entityId: String(dose!._id),
          clientUpdatedAt: '2026-08-25T08:30:00.000Z',
          payload: { status: 'taken', takenAt: '2026-08-25T08:30:00.000Z' },
        },
      ],
    });

    expect(response.status).toBe(200);
    const stored = await DoseEvent.findById(dose!._id).lean();
    // Plain last-write-wins would have kept "missed" and silently un-taken a
    // dose the patient really took.
    expect(stored!.status).toBe('taken');
  });
});

/* ────────────────────────── Data rights & errors ───────────────────────── */

describe('account data rights', () => {
  it('exports the account’s data without leaking credentials', async () => {
    const account = await signup();
    await createMedicine(account);

    const response = await authed(account)(request(app).get('/api/account/export'));
    expect(response.status).toBe(200);
    expect(response.body.account.email).toBe(account.email);
    expect(response.body.medicines).toHaveLength(1);
    expect(response.body.doseHistory.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('requires the password and an exact confirmation to delete', async () => {
    const account = await signup();

    const wrongConfirmation = await authed(account)(request(app).post('/api/account/delete')).send({
      password: 'a-sufficiently-long-password',
      confirmation: 'delete',
    });
    expect(wrongConfirmation.status).toBe(400);

    const wrongPassword = await authed(account)(request(app).post('/api/account/delete')).send({
      password: 'wrong-password-entirely',
      confirmation: 'DELETE MY ACCOUNT',
    });
    expect(wrongPassword.status).toBe(400);
  });
});

describe('error responses', () => {
  it('returns a structured error and never leaks internals', async () => {
    const response = await request(app).get('/api/nonexistent');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error).not.toHaveProperty('stack');
  });

  it('reports validation problems per field', async () => {
    const account = await signup();
    const response = await authed(account)(request(app).post('/api/medicines')).send({
      name: '',
      strength: '500 mg',
      schedule: { kind: 'daily', times: [], startDate: '2026-08-25' },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.issues.length).toBeGreaterThan(0);
    expect(response.body.error.issues.some((i: { path: string }) => i.path === 'name')).toBe(true);
  });

  it('serves a health check', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
  });
});
