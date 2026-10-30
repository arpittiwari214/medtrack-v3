# MedTrack — future plan

Everything we agreed to do later, in one place. Written 30 October 2026.
Tick a box when it's done.

---

## 1. Still to finish (started, not done)

Email isn't switched on yet, so "Forgot password" and caregiver invites
don't send anything until these are done.

- [ ] **Brevo account** — sign up free at brevo.com, add yourself as a sender
      (name `MedTrack`, your Gmail), and verify it with the 6-digit code.
- [ ] **Connect Brevo to Render** — make an SMTP key in Brevo and add these
      settings to `medtrack-backend` on Render → Environment:
      `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_SECURE=false`,
      `SMTP_USER` (Brevo's "Login"), `SMTP_PASSWORD` (the SMTP key),
      `EMAIL_FROM_ADDRESS` (your Gmail).
      Port 2525 because Render's free plan blocks the usual email ports.
- [ ] **Test** — try "Forgot password", and re-send the caregiver invite.
- [ ] **Delete `.env.render.local`** from the project folder on your computer.
      It holds the backend's secret keys, which are already saved on Render.
- [ ] *(Optional)* Render → medtrack-backend → Settings → Health Check Path:
      `/api/health`.

---

## 2. Next app build — the last one you send as a link

This build needs one more manual download on every phone. After it, updates
reach phones on their own.

- [x] Skip asks "Skip this dose?" first, and skipped doses show lighter grey
      on the Today bar. *(Already in the code, waiting for this build.)*
- [x] Settings → Account has a **Caregivers** row that opens the caregivers
      page on the website. *(Already in the code, waiting for this build.)*
- [ ] **Silent updates** (Expo "EAS Update"). Fixes to screens, text and layout
      download by themselves the next time the app opens. No link, no Install
      button.
- [ ] **"Update available" pop-up**, for the occasional bigger change that
      needs a new download (new icon, new phone permission, a big upgrade).
      The app checks a small file on the website for the newest version and
      offers an **Update now** button.

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
- [ ] **Google Play Store.** Updates become fully automatic and people trust
      the app more. One-time $25 developer fee. Google asks new personal
      accounts to test the app with a small group (currently 12 people) for
      14 days before it can go public.

---

## Known small issues (not fixed yet)

- **Insights chart:** a day where every dose was missed (0%) looks the same as
  a day with no medicines.
