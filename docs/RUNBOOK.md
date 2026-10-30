# MedTrack — operations runbook

How MedTrack runs in production, how to ship changes, and what to do when
something breaks. Secrets are **never** written here. Each one lives only in
the service that uses it.

Last verified: 30 October 2026.

---

## 1. Services and accounts

| Service | What runs there | Where to manage it |
|---|---|---|
| **GitHub** `arpittiwari214/medtrack-v3` | All code. Pushing to `main` deploys the API and the website. | github.com |
| **Render** `medtrack-backend` (free) | API at `https://medtrack-backend-jtg7.onrender.com/api` | dashboard.render.com |
| **Vercel** | Website at `https://medtrack-v3.vercel.app` | vercel.com |
| **MongoDB Atlas** cluster `medtrack` (M0, AWS Mumbai) | Database | cloud.mongodb.com |
| **Brevo** (free, 300 emails/day) | Sends password-reset, invite and alert emails. Sender `MedTrack <noreplymedtrack1@gmail.com>`, delivered as `…@…brevosend.com`. | app.brevo.com → Settings → SMTP & API |
| **Expo / EAS** `@arpit214s-team/medtrack` | Builds the Android app; hosts over-the-air updates | expo.dev |

## 2. Configuration

### Render (`medtrack-backend` → Environment)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production`. Turns on the production safety checks. |
| `NODE_VERSION` | Node runtime for the build |
| `MONGODB_URI` 🔒 | Atlas connection string |
| `MONGODB_DB_NAME` | Database to use, without editing the URI |
| `JWT_ACCESS_SECRET` 🔒, `JWT_REFRESH_SECRET` 🔒 | Sign-in token keys. At least 32 characters, and must differ. |
| `CORS_ORIGINS` | Websites allowed to call the API: `https://medtrack-v3.vercel.app` |
| `WEB_APP_URL` | Base for links in emails (reset, invite) |
| `API_PUBLIC_URL` | The API's own public address |
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `2525`. Render's free plan blocks 25, 465 and 587. |
| `SMTP_SECURE` | `false`, lowercase. Anything else stops the API from booting. |
| `SMTP_USER` | Brevo SMTP **Login** (`…@smtp-brevo.com`) |
| `SMTP_PASSWORD` 🔒 | Brevo SMTP key (shown once when created) |
| `EMAIL_FROM_ADDRESS` | `noreplymedtrack1@gmail.com` (must be a verified Brevo sender) |

The full list, with defaults, is the schema in `apps/api/src/config/env.ts`.
The API refuses to start on an invalid value and prints which variable is wrong.

### Vercel

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | `https://medtrack-backend-jtg7.onrender.com/api` |

### Android app

`MEDTRACK_API_URL` is set in `apps/mobile/eas.json` for each build profile, and
`webUrl` in `apps/mobile/app.json`.

## 3. Shipping changes

| What changed | How it ships | Time |
|---|---|---|
| API (`apps/api`, `packages/shared`) | Push to `main` → Render auto-deploys | about 2 min |
| Website (`apps/web`) | Push to `main` → Vercel auto-deploys | about 1 min |
| App screens, text, logic (JS only) | `cd apps/mobile && npm run ota -- "what changed"` | Phones get it on the next open, and show it the open after |
| App native parts (icon, permissions, native libraries, Expo upgrade) | See the native release below | about 15 min build, plus the user installs |

### Native app release

1. Raise `version` in `apps/mobile/app.json` (for example 4.0.0 → 4.1.0). This
   starts a new update runtime, so old builds stop receiving incompatible OTA
   updates.
2. `cd apps/mobile && npx eas-cli build --platform android --profile preview`.
3. Check the APK: the name shows **MedTrack**, the build number went up, and
   `apiUrl` is the Render URL.
4. Put the new `versionCode` and download link in
   `apps/web/public/app-version.json`, then push. Every phone on an older build
   shows **"A new version of MedTrack is ready"**.
5. Phones install it with **Update**. Never uninstall first: people using the
   app without an account would lose their data.

### Before every release

