import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout.js';

/**
 * Terms of Service.
 *
 * Two things are handled carefully here. First, the limitation of liability is
 * written to be enforceable in India rather than copied from a US template —
 * Indian law does not permit excluding liability for death or personal injury
 * caused by negligence, and a clause that tries to is void, which can taint the
 * rest. Second, the reliability language is honest: a reminder app that oversells
 * its dependability is dangerous, so the terms say plainly that it must not be
 * a sole safeguard.
 */
export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      version="1.0.0"
      effectiveDate="25 August 2026"
      summary="MedTrack is a free reminder tool. It is not a medical device and does not give medical advice. Use it as a helper, never as your only safeguard for an important medicine. Your data stays yours, and you can leave at any time."
    >
      <div className="alert alert-warn" style={{ marginBottom: 'var(--s5)' }}>
        <span aria-hidden="true">⚠</span>
        <div>
          <strong>Before you publish this:</strong> complete <code>[OPERATOR NAME]</code>,{' '}
          <code>[REGISTERED ADDRESS]</code>, <code>[SUPPORT EMAIL]</code> and{' '}
          <code>[CITY]</code>, and have it reviewed by a lawyer. This is a careful draft, not legal
          advice.
        </div>
      </div>

      <h2>1. Agreement</h2>
      <p>
        These terms are between you and <strong>[OPERATOR NAME]</strong> (“we”, “us”). By creating an
        account you agree to them. If you do not agree, please do not use MedTrack.
      </p>

      <h2>2. What MedTrack is — and is not</h2>
      <p>
        MedTrack is a personal organisation tool. It stores the medicines you tell it about and
        reminds you when you said you wanted reminding.
      </p>
      <p>
        <strong>
          MedTrack is not a medical device, and it does not provide medical advice, diagnosis or
          treatment.
        </strong>{' '}
        It has not been evaluated or approved by the Central Drugs Standard Control Organisation or
        any other regulator. It does not check for drug interactions, verify that a dose is safe, or
        review anything you enter. If you type the wrong dose, MedTrack will remind you to take the
        wrong dose.
      </p>
      <p>
        Please read the <Link to="/medical-disclaimer">Medical Disclaimer</Link> — it is part of these
        terms.
      </p>

      <h2>3. Reliability, stated honestly</h2>
      <p>
        We work hard to make reminders arrive on time. We cannot guarantee it. A notification can
        fail to reach you for reasons entirely outside our control, including:
      </p>
      <ul>
        <li>your device being switched off, silenced, or in a battery-saving mode;</li>
        <li>the operating system delaying or suppressing notifications;</li>
        <li>notification permissions being turned off;</li>
        <li>loss of network connectivity;</li>
        <li>an outage at us or at a service we depend on.</li>
      </ul>
      <p>
        <strong>
          Because of this, MedTrack must not be your only safeguard for any medicine where missing a
          dose would be harmful.
        </strong>{' '}
        Keep whatever backup you and your doctor think appropriate.
      </p>

      <h2>4. Your account</h2>
      <ul>
        <li>You must be 18 or older to hold an account in your own name.</li>
        <li>Give accurate information, and keep your password to yourself.</li>
        <li>You are responsible for what happens under your account.</li>
        <li>Tell us promptly if you think someone else has access.</li>
      </ul>

      <h2>5. Caregivers</h2>
      <p>
        You may invite other people to see parts of your information. By doing so you confirm you
        have their permission to give us their email address, and you accept that they will be able
        to see what you granted until you withdraw it.
      </p>
      <p>
        Caregivers may only use what they see to support the person who invited them. Using it for
        any other purpose is a breach of these terms.
      </p>
      <p>
        You can withdraw a caregiver’s access at any time, immediately, without their agreement.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use MedTrack for anyone else’s data without their consent;</li>
        <li>attempt to access another person’s account or data;</li>
        <li>probe, scan or test the security of the service without our written permission;</li>
        <li>use automated means to extract data at scale;</li>
        <li>use the SOS feature other than for a genuine situation;</li>
        <li>use the service for anything unlawful.</li>
      </ul>

      <h2>7. Your data</h2>
      <p>
        Your data remains yours. We claim no ownership over what you enter. We handle it as described
        in the <Link to="/privacy">Privacy Policy</Link>. You can export it or delete it at any time
        from Settings.
      </p>

      <h2>8. Availability and changes</h2>
      <p>
        MedTrack is currently provided free of charge. We may change, suspend or discontinue any part
        of it. If we discontinue the service entirely, we will give reasonable notice and a way to
        export your data first.
      </p>

      <h2>9. Liability</h2>
      <p>
        Except where the law does not permit it, MedTrack is provided “as is”, without warranty that
        it will be uninterrupted, timely, or error-free.
      </p>
      <p>
        <strong>Nothing in these terms limits or excludes our liability for:</strong> death or
        personal injury caused by our negligence; fraud or fraudulent misrepresentation; or any other
        liability that cannot lawfully be limited under Indian law. This is stated explicitly because
        a clause purporting to exclude such liability would be void, and we would rather be clear
        than rely on one.
      </p>
      <p>
        Subject to that, and to the extent permitted by law, we are not liable for indirect or
        consequential loss arising from your use of MedTrack, and our total aggregate liability is
        limited to the greater of the amount you paid us in the preceding twelve months (presently
        nil) or ₹1,000.
      </p>
      <p>
        This does not affect your rights against any healthcare professional, nor your statutory
        rights as a consumer under the Consumer Protection Act, 2019.
      </p>

      <h2>10. Ending your use</h2>
      <p>
        You can delete your account at any time from Settings. We may suspend or close an account
        that breaches these terms, and where practical we will explain why and give you a chance to
        respond.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by the laws of India. The courts at <strong>[CITY]</strong> have
        jurisdiction, without prejudice to any right you have to bring proceedings before a consumer
        forum where you live.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        If we make a material change we will notify you in the app and ask you to agree before
        continuing. Your agreement is recorded along with the version you accepted.
      </p>

      <h2>13. Contact</h2>
      <p>
        <strong>[OPERATOR NAME]</strong>
        <br />
        [REGISTERED ADDRESS]
        <br />
        [SUPPORT EMAIL]
      </p>
    </LegalLayout>
  );
}
