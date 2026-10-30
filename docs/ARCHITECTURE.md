# MedTrack — architecture

How the system is built and why. For running it, see the [Runbook](RUNBOOK.md).
For what it does, see the [Product brief](PRODUCT.md).

---

## 1. System overview

```
        ┌──────────────────────┐           ┌──────────────────────┐
        │  Android app (Expo)  │           │   Website (React)    │
        │  offline-first cache │           │  medtrack-v3.vercel  │
        │  local reminders     │           │        .app          │
        └─────────┬────────────┘           └──────────┬───────────┘
                  │  HTTPS /api/sync, /api/*          │  HTTPS /api/*
                  ▼                                   ▼
        ┌─────────────────────────────────────────────────────────┐
        │            API — Express 5 on Render (free)             │
        │  auth · medicines · doses · care links · alerts · sync  │
        │  in-process scheduler (missed doses, visits, purge)     │
        └──────┬──────────────────────┬──────────────────┬────────┘
               │                      │                  │
               ▼                      ▼                  ▼
     MongoDB Atlas (M0,       Brevo SMTP relay      Expo push service
     AWS Mumbai)              (port 2525)           (optional)

     Expo EAS: builds the APK · serves over-the-air updates
```

| Part | Code | Hosted on |
|---|---|---|
| Shared domain core | `packages/shared` | bundled into all three below |
| API | `apps/api` | Render web service `medtrack-backend` |
| Website | `apps/web` | Vercel (auto-deploys from `main`) |
| Android app | `apps/mobile` | Expo EAS builds; installed from an APK link |
| Database | — | MongoDB Atlas M0, AWS Mumbai (`ap-south-1`) |
| Email | `apps/api/src/services/email.ts` | Brevo SMTP relay |

## 2. The shared core

`packages/shared` is pure TypeScript with no I/O. All three clients import it,
so they can't disagree about the medical logic:

| Module | Responsibility |
|---|---|
| `schedule.ts` | Turning a medicine's schedule into dose times; late-log window (24 h); snooze limit (4) |
| `dose-status.ts` | The dose state machine and offline conflict resolution |
| `adherence.ts` | Adherence %, per-medicine and daily series, insights |
| `time.ts` | Every wall-clock conversion, with the IANA time zone as a required argument |
| `validation.ts` | Zod schemas used by both the API and the clients |
| `recognition.ts` | Colour names and plain-language medicine descriptions, in Hindi and English |

## 3. Core domain rules

### Dose lifecycle

```
              take ┌────────┐ undo
        ┌─────────►│ taken  ├──────┐
        │          └────────┘      │
 ┌──────┴────┐ skip ┌─────────┐    ▼
 │ scheduled ├─────►│ skipped ├──► scheduled
 └──┬───┬────┘      └─────────┘
    │   │ snooze  ┌─────────┐
    │   └────────►│ snoozed ├──► taken / skipped / missed
    │             └─────────┘
    │ grace passes (60 min default)
    ▼
 ┌────────┐  take (within 24 h) / skip
 │ missed ├──────────────────────────► taken / skipped
 └────────┘
```

- **Dose IDs are derived** (`<medicineId>_<epochSeconds>`), so generating the
  same window twice is an idempotent upsert, never a duplicate.
- **`scheduledAt` never changes.** A snooze sets `snoozedUntil`, so the
  prescribed time survives for analytics.
- **Medicines are archived, not deleted**, so adherence history is kept.

### Offline sync

- The phone applies every change locally first: it writes to its cache and adds
  a mutation to an **outbox**. The UI never waits on the network.
- `POST /api/sync` pushes outbox batches (with mutation IDs, so a replay is a
  no-op) and pulls changes since a cursor.
- Conflicts are resolved by `mergeDoseConflict`. **Whatever the patient
  asserted (taken, skipped) beats what the server inferred (missed)**, whatever
  the clocks say. Both sides run the same function, so they converge.

### Reminders

- Scheduled **on the phone** with the OS alarm APIs (`modules/medtrack-alarms`
  plus `expo-notifications`), about two weeks ahead, and rescheduled whenever the
  cache changes. They fire with the app closed, offline, and after a reboot.
- Notification actions (**Taken**, **Snooze**) record the dose without opening
  the app.
- The phone measures how late reminders actually arrive, and flags settings
  that delay them (battery optimisation, exact-alarm permission).

