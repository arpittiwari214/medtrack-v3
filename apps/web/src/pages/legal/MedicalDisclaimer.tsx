import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout.js';
import { AlertTriangle } from '../../components/icons.js';

/**
 * Medical Disclaimer.
 *
 * Deliberately the plainest document of the four. Its job is not to protect us
 * in a dispute — that is what the Terms do — but to make sure a real person
 * genuinely understands the limits of the tool before they rely on it. So it is
 * short, uses no legal vocabulary, and leads with the sentence that matters.
 */
export default function MedicalDisclaimer() {
  return (
    <LegalLayout
      title="Medical Disclaimer"
      version="1.0.0"
      effectiveDate="25 August 2026"
      summary="MedTrack reminds you about medicines you entered yourself. It does not check whether they are right, does not give medical advice, and should never replace your doctor or pharmacist — or be your only safeguard for a medicine that matters."
    >
      <h2>MedTrack is not a medical device</h2>
      <p>
        It is a reminder and record-keeping tool, like a very good pill organiser with an alarm. It
        has not been assessed or approved by the Central Drugs Standard Control Organisation, or by
        any equivalent regulator elsewhere.
      </p>

      <h2>It does not know anything about your medicines</h2>
      <p>
        MedTrack stores exactly what you type and reminds you at exactly the times you choose. It
        does not:
      </p>
      <ul>
        <li>check whether a medicine or a dose is correct or safe for you;</li>
        <li>check for interactions between medicines;</li>
        <li>warn you about side effects, allergies or contraindications;</li>
        <li>know your diagnosis, your history, or anything your doctor knows;</li>
        <li>verify anything you enter.</li>
      </ul>
      <p>
        <strong>If you enter the wrong dose, MedTrack will faithfully remind you to take the wrong
        dose.</strong> Please double-check what you enter against your prescription or the label.
      </p>

      <h2>Do not use it as your only safeguard</h2>
      <p>
        Notifications can fail. Phones get switched off, silenced, run out of battery, or decide to
        delay a notification to save power. Networks drop. Services have outages.
      </p>
      <p>
        For any medicine where missing a dose would be harmful, keep a second safeguard — a pill
        organiser, a household routine, another person, or whatever you and your doctor agree on.
      </p>

      <h2>Talk to a professional, not to an app</h2>
      <p>Always speak to your doctor or pharmacist before you:</p>
      <ul>
        <li>start, stop or change any medicine;</li>
        <li>change a dose or a timing;</li>
        <li>act on anything you see in MedTrack, including the adherence figures.</li>
      </ul>
      <p>
        The insights MedTrack shows — streaks, percentages, patterns — describe what you recorded.
        They are not a clinical assessment and should not be used to make a treatment decision on
        their own.
      </p>

      <h2>In an emergency</h2>
      <div className="alert alert-error" style={{ marginBottom: 'var(--s4)' }}>
        <AlertTriangle size={18} />
        <div>
          <strong>MedTrack is not an emergency service.</strong> The SOS button notifies the
          caregivers you set up, by email and push notification. It does not contact emergency
          services, and it cannot guarantee anyone will see it or respond.
          <br />
          <br />
          If you are having a medical emergency, call your local emergency number. In India, dial{' '}
          <strong>112</strong>, or <strong>108</strong> for an ambulance in most states.
        </div>
      </div>

      <h2>If you are a caregiver</h2>
      <p>
        What you see in MedTrack is what the person recorded, not a medical record. A dose showing as
        “taken” means they tapped a button — it is not proof. Absence of an alert is not proof that
        everything is fine, since an alert can fail to reach you.
      </p>
      <p>Please treat MedTrack as one signal among several, and stay in direct contact.</p>

      <h2>Questions</h2>
      <p>
        This disclaimer forms part of our <Link to="/terms">Terms of Service</Link>. See also our{' '}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </LegalLayout>
  );
}
