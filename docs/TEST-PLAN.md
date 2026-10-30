# MedTrack — test plan

What is tested automatically, what must be checked by hand before each release,
and on which phones.

---

## 1. Automated tests

| Suite | Command | Covers |
|---|---|---|
| Shared core | `npm run test -w @medtrack/shared` | Scheduling, dose state machine, conflict merge, adherence maths, time zones |
| API | `npm run test -w @medtrack/api` | Every route against a real in-memory MongoDB: auth, rate limits, sync, care links (including signed-out invitation preview and leaked-invite refusal), alerts, privacy |
| Mobile | `cd apps/mobile && npm test` | API URL selection, translations (every English key has a Hindi one with the same `{placeholders}`), helpers |
| Website | `cd apps/web && npm test` | Translations, helpers |
| Types | `npx tsc --noEmit` (mobile), `npx tsc -b --noEmit` (web), `npm run typecheck` (root) | Compile-time contracts across all packages |
| Expo health | `cd apps/mobile && npx expo-doctor` | Dependency versions, a single copy of React |

**All suites must pass before pushing to `main`.** The API suite takes about a
minute (the first run downloads a MongoDB binary).

## 2. Release smoke test (by hand)

Run the sections touched by the change. Before a native build, run all of them.
Tick ✅ / ❌ and note the phone.

### A. Install and update
- [ ] New APK installs over the old one with **Update**, and data is kept.
- [ ] Home screen shows **MedTrack** and the capsule-and-check icon (also with
      themed icons on).
- [ ] Older build shows **"A new version of MedTrack is ready"**; **Update now**
      opens the download.
- [ ] After an OTA publish: open the app, close it fully, reopen, and the change
      is visible.

### B. Sign-in and accounts
- [ ] Sign in with email and password; wrong password shows a clear message.
- [ ] **Forgot password?** opens the website; the email arrives within a
      minute; the link sets a new password.
- [ ] **Create a new account** opens the website sign-up; the 18+ and terms
      boxes are required.
- [ ] **Use without an account** works offline; later **Back up** merges the
      local medicines into the account.

### C. Medicines and reminders
- [ ] Add a medicine with photo, pill colour, strip colour and times; it appears
      on Today at once.
- [ ] A reminder rings at the set time with the **phone locked and the app
      closed**.
- [ ] Notification **Taken** records the dose without opening the app.
- [ ] Notification **Snooze** rings again after 10 minutes.
- [ ] Reminders still ring in airplane mode and after a reboot.
- [ ] Settings → *Reminders on this phone* says "healthy", with coverage about
      two weeks ahead.

### D. Today
- [ ] **Mark as taken**: counter goes up (e.g. 1/5), and the bar segment turns
      green.
- [ ] **Skip**: asks "Skip this dose?"; Cancel does nothing; Skip moves to the
      next dose, and the segment turns lighter grey.
- [ ] **Snooze**: choose 5–30 minutes; the dose returns when due.
- [ ] Overdue dose shows the warning and can still be marked taken (within
      24 h).
- [ ] **Hear it** reads the medicine aloud (Hindi and English).

### E. Insights, Visits, Settings
- [ ] A day with every dose missed shows a **red** bar; a day with nothing due
      shows a grey tick.
- [ ] Per-medicine rates; "—" for a medicine with nothing counted yet.
- [ ] Visits empty state opens the website; a visit added there appears on the
      phone after sync.
- [ ] Settings: name, email, India (IST), language switch, **Caregivers** row,
      **Sync now**, disclaimer and privacy links.
- [ ] Headings clear the status bar; tabs clear the navigation buttons (test a
      phone with 3-button navigation).

### F. Caregivers (two accounts)
- [ ] Patient invites an email from the website; the email arrives (check
      spam).
- [ ] Signed out, **Review the invitation** shows who invited you and what you
      can see.
- [ ] **Create an account** with the invited email → back on the invitation →
      **Accept** → "You now have access" → **People I care for** lists the
      patient.
- [ ] Patient's Caregivers page shows **ACTIVE**.
- [ ] Signing in with a different email shows "sent to a different email
      address".
- [ ] **Withdraw access**: the caregiver loses access at once.
- [ ] An important dose missed → the caregiver gets an email (needs the API
      awake).

### G. Offline and sync
- [ ] Airplane mode: take, skip and snooze all work; "Waiting to send" counts
      them.
- [ ] Back online: **Sync now** → "Waiting to send: Nothing", and the website
      shows the same doses.
- [ ] A dose marked taken offline stays taken, even if the server had marked it
      missed.

### H. Language and accessibility
- [ ] Switch to हिन्दी: every screen and every reminder is in Hindi.
- [ ] Largest system font size: no clipped buttons.
- [ ] TalkBack reads the counter as words ("1 of 5 taken"), not "1/5".

## 3. Device matrix

Reminders are the product, and Chinese-brand Android battery savers are the
main risk.

| Brand (skin) | Why | Status |
|---|---|---|
| Vivo / iQOO (Funtouch / OriginOS) | Most aggressive auto-start limits | Pilot phone ✅ |
| Xiaomi / Redmi / POCO (HyperOS) | Battery saver kills background alarms | To test |
| OPPO / realme / OnePlus (ColorOS) | "Deep optimisation" | To test |
| Samsung (One UI) | "Sleeping apps" list | To test |
| Stock Android 13+ | Exact-alarm permission flow | To test |

## 4. Recording results

Note failures in [FUTURE-PLAN.md § Bugs and ideas from testing](FUTURE-PLAN.md#bugs-and-ideas-from-testing),
with the phone model, Android version, steps and a screenshot. Fixed items go
into [RELEASES.md](RELEASES.md).
