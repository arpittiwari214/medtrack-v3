# MedTrack — release notes

Newest first. Website and API changes go live when pushed to `main`. App
changes reach phones with the build listed (or over the air, from build 4
onwards). How to ship: [Runbook § Shipping changes](RUNBOOK.md#3-shipping-changes).

---

## App build 4 · 30 October 2026

**Install:** one more manual download. Tap **Update**, never uninstall. From
this build on, phones update themselves.

### New
- **Silent updates.** Fixes to screens, text and logic download on their own
  the next time MedTrack opens (EAS Update, channel `preview`).
- **"A new version of MedTrack is ready"** prompt for bigger updates that need
  a download.
- **Settings → Account → Caregivers** opens the caregivers page on the
  website.

### Fixed
- **Skip** now asks *"Skip this dose?"* with the medicine and time. One stray
  tap used to record a skip with no visible change.
- **Skipped doses** show as a lighter grey on the Today bar. In dark mode they
  looked the same as "not yet".
- **Insights:** a day where every dose was missed shows a **red** bar, instead
  of the grey tick that means "nothing due".

## Website and API · 30 October 2026 (evening)

- **Email is live** through Brevo: password-reset and caregiver-invite emails
  arrive.
- **Caregiver invitations:**
  - The invitation page now opens without signing in. It used to say
    "Sign in to continue" and "may have expired" for a fresh invite.
  - After creating an account or signing in from an invitation, you come back
    to **Accept invitation**, instead of landing on an empty dashboard.
- **Skip** on the website asks first, and the skipped dose stays on the day bar
  while it saves.
- **Insights:** red bar for a day with every dose missed.

## App build 3 · 30 October 2026

### Fixed
- Headings no longer sit under the clock and battery icons; the tab bar no
  longer sits under the phone's navigation buttons (Android edge-to-edge).
- **Today:** the counter shows doses **taken**. Missed doses used to count, so
  4 missed out of 5 read as "4/5".
- **Medicines:** each colour is named ("White · Silver strip"). A bare red dot
  read as "missed".
- **Insights:** medicines with nothing counted show "—" instead of 0%; skipped
  doses are listed.
- **Settings:** shows "India (IST)" instead of a raw time zone, the last-synced
  time in your language, and working links to the disclaimer and privacy pages.
- **Visits:** the empty screen links to the website, where visits are added.

### New
- **Sign-in screen:** **Forgot password?** and **Create a new account** (both
  open the website).

## App build 2 · 30 October 2026

- MedTrack's own logo: a capsule split by a check, including the themed
  (monochrome) icon and the notification icon.

## App build 1 · 30 October 2026

- First installable APK, pointing at the live Render API.
- Builds on Expo's servers with a single copy of React.

## Website and API · 29–30 October 2026

- Rebuilt MedTrack (v4) replaces v3 in the repository, keeping v3's history.
- **Security:** password attempts are limited on change-password and account
  deletion too; Show/Hide on every password box.
- `MONGODB_DB_NAME` selects the database without editing the connection string.
- Fixed links inside translated sentences showing "{link}".

## Earlier · 22–23 October 2026

- Hindi throughout the website and the app, including reminders.
- Use the app **without an account**, and sign in later to back up.
- **"Who takes it?"**: one phone, several people.
- Itemised consent, research opt-in, privacy log, and a working cancel for
  account deletion.
- Adults-only accounts, and "who are these medicines for?" at sign-up.
- Add a medicine by **photographing the strip**; voice labels; read-aloud.
- Recognise medicines by colour and purpose; supply and visits on Today.
- Reminders survive offline use, snoozes and the app being killed; the app
  detects settings that silently delay reminders.
- Sync no longer drops doses the server hasn't generated; offline sync payloads
  are validated like the REST routes.
- Removed dosing advice from Insights; medicines list 9× faster; gzip on the API.

## Design · August 2026

- Clinical design language and validated colour palette across the website and
  app; Today reworked around one focal action and a schedule rail.
