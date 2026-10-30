# MedTrack — future plan

Everything we agreed to do later, in one place. Written 30 October 2026.
Tick a box when it's done.

---

## 1. Still to finish (started, not done)

Email works since 30 October 2026: password resets and caregiver invites
both arrive.

- [x] **Brevo account** — sign up free at brevo.com, add yourself as a sender
      (name `MedTrack`, your Gmail), and verify it with the 6-digit code.
- [x] **Connect Brevo to Render** — make an SMTP key in Brevo and add these
      settings to `medtrack-backend` on Render → Environment:
      `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_SECURE=false`,
      `SMTP_USER` (Brevo's "Login"), `SMTP_PASSWORD` (the SMTP key),
      `EMAIL_FROM_ADDRESS` (your Gmail).
      Port 2525 because Render's free plan blocks the usual email ports.
- [x] **Test** — "Forgot password" and the caregiver invite both arrived, and
      the invite was accepted.
- [ ] *(Optional)* **Delete `.env.render.local`** from the project folder. Not
      required: it never left this computer, and Render holds the same values.
- [ ] **Keep the backend awake** (free, 5 minutes): sign up at cron-job.org
      and add a job that opens
      `https://medtrack-backend-jtg7.onrender.com/api/health` every 10 minutes,
      with failure emails on. (UptimeRobot also works, but its free plan is for
      non-commercial use only.)
      Without it, Render's free plan sleeps after 15 quiet minutes and
      **caregiver alerts for missed doses wait** until someone opens the app.
      The failure emails also tell you if the backend goes down.
- [ ] *(Optional)* Render → medtrack-backend → Settings → Health Check Path:
      `/api/health`.

---

## 2. App build 4 — the last one you send as a link

Built 30 October 2026. Needs one more manual download on every phone (tap
**Update**, never uninstall). After it, updates reach phones on their own.

- [x] Skip asks "Skip this dose?" first, and skipped doses show lighter grey
      on the Today bar. *(Already in the code, waiting for this build.)*
- [x] Settings → Account has a **Caregivers** row that opens the caregivers
      page on the website. *(Already in the code, waiting for this build.)*
- [x] **Silent updates** (Expo "EAS Update"). Fixes to screens, text and layout
      download by themselves the next time the app opens. No link, no Install
      button.
- [x] **"Update available" pop-up**, for the occasional bigger change that
      needs a new download (new icon, new phone permission, a big upgrade).
      The app checks a small file on the website for the newest version and
      offers an **Update now** button.
- [x] Insights: a day where every dose was missed shows a **red** bar, so it
      no longer looks like a day with no medicines.
- [ ] Installed on both phones.

### How updates work from now on

- **Small fixes** (screens, text, layout): Claude runs
  `npm run ota -- "what changed"` in `apps/mobile`. Phones download it the
  next time MedTrack opens, and show it the time after.
- **Bigger changes** (new icon, new permission, new native library, Expo
  upgrade): raise `version` in `apps/mobile/app.json`, make a new build, then
  put its version code and download link in `apps/web/public/app-version.json`.
  Every phone on an older build shows "A new version of MedTrack is ready".
- Expo's download links may stop working after a while. If the pop-up's link
  ever fails, make a fresh build, or move to the Play Store (part 4).

---

## 3. On or after 14 November 2026

### Legal pages (Terms of Service, Privacy Policy)

They still have blanks and a yellow "Before you publish this" box. Real
contact details are required by law before real patients sign up.

- [ ] Operator — the person or company running MedTrack
- [ ] Address for legal notices (shown publicly)
- [ ] Support email (`support@medtrack.in` once you have a domain)
- [ ] City, for which courts handle disputes
- [ ] Grievance officer — name and email (can be you)
- [ ] Render region (Render → medtrack-backend → Settings → Region)
- [ ] Then: remove the yellow box, and have a lawyer read both pages.

### Your own domain (for example medtrack.in)

About ₹500–1,000 a year. Nothing else here costs money.

- [ ] **Buy the domain.**
- [ ] **Website at medtrack.in** — connect it to Vercel (free). The old
      medtrack-v3.vercel.app link keeps working.
- [ ] **Emails from `no-reply@medtrack.in`** instead of brevosend.com — in
      Brevo, *Add domain*, paste the lines it gives you into the domain's
      settings. Works on Render's free plan.
- [ ] **`support@medtrack.in` inbox** — free forwarding, so emails sent there
      arrive in your Gmail. (A domain doesn't come with an inbox by itself.)
- [ ] **Settings Claude will change** once the domain works:
      Render `WEB_APP_URL`, `CORS_ORIGINS` (add the new address, keep the old),
      `EMAIL_FROM_ADDRESS`; and the app's website link (arrives by silent
      update).

---

## 4. Later, when there are real users

- [ ] **Paid Render** (about $7 a month). Stops the backend "sleeping": today,
      the first time anyone opens the app after a quiet spell, it can take up
      to a minute to wake. Not needed for email — Brevo works on the free plan.
- [ ] **Invitations waiting on "People I care for".** Today a caregiver must
      open the email link and tap Accept; if they lose the email, nothing in
      their account shows the invitation. List waiting invitations there, with
      an Accept button.
- [ ] **Google Play Store.** Updates become fully automatic and people trust
      the app more. One-time $25 developer fee. Google asks new personal
      accounts to test the app with a small group (currently 12 people) for
      14 days before it can go public.

---

## 5. After the real launch — doctors, hospitals and marketing

Start once MedTrack is live for real patients: legal pages done, own domain,
backend kept awake and backed up, on the Play Store. Claude reminds you on
14 December 2026 to check whether you're there.

### Be ready to sell to clinics
- [ ] **Register a business** (company or LLP) and GST. Hospitals sign
      contracts with entities, not apps.
- [ ] **Contracts:** a service agreement and a **data processing agreement**.
      Under the DPDP Act, decide who is the data fiduciary for patient data when
      a hospital uses MedTrack.
- [ ] **Production-grade hosting:** paid Render (or similar), automatic database
      backups, uptime monitoring, and a support email with response times.
- [ ] **Security audit** by an independent tester. Hospitals will ask for one,
      and ABDM requires a CERT-In empanelled audit (below).
- [ ] **Stay a reminder tool.** Before adding anything that advises on doses,
      check whether it would make MedTrack a medical device under CDSCO rules.

### Marketing campaign
- [ ] **Pilot with 1–2 clinics** for 2–3 months, and measure adherence and
      follow-up return rates before and after. Real numbers are the pitch.
- [ ] **Doctor-facing material:** a one-page leaflet, a 2-minute demo video, and
      a patient handout in Hindi and English (with a QR code to install).
- [ ] **Channels:** doctors you know, IMA local chapters, clinic WhatsApp
      groups, chemists near partner clinics, and patient groups for long-term
      conditions (diabetes, BP, TB, transplant).
- [ ] **Pricing:** free for patients; a monthly fee per clinic or doctor for the
      dashboard and integration.

### Integration with hospital systems
- [ ] **Doctor / clinic dashboard:** a new role that sees consenting patients'
      adherence, missed-dose alerts and missed visits, like caregivers today.
- [ ] **Prescription in, reminders out:** the doctor's prescription creates
      the patient's medicines and schedule, so nobody types it twice.
- [ ] **Standard API (HL7 FHIR R4)** for hospital and clinic software
      (MedicationRequest in, adherence out), plus single sign-on for staff.
- [ ] **ABDM / ABHA:** register on the ABDM sandbox, build ABHA sign-in (M1)
      and fetching prescriptions with consent (M3), then pass NHA functional
      testing and a CERT-In security audit to go live. Use the free **National
      Drug Registry** for medicine names. Research so far:
      `research_notes/Indian patient medication app design/abdm_abha.md`.

---

## Bugs and ideas from testing

Add anything you notice here (or tell Claude), and it goes into the next
update.

- *(nothing open right now)*
