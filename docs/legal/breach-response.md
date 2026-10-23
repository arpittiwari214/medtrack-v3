# Personal data breach: what to do

> **Draft — have a lawyer check this before launch.** It follows Rule 7 of the
> Digital Personal Data Protection Rules, 2025 as summarised in the research
> report; confirm against the notified text. Rule 7 applies from the Rules'
> main commencement date (about May 2027), but there is no reason to wait.

A breach is any unauthorised processing, or accidental disclosure, acquisition,
sharing, use, alteration, destruction or loss of access to personal data. In
MedTrack that includes a leaked database dump, a caregiver seeing a patient they
were never linked to, a mis-sent email containing someone's medicines, or a
lost laptop holding a production export.

**There is no size threshold.** One affected person is enough to trigger both
notices below.

## The first hour

1. **Contain.** Revoke the leaked credential, rotate `JWT_*` secrets and the
   MongoDB password, take the affected route offline, or end all sessions
   (`revokeAllForUser`) — whatever stops it continuing.
2. **Write down the time you became aware.** The 72-hour clock runs from here.
3. **Preserve evidence.** Do not delete logs. The privacy log
   (`auditevents` collection) and session records show who signed in and what
   was exported or shared, and when.
4. **Work out who is affected**: which accounts, which data items (use the
   `dataItems` on their consent records as the checklist), and over what
   period.
5. **CERT-In.** Separately from the DPDP Act, CERT-In's 2022 directions expect
   many cyber incidents to be reported to CERT-In within **6 hours**. Ask
   counsel whether this one qualifies.

## Notice 1 — to each affected person, without delay

Send through the account (in-app banner) **and** by email. Plain language, in
the language they use the app in.

> **Subject: Something went wrong with your MedTrack data**
>
> On **[date]**, we found that **[what happened, in one sentence — e.g. "a
> fault let another user see your medicine list for about two hours"]**.
>
> **What was affected:** [the data items — e.g. your name, the names of your
> medicines and when you took them]. [Your password was / was not affected.]
>
> **What this could mean for you:** [likely consequences — e.g. someone may
> have learned which medicines you take].
>
> **What we have done:** [containment and fixes, with dates].
>
> **What you can do:** [concrete steps — e.g. change your password; check your
> caregivers in Settings → Manage caregivers; be wary of calls or messages
> claiming to be from MedTrack].
>
> **Questions:** [name], [role], [email], [phone]. We will reply within
> [N] working days.

## Notice 2 — to the Data Protection Board

**(a) Without delay**, a first intimation: the description of the breach —
its nature, extent, timing and location — and its likely impact.

**(b) Within 72 hours** of becoming aware (or longer, if the Board agrees on
a written request), a detailed report:

| Section | What to put |
|---|---|
| Facts | The events, circumstances and reasons that led to the breach |
| Mitigation | What has been done, and what is planned, to reduce the risk |
| Cause | Any findings about the person or system that caused it |
| Prevention | Remedial measures so it does not happen again |
| People told | When and how each affected person was notified (attach the Notice 1 text and send log) |

Keep a copy of everything sent, with timestamps, alongside the incident notes.

## Afterwards

- Write a blameless post-mortem within two weeks.
- If the cause was a missing check, add the test that would have caught it.
- Review whether any processor contract was breached.
