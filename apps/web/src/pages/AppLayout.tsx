/**
 * Shell for the signed-in patient app.
 *
 * Holds the unacknowledged-alert count so the nav badge stays consistent across
 * screens, and surfaces a deletion-pending banner — someone who scheduled their
 * account for deletion and then signed in probably wants to undo it, and that
 * should not be buried in settings.
 *
 * It is also where an updated Privacy Policy or Terms is put to the user before
 * they carry on, as the policy promises. Settings stays reachable, so someone
 * who does not agree can still export or delete their data.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LEGAL_DOCUMENT_VERSIONS, outdatedConsents, type ConsentKind } from '@medtrack/shared';
import { accountApi, alertsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.js';
import { BottomNav, ErrorBanner } from '../components/ui.js';
import { AlertTriangle } from '../components/icons.js';

export default function AppLayout() {
  const { user, refresh } = useAuth();
  const [unacknowledged, setUnacknowledged] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const { pathname } = useLocation();
  const outdated = user ? outdatedConsents(user.consents ?? []) : [];

  const loadAlerts = useCallback(async () => {
    try {
      const { unacknowledged: count } = await alertsApi.list();
      setUnacknowledged(count);
    } catch {
      // A failed badge count is not worth interrupting the screen for.
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const deletionPending = Boolean(user?.deletionRequestedAt);

  async function cancelDeletion() {
    setCancelling(true);
    try {
      await accountApi.cancelDeletion();
      await refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="app-shell">
      <main id="main" style={{ padding: '0 var(--s4)' }}>
        {deletionPending && (
          <div className="alert alert-warn mt-4" role="alert">
            <AlertTriangle size={18} />
            <div className="flex-1">
              <strong>Your account is scheduled for deletion.</strong>
              <p className="t-xs mt-2">
                All your data will be permanently erased when the grace period ends.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-secondary mt-3"
                onClick={cancelDeletion}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Keep my account'}
              </button>
            </div>
          </div>
        )}

        {outdated.length > 0 && !deletionPending && pathname !== '/app/settings' ? (
          <ReconsentGate kinds={outdated} onDone={refresh} />
        ) : (
          <Outlet context={{ reloadAlerts: loadAlerts }} />
        )}

        <p className="subtle center" style={{ marginTop: 'var(--s7)' }}>
          MedTrack is a reminder tool, not a medical device.{' '}
          <Link to="/medical-disclaimer">What that means</Link>
        </p>
      </main>

      <BottomNav alertCount={unacknowledged} />
    </div>
  );
}

/** Plain-language summary of the latest policy change. Rewrite it with each version bump. */
const WHAT_CHANGED = [
  'You can now choose to let MedTrack use your medicines and dose history — with your name, email and phone removed — for research into why doses are missed. It stays off unless you turn it on in Settings.',
  'A record of privacy actions (consents, downloads, deletion requests) is kept for one year, even after an account is deleted. It holds no name, email or health details.',
  'Accounts are for people aged 18 or over.',
];

function ReconsentGate({ kinds, onDone }: { kinds: ConsentKind[]; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function agree() {
    setBusy(true);
    setError('');
    try {
      for (const kind of kinds) await accountApi.updateConsent({ kind, granted: true });
      await onDone();
    } catch {
      setError('Could not save that. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-pad stack mt-4" aria-labelledby="reconsent-title">
      <h1 id="reconsent-title" className="t-title">
        We have updated our Privacy Policy
      </h1>
      <p className="muted t-sm">Version {LEGAL_DOCUMENT_VERSIONS.privacy_policy}. What changed:</p>
      <ul className="t-sm stack stack-sm" style={{ paddingLeft: 'var(--s5)' }}>
        {WHAT_CHANGED.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="t-sm">
        <Link to="/privacy" target="_blank">
          Read the full Privacy Policy
        </Link>{' '}
        ·{' '}
        <Link to="/terms" target="_blank">
          Terms of Service
        </Link>
      </p>
      {error && <ErrorBanner message={error} />}
      <button type="button" className="btn btn-primary" onClick={agree} disabled={busy}>
        {busy ? 'Saving…' : 'I agree'}
      </button>
      <p className="muted t-xs">
        If you do not agree, you can download your data or delete your account in{' '}
        <Link to="/app/settings">Settings</Link>.
      </p>
    </section>
  );
}
