# MedTrack — product brief

| | |
|---|---|
| **Owner** | Arpit Tiwari |
| **Status** | Private pilot (2 phones, 2 accounts) · as of 30 October 2026 |
| **Platforms** | Android app (sideloaded APK), website, shared backend |
| **Related** | [Architecture](ARCHITECTURE.md) · [Runbook](RUNBOOK.md) · [Roadmap](FUTURE-PLAN.md) |

---

## 1. Problem

Patients in India on long-term medicines miss doses, run out of stock, and drift
away from follow-up visits. The people who care for them, often an adult child
in another city, find out only when something has already gone wrong.

General reminder apps don't fit this group well:
- Many patients read little English, or none.
- They often know a medicine by its **colour and strip**, not its name.
- They use budget Android phones (Vivo, Xiaomi, OPPO) whose battery savers
  silently kill reminders.
- Signal is patchy, so an app that needs the internet at dose time fails.

## 2. Users

| User | Needs |
|---|---|
| **Patient** (often 50+, may have low literacy) | Be reminded on time, recognise the right medicine, record it in one tap, in Hindi or English. |
| **Caregiver** (family member, friend) | Know when an important dose is missed, see whether medicines are being taken, without nagging. |
| **Family manager** (one phone, several people) | Track medicines for a parent and themselves on one device. |

## 3. What MedTrack does today

### Phone app (Android)
- **Reminders that fire with no internet**, scheduled on the phone up to two
  weeks ahead. They survive the app being closed and the phone restarting.
- **Recognise a medicine by sight:** pill colour, strip colour, a photo of the
  strip, and a recorded voice label. Doses can be read aloud.
- **One-tap actions:** Mark as taken, Snooze (5–30 min, up to 4 times), Skip
  (asks first). A late dose can still be logged up to 24 hours after it was due.
- **Works without an account.** Data stays on the phone, and you can sign in
  later to back it up.
- **Reminder health check:** detects the phone settings that delay reminders,
  with step-by-step help for Vivo/iQOO.
- **Hindi and English**, including the reminders themselves.
- **Supply and visits:** warns before a medicine runs out, and reminds about the
  next check-up.
- **Updates itself:** small fixes arrive over the air; bigger ones announce
  themselves (from build 4).

### Website
- Everything the app does, plus account sign-up, caregiver management, the
  caregiver dashboard, adding appointments, the legal pages, data export and
  account deletion.
- **SOS** button that alerts caregivers.

### Caregivers
- The patient invites by email and chooses exactly what the caregiver may see:
  medicines, adherence, appointments, alerts.
- Access can be withdrawn at any time, and takes effect immediately.
- The caregiver is emailed when an **important** dose is missed.

## 4. Principles

1. **The reminder must ring.** It is scheduled on the device, and never depends
   on the network at dose time.
2. **Recognition over reading.** Colour, shape, photo and voice come before the
   medicine's name.
3. **The patient's word wins.** A dose they mark offline is never overwritten by
   the server's guess.
4. **Colour is never the only signal.** Every status also has a word and a glyph.
5. **No medical advice.** MedTrack is a reminder tool, not a medical device.
6. **Consent is explicit and revocable**, as India's DPDP Act requires.

## 5. Out of scope (for now)

- Prescribing, dosing advice, drug-interaction checks.
- iOS app (the code supports it; not built or tested).
- Pharmacy ordering or refills.
- ABHA / ABDM health-record integration (researched, not started).

## 6. Success measures (for the pilot)

| Measure | How we read it |
|---|---|
| Reminders arrive on time | Settings → *Reminders on this phone* → measured delay |
| Doses get recorded | Insights → adherence %, and how often doses are skipped vs missed |
| Caregiver alerts reach people | Alert delivery records (per recipient, per channel) |
| People keep using it | Active days per week per patient |

## 7. Current status and next steps

- **Live:** website, backend, email (via Brevo), caregiver invitations.
- **App build 4:** being installed on both pilot phones.
- **Before real patients:** complete the legal details (due on or after
  14 November 2026), keep the backend awake for caregiver alerts (see
  [Runbook § Known limits](RUNBOOK.md#known-limits)), and back up the database.
- Full list: [FUTURE-PLAN.md](FUTURE-PLAN.md).
