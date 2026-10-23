# MedTrack v4

Medication adherence platform — API, web app, and native mobile app.

A ground-up rebuild of [medtrack-v3](https://github.com/arpittiwari214/medtrack-v3). The v3 failures
were structural rather than incidental, so the fixes live in the domain model rather than in patches.
See [What changed from v3](#what-changed-from-v3).

---

## Layout

```
packages/shared     Domain core — scheduling engine, dose state machine,
                    adherence maths, validation schemas. Pure TypeScript,
                    no I/O. Used identically by all three clients.

apps/api            Express 5 + MongoDB. REST API, background scheduler,
                    caregiver alerting, offline-sync endpoint.

apps/web            React 19 + Vite. Patient app, caregiver dashboard,
                    marketing site, legal documents.

apps/mobile         Expo / React Native. Offline-first, with locally
                    scheduled notifications that fire with the app closed.
```

The shared package is the reason the three clients cannot disagree about when a dose is due or
whether adherence is 80% or 82%. v3 reimplemented that logic per screen and the screens diverged.

---

## Getting started

```bash
npm install
npm run build:shared
```

### API

```bash
cp apps/api/.env.example apps/api/.env
```

Fill in `MONGODB_URI` and two different 32-character secrets, then:

```bash
npm run dev:api
```

### Web

```bash
npm run dev:web
```

Vite proxies `/api` to `localhost:5000`, so no CORS setup is needed in development.

### Mobile

```bash
npm run dev:mobile
```

On a physical device, `apiUrl` in `apps/mobile/app.json` must point at your machine's LAN address
rather than `localhost` — a phone's `localhost` is the phone.

---

## Tests

```bash
npm test
```

98 tests. The shared suite is pure unit testing; the API suite runs against a real in-memory
MongoDB, because most of what is worth testing there *is* database behaviour — unique indexes,
partial filters, upsert idempotency. A mocked Mongoose would only assert that the code calls the
functions it calls.

The first API run downloads a ~600 MB MongoDB binary, then caches it.

---

## What changed from v3

v3 had a clean structure and no IDOR anywhere, which is better discipline than most projects of its
kind. But several defects made the core feature unreliable, and each is fixed at the model level
with a regression test pinning it.

### Snooze was a black hole

The reminder loop only fired for `pending` doses and the miss detector only queried `pending`, but
snoozing set the status to `snoozed`. So a snoozed dose left the system entirely: no second
reminder, and no caregiver alert if it was never taken. Snoozing also overwrote `scheduledTime`,
which destroyed the prescribed time, could collide with another dose slot on the unique index, and
let the generator recreate the original dose as a duplicate.

Now `snoozed` is explicitly a *deferral*. `scheduledAt` is immutable; `snoozedUntil` carries the new
due time; `missedAt` moves with it so the sweep and the state machine agree.

### Three different clocks

`getToday()` used UTC, `detectMissedDoses` used server-local time, and the browser used device time.
On a UTC host with IST users, a dose due at 08:00 was flagged missed at 14:00 IST — five and a half
hours late — and the nightly generator ran at 05:30 IST, so early-morning doses had no row when due.

Now every wall-clock conversion goes through `packages/shared/src/time.ts`, which takes the IANA zone
as a *required* argument. Doses carry a real UTC instant. The mistake is no longer expressible.

### Duplicate doses

Generation used a `findOne`-then-`create` check that two concurrent requests could both pass. Dose
IDs are now derived: `${medicineId}_${epochSeconds}`. Regenerating a window is an idempotent upsert,
and uniqueness is enforced by the primary key rather than by application code remembering to check.

### Deleting a medicine erased its history

`DELETE /medicines/:id` also deleted every dose log for it, silently rewriting the patient's
adherence record. Medicines are now archived; history is kept.

### The streak read zero every morning

It broke on any unresolved dose, so a patient on a 20-day run saw "0" until their last dose of the
day. A day still in progress is now neutral — it extends the streak once complete and never breaks
it early.

### Security

| | v3 | v4 |
|---|---|---|
| Login rate limiting | none | per-IP **and** per-email, with account lockout |
| CORS | `origin: true` (reflects any caller) | explicit allowlist, wildcard refused in production |
| Error responses | `err.message` on every 500 | structured codes; internals logged, never returned |
| Sessions | 7-day JWT, no revocation | 15-min access + rotating refresh with reuse detection |
| Password floor | 6 characters | 10, with the reasoning stated to the user |
| Headers | none | helmet, HSTS, CSP |
| Input validation | hand-rolled per route | Zod at every boundary |
| Account enumeration | login returned early on unknown email | uniform response and timing |

### Alerting

v3 stored a single `emailSent` boolean, so a caregiver who never received an alert looked identical
to one who did — the worst possible ambiguity in a system whose job is to escalate. Delivery is now
recorded per recipient per channel, including failures, and deduplication is enforced by a unique
index rather than a racy `findOne`.

---

## Notable design decisions

**Reminders are scheduled on the device, not pushed from the server.** Local notifications are
handed to the OS in advance and fire with the app closed, the phone locked, and in airplane mode.
Server push depends on the network at the exact moment a dose is due. For medication, that
difference is the whole product.

**Offline changes beat server inferences.** If the patient marks a dose taken at 08:30 with no
signal and the server marks it missed at 09:00, plain last-write-wins would silently un-take it.
`mergeDoseConflict` encodes the rule that a patient's assertion outranks a server's inference,
regardless of clock, and both sides run the same function so they converge without a round trip.

**Caregiver access is a first-class, revocable link.** v3 embedded `{name, email}` on the user.
Sharing now requires an active `CareLink` with explicit per-capability permissions, checked on every
read. Unauthorised access returns 404 rather than 403, so the endpoints cannot be used to discover
which patient IDs exist.

**Colour is never the only signal.** Every dose status carries a word and a glyph alongside its
colour, because red/green is exactly the pair a meaningful share of people cannot distinguish — and
this app uses it to mean "taken" versus "missed".

---

## Deployment

**Step-by-step guide: [docs/DEPLOY.md](docs/DEPLOY.md)** — database on MongoDB Atlas (Mumbai), API on
Fly.io (Mumbai), website on Vercel, phone app built with Expo EAS.

The API needs a host that stays running. v3 was on a free tier that sleeps after 15 minutes idle, so
its in-process scheduler died with the instance and reminders silently stopped — which is what took
the service down. `apps/api/fly.toml` keeps exactly one machine always on.

Build the API image from the repository root, not from `apps/api` — it depends on the shared
workspace. `.dockerignore` keeps the local database (`.data/`) and secrets out of the image.

In production the API refuses to start on a wildcard CORS origin or on identical access and refresh
secrets. If running more than one instance, set `SCHEDULER_ENABLED=false` on all but one.

---

## Known issues

**`npm audit` reports 10 moderate advisories.** All are inside Expo's CLI and iOS prebuild toolchain
(`@expo/cli` → `@expo/config-plugins` → `xcode` → `uuid`). That code runs only when building and is
never bundled into the app. npm's only offered fix downgrades Expo from SDK 57 to SDK 46, which is
far worse than the issue. Targeted `overrides` did not dislodge it. Accepted deliberately.

Everything else audits clean.

---

## Legal

The four documents under `apps/web/src/pages/legal/` are drafted against India's Digital Personal
Data Protection Act, 2023. They are substantive drafts, not templates — every right they promise
maps to an endpoint that works.

They contain clearly-marked placeholders (`[OPERATOR NAME]`, `[REGISTERED ADDRESS]`,
`[GRIEVANCE OFFICER]`) that must be completed, and **they should be reviewed by a lawyer before
launch**. I am not one.