### Caregiver access

- A `CareLink` (patient → invited email) with explicit permissions:
  `viewMedicines`, `viewAdherence`, `viewAppointments`, `receiveAlerts`,
  `manageAlerts`.
- States: `pending` → `active` / `declined` / `revoked` / `expired`. Only one
  live link per patient and email (enforced by a partial unique index).
- The invite token is 32 random bytes. **Only its SHA-256 hash is stored**, and
  it expires after 14 days. The preview (`GET /care/invitations/:token`) works
  without signing in, but accepting requires an account **whose email matches
  the invited address**.
- Every caregiver read checks an active link and the specific permission.
  Unauthorised reads return **404, not 403**, so patient IDs can't be probed.

## 4. Backend

### Routes (`/api/...`)

| Area | Endpoints |
|---|---|
| `auth` | signup, login, refresh, logout, logout-all, me (get/patch), change-password, forgot/reset-password |
| `medicines` | list, get, create, update, refill, archive, restore |
| `doses` | today, analytics, list, take, snooze, skip, undo, ad-hoc |
| `appointments` | list, create, update, delete |
| `care` | invitation preview/respond, caregivers (list/invite/update/revoke), patients and their views |
| `alerts` | list, acknowledge, SOS |
| `devices` | register/unregister push tokens |
| `sync` | offline push/pull |
| `account` | export, consents, delete, cancel deletion |
| `health` | `GET /api/health`: status, database, version |

### Background jobs (`services/scheduler.ts`, UTC cron)

| Every | Job |
|---|---|
| 5 min | Detect missed doses → alert caregivers for important ones |
| 15 min | Appointment reminders |
| hour | Generate doses 30 days ahead |
| hour (:30) | Low-stock check |
| daily 02:00 | Close out past appointments |
| daily 03:30 | Purge accounts past their 14-day deletion window |

Every job is idempotent and catches up on boot. **They only run while the API
process is awake**, which matters on Render's free plan (see
[Runbook § Known limits](RUNBOOK.md#known-limits)).

## 5. Security

| Control | Implementation |
|---|---|
| Sessions | 15-minute access JWT plus a rotating refresh token with reuse detection. Sessions are checked against the database on every request, so revocation takes effect at once. |
| Passwords | bcrypt; minimum 10 characters; rate-limited per IP **and** per email, with lockout; same limits on change-password and account deletion |
| Account enumeration | Login and forgot-password give the same response and timing for unknown emails |
| Input | Zod validation at every boundary, including offline sync payloads |
| Transport and headers | HTTPS only; helmet, HSTS, CSP; explicit CORS allowlist (a wildcard is refused in production) |
| Errors | Structured codes to clients; internals only in logs; emails redacted in logs |
| Secrets | Only in host environment variables (Render, Vercel, EAS), never in git |
| Privacy | Itemised consent, research opt-in (off by default), audit log, data export, 14-day cancellable deletion. See `docs/legal/breach-response.md`. |

## 6. Clients

| | Website (`apps/web`) | Android app (`apps/mobile`) |
|---|---|---|
| Stack | React 19, Vite, React Router | Expo SDK 57, React Native 0.86 |
| Data | Live API calls | Offline cache + outbox; syncs every 5 min and on foreground |
| Sign-in storage | `localStorage` | `expo-secure-store` |
| Language | English, Hindi | English, Hindi (including reminders) |
| Updates | Vercel deploys on push to `main` | OTA via EAS Update (channel `preview`); native builds announced by `apps/web/public/app-version.json` |

## 7. Key decisions

| Decision | Why | Trade-off |
|---|---|---|
| Reminders scheduled on the device, not pushed | Must ring with no signal at dose time | Phones must open the app occasionally to extend the two-week window |
| Patient assertion beats server inference | Never "un-take" a dose taken offline | Needs the shared merge function on both sides |
| Sign-up only on the website | Consent and legal text live in one place | The app hands off to the browser |
| Render free + Brevo on port 2525 | Zero cost during the pilot | API sleeps when idle; Render blocks the usual SMTP ports |
| OTA updates tied to app version | Predictable: a JS update never lands on an incompatible native build | Native changes need a version bump and a new APK |
| Sideloaded APK instead of Play Store | Fast iteration during the pilot | Installs show "unknown app" warnings; the update prompt depends on a download link |