- `npm test` (shared + API), plus `npm test` and `npx tsc --noEmit` in
  `apps/mobile` and `apps/web`.
- Run the relevant parts of the [test plan](TEST-PLAN.md).
- Add an entry to [RELEASES.md](RELEASES.md).

## 4. Health checks

| Check | Expected |
|---|---|
| `curl https://medtrack-backend-jtg7.onrender.com/api/health` | `{"status":"ok","database":"connected",…}` (the first call after a quiet spell can take up to a minute) |
| Render → Logs, search `Email transport` | `Email transport ready` after each deploy |
| Render → Events | Latest deploy says **Deploy live** |
| Brevo → Transactional → Logs | Sent and delivered emails, bounces |
| Phone → Settings → *Reminders on this phone* | "Reminders look healthy", and the coverage date about two weeks ahead |

The orange `404 GET /` lines in Render's logs are Render's own probe of `/`.
They're harmless. Setting **Health Check Path** to `/api/health` stops them.

## 5. Known limits

| Limit | Effect | Fix |
|---|---|---|
| **Render free plan sleeps after about 15 min without traffic** | While it sleeps, background jobs don't run: **missed-dose caregiver alerts**, visit reminders, low-stock checks and account purges are delayed until someone opens the app. The first request takes up to a minute. Phone reminders are **not** affected. | Free: a scheduled ping of `/api/health` every 10 minutes from cron-job.org, with failure emails on. That keeps it awake (one service fits Render's 750 free hours a month) and tells you when it is down. UptimeRobot's free plan works too, but only for non-commercial use. Paid: Render Starter (about $7/month). |
| **Atlas M0 has no automatic backups** | A bad delete or corruption can't be undone | Weekly `mongodump --uri "<MONGODB_URI>" --out backup-YYYY-MM-DD` (MongoDB Database Tools), or move to a paid tier before real patients |
| **Brevo free: 300 emails/day, Gmail sender** | Emails come from `…brevosend.com`, and are more likely to land in spam | Own domain plus Brevo domain authentication (in the [roadmap](FUTURE-PLAN.md)) |
| **Expo download links may expire** | The update prompt could point at a dead link | Make a fresh build, or move to the Play Store |
| **One API instance** | The scheduler runs in-process; two instances would double alerts | If you ever scale out, set `SCHEDULER_ENABLED=false` on all but one |

## 6. When something goes wrong

| Symptom | Likely cause | What to do |
|---|---|---|
| App or website "can't reach the server", or very slow first load | Render waking up | Wait a minute and retry. If it keeps happening, set up the uptime monitor (§5). |
| Website works, app doesn't sync | App built without the production API URL | Check `apiUrl` in the APK; for OTA, always publish with `npm run ota` |
| Deploy failed on Render | A typo in an environment variable, or a build error | Render keeps the previous version running. Open the deploy's logs. The API prints `Invalid environment configuration` and the variable's name. |
| No emails arriving | Wrong SMTP setting, revoked Brevo key, or spam folder | Render logs: `Email transport failed verification`? Then check the 6 SMTP variables; check Brevo → Transactional → Logs; check spam. |
| Caregiver can't accept an invite | Signed in with a different email, invite over 14 days old, or already used | They must use the invited address. Otherwise **Withdraw access** and invite again. |
| Reminders late or silent on one phone | Battery saver, exact-alarm permission, or Vivo/iQOO auto-start | Phone → Settings → *Reminders on this phone* → follow the steps shown |
| User locked out after password attempts | Rate limit / lockout (by design) | Wait, or use **Forgot password** |
| Suspected leak of a secret | — | Replace it in Render (JWT secrets: everyone signs in again; Brevo: make a new key, delete the old). For personal data, follow `docs/legal/breach-response.md`. |

## 7. Data and privacy duties

- Users can export their data and delete their account (with a 14-day window to
  cancel). The purge job enforces deletion, so it needs the API awake (§5).
- The database is in India (Mumbai). Check Render's region before filling in
  the Privacy Policy (in the [roadmap](FUTURE-PLAN.md), 14 November).
- Breach handling: [legal/breach-response.md](legal/breach-response.md).
