import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout.js';

/**
 * Cookie / local storage notice.
 *
 * Short because the truth is short: MedTrack sets no cookies at all and uses
 * localStorage for exactly two values. There is no consent banner because there
 * is nothing to consent to — strictly necessary storage does not require one,
 * and showing a banner anyway would train people to click through the ones that
 * do matter.
 */
export default function Cookies() {
  return (
    <LegalLayout
      title="Cookies and local storage"
      version="1.0.0"
      effectiveDate="25 August 2026"
      summary="MedTrack sets no cookies and runs no trackers. It stores two sign-in tokens in your browser so you stay signed in. That is the entire list, which is why you never saw a cookie banner."
    >
      <h2>We do not use cookies</h2>
      <p>
        MedTrack sets no cookies — not for analytics, not for advertising, not for anything. There
        are no third-party trackers, no pixels, and no advertising networks.
      </p>

      <h2>What we do store on your device</h2>
      <p>The web app keeps two values in your browser’s local storage:</p>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>What it is</th>
              <th>How long</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>mt_access</code>
              </td>
              <td>A short-lived sign-in token, so each request can prove it is you</td>
              <td>15 minutes</td>
            </tr>
            <tr>
              <td>
                <code>mt_refresh</code>
              </td>
              <td>A token that gets a fresh sign-in token, so you are not signed out constantly</td>
              <td>Up to 30 days, or until you sign out</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        Both are strictly necessary — without them you would have to enter your password on every
        single page. Signing out removes both immediately.
      </p>

      <h2>Why there is no cookie banner</h2>
      <p>
        Consent banners exist for storage that is not strictly necessary, mainly tracking and
        advertising. We have none. Showing a banner for two sign-in tokens would be theatre, and it
        would help train people to dismiss the banners that genuinely matter elsewhere.
      </p>

      <h2>The mobile app</h2>
      <p>
        The MedTrack app stores the same two tokens in your device’s secure storage, plus an offline
        copy of your own medicines and dose history so the app works without a network connection.
        That copy is removed when you sign out.
      </p>

      <h2>Clearing it yourself</h2>
      <p>
        Signing out clears everything MedTrack has stored. You can also clear site data through your
        browser’s settings, or uninstall the app.
      </p>

      <p>
        For everything else we hold, see the <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </LegalLayout>
  );
}
