import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout.js';
import { AlertTriangle } from '../../components/icons.js';

/**
 * Privacy Policy, written against India's Digital Personal Data Protection
 * Act, 2023 (DPDP Act) — the regime that applies to a service operated from
 * India for Indian users.
 *
 * Two DPDP-specific things shape this document. First, the Act requires notice
 * to be clear, itemised, and available in English plus the Eighth Schedule
 * languages — the placeholder for translations is called out rather than
 * quietly skipped. Second, consent must be as easy to withdraw as to give,
 * which is why every claim here maps to a control that actually exists in
 * Settings.
 *
 * PLACEHOLDERS: the operator name, address and Grievance Officer contact must
 * be filled in before launch. They are marked clearly rather than invented.
 */
export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      version="1.1.0"
      effectiveDate="23 October 2026"
      summary="We collect what we need to remind you about your medicines, and nothing else. We do not sell your data or use it for advertising. Your medication information is only shared with caregivers you personally invite, with permissions you choose, and you can withdraw that at any time. You can download or delete everything from Settings."
    >
      <div className="alert alert-warn" style={{ marginBottom: 'var(--s5)' }}>
        <AlertTriangle size={18} />
        <div>
          <strong>Before you publish this:</strong> the fields marked
          <code> [OPERATOR NAME] </code>, <code>[REGISTERED ADDRESS]</code> and
          <code> [GRIEVANCE OFFICER]</code> must be completed, and this document should be reviewed
          by a lawyer. It is a solid, accurate starting draft — it is not legal advice.
        </div>
      </div>

      <h2>1. Who we are</h2>
      <p>
        MedTrack (“we”, “us”) is operated by <strong>[OPERATOR NAME]</strong>, registered at{' '}
        <strong>[REGISTERED ADDRESS]</strong>, India. Under the Digital Personal Data Protection
        Act, 2023 we are the <strong>Data Fiduciary</strong> for the personal data described here,
        and you are the <strong>Data Principal</strong>.
      </p>

      <h2>2. What this policy covers</h2>
      <p>
        It covers the MedTrack website, the MedTrack mobile app, and the service behind them. It does
        not cover anything you reach by following a link elsewhere.
      </p>

      <h2>3. What we collect, and why</h2>
      <p>
        We collect only what the service needs to function. Each item below is tied to a specific
        purpose — we do not collect data speculatively in case it becomes useful later.
      </p>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>What</th>
              <th>Why</th>
              <th>Kept for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Name, email address</td>
              <td>To create your account, sign you in, and send you alerts you asked for</td>
              <td>Until you delete your account</td>
            </tr>
            <tr>
              <td>Password (stored only as a bcrypt hash)</td>
              <td>To authenticate you. We cannot read your password</td>
              <td>Until you delete your account</td>
            </tr>
            <tr>
              <td>Timezone</td>
              <td>To fire reminders at the right local time</td>
              <td>Until you delete your account</td>
            </tr>
            <tr>
              <td>
                <strong>Medicines, dosages, schedules and dose history</strong>
              </td>
              <td>The core function: to remind you and show you your adherence</td>
              <td>Until you delete your account or remove the item</td>
            </tr>
            <tr>
              <td>Appointments and lab tests you enter</td>
              <td>To remind you about them</td>
              <td>Until you delete your account or remove the item</td>
            </tr>
            <tr>
              <td>Caregiver email addresses you supply</td>
              <td>To send the invitation and the alerts you authorised</td>
              <td>Until the link is revoked or your account is deleted</td>
            </tr>
            <tr>
              <td>Device push token, platform, app version</td>
              <td>To deliver notifications to your device</td>
              <td>Until you sign out on that device or uninstall</td>
            </tr>
            <tr>
              <td>Session records, coarse IP fingerprint, browser user agent</td>
              <td>Security: to let you see and revoke sessions, and to detect token theft</td>
              <td>30 days after the session ends</td>
            </tr>
            <tr>
              <td>Error and performance logs</td>
              <td>To find and fix faults</td>
              <td>30 days</td>
            </tr>
            <tr>
              <td>
                Privacy log: sign-ins, consents given or withdrawn, data downloads, deletion requests
                and caregiver access — tied to a random account number, never your name, email or
                health details
              </td>
              <td>To show that we honoured your choices and rights, and to detect misuse, as the DPDP Rules require</td>
              <td>One year, including after your account is deleted</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Health-related data</h3>
      <p>
        Information about your medicines and whether you took them says something about your health.
        We treat it accordingly:
      </p>
      <ul>
        <li>You consent to it separately and explicitly when you create your account.</li>
        <li>It is never used for advertising, profiling, or sold to anyone.</li>
        <li>It is shared only with caregivers you personally invite, and only what you permit.</li>
        <li>
          It is excluded from our application logs. Our logging system redacts medicine names, email
          addresses, phone numbers and dates of birth before anything is written.
        </li>
      </ul>

      <h2>4. What we do not do</h2>
      <ul>
        <li>We do not sell or rent your personal data to anyone, for any purpose.</li>
        <li>We do not use your data for advertising, and we run no advertising trackers.</li>
        <li>
          We do not build behavioural profiles or use your data to train models. The one exception is
          research you opt into (below), and even then we never sell it or share it with drug
          companies, insurers or employers.
        </li>
        <li>We do not share your data with employers, insurers, or pharmaceutical companies.</li>
        <li>We do not use third-party analytics that identify you individually.</li>
      </ul>

      <h3>Research, only if you opt in</h3>
      <p>
        In <strong>Settings → Privacy choices</strong> you can let MedTrack use your medicines,
        schedules, dose history, timezone and year of birth (if you gave it) — with your name, email
        and phone removed first — for research into why doses are missed, so we can improve the app.
        It is off unless you turn it on, and you can turn it off again at any time with one click;
        data already used in a finished analysis cannot be pulled back out of it, but nothing new is
        used once you turn it off.
      </p>

      <h3>What every consent records</h3>
      <p>
        Each consent you give is stored with the exact purpose, the list of data it covers, the version
        of this policy and the language it was shown in, so there is never any doubt about what you
        agreed to.
      </p>

      <h2>5. Who else sees your data</h2>
      <p>
        We use a small number of processors to run the service. Each acts only on our instructions
        and cannot use your data for its own purposes.
      </p>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Processor</th>
              <th>What they handle</th>
              <th>Where</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>MongoDB Atlas</td>
              <td>Database hosting — all of the above</td>
              <td>[REGION — set your Atlas cluster region]</td>
            </tr>
            <tr>
              <td>Application host (Railway or Fly.io)</td>
              <td>Running the API</td>
              <td>[REGION]</td>
            </tr>
            <tr>
              <td>Email provider (SMTP)</td>
              <td>Caregiver alerts, invitations, password resets</td>
              <td>[REGION]</td>
            </tr>
            <tr>
              <td>Expo push service</td>
              <td>Delivering notifications to your device</td>
              <td>United States</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        Some processors operate outside India. Where that happens, the transfer is made under the
        DPDP Act’s provisions for cross-border transfer and is limited to what the service needs.
      </p>

      <h3>Caregivers</h3>
      <p>
        Caregivers are not our processors — they are people you chose. When you invite someone and
        they accept, they can see exactly what you ticked and nothing more. You can change those
        permissions or withdraw access entirely from <strong>Settings → Caregivers</strong>, without
        their agreement, and it takes effect immediately.
      </p>

      <h2>6. Your rights</h2>
      <p>Under the DPDP Act you have the following rights, and each one works in the product:</p>
      <ul>
        <li>
          <strong>Access.</strong> Download a complete copy of everything we hold about you, as
          JSON, from <strong>Settings → Your data → Download my data</strong>.
        </li>
        <li>
          <strong>Correction.</strong> Edit your name, timezone, medicines, schedules and history
          directly in the app.
        </li>
        <li>
          <strong>Erasure.</strong> Delete your account from <strong>Settings → Your data</strong>.
          Caregivers lose access immediately and every session is revoked. After a short grace
          period — during which you can cancel by signing in — everything is permanently erased.
        </li>
        <li>
          <strong>Withdraw consent.</strong> Turn off research use or optional email in{' '}
          <strong>Settings → Privacy choices</strong>, or revoke any caregiver, at any time. Withdrawing consent for the medication data the service is built on means deleting
          your account, because there is no meaningful service without it — we say that plainly
          rather than pretending otherwise.
        </li>
        <li>
          <strong>Grievance redressal.</strong> Contact our Grievance Officer below. If you are not
          satisfied, you may complain to the Data Protection Board of India.
        </li>
        <li>
          <strong>Nominate.</strong> You may nominate someone to exercise these rights on your behalf
          in the event of death or incapacity. Contact us to arrange it.
        </li>
      </ul>

      <h2>7. Keeping your data safe</h2>
      <ul>
        <li>All traffic is encrypted in transit with TLS.</li>
        <li>Passwords are hashed with bcrypt at cost factor 12 and are never stored or logged in readable form.</li>
        <li>
          Sign-in tokens are short-lived and refresh tokens rotate on every use. If a refresh token is
          ever presented twice, we treat it as stolen and end every session in that chain.
        </li>
        <li>Repeated failed sign-in attempts temporarily lock the account.</li>
        <li>Caregiver invitations are stored hashed, expire after 14 days, and are single-use.</li>
        <li>Access to your record is checked on every single request, not just at sign-in.</li>
      </ul>
      <p>
        No system is perfectly secure. If a breach occurs that is likely to affect you, we will notify
        you and the Data Protection Board as the DPDP Act requires.
      </p>

      <h2>8. Children</h2>
      <p>
        MedTrack accounts are for adults. You confirm you are 18 or older when you sign up, and a
        date of birth under 18 is refused. Under the DPDP Act, processing a child’s data needs
        verifiable parental consent, which MedTrack does not collect — so it is not designed for
        tracking a child’s medicines. If we learn that an account belongs to a child, we will
        delete it.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        If we change this policy in a way that materially affects you, we will tell you in the app and
        ask you to agree again before you continue. Every consent you give is recorded together with
        the version of the document you agreed to.
      </p>

      <h2>10. Contact</h2>
      <p>
        <strong>Grievance Officer:</strong> [GRIEVANCE OFFICER NAME]
        <br />
        <strong>Email:</strong> [GRIEVANCE EMAIL]
        <br />
        <strong>Address:</strong> [REGISTERED ADDRESS]
      </p>
      <p>
        We aim to respond to any request about your data within 30 days.
      </p>

      <p>
        See also our <Link to="/terms">Terms of Service</Link> and{' '}
        <Link to="/medical-disclaimer">Medical Disclaimer</Link>.
      </p>
    </LegalLayout>
  );
}
