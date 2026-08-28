/**
 * Shell for the signed-in patient app.
 *
 * Holds the unacknowledged-alert count so the nav badge stays consistent across
 * screens, and surfaces a deletion-pending banner — someone who scheduled their
 * account for deletion and then signed in probably wants to undo it, and that
 * should not be buried in settings.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { accountApi, alertsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.js';
import { BottomNav } from '../components/ui.js';
import { AlertTriangle } from '../components/icons.js';

export default function AppLayout() {
  const { user, refresh } = useAuth();
  const [unacknowledged, setUnacknowledged] = useState(0);
  const [cancelling, setCancelling] = useState(false);

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

  const deletionPending = Boolean(
    (user as { deletionRequestedAt?: string | null })?.deletionRequestedAt,
  );

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

        <Outlet context={{ reloadAlerts: loadAlerts }} />

        <p className="subtle center" style={{ marginTop: 'var(--s7)' }}>
          MedTrack is a reminder tool, not a medical device.{' '}
          <Link to="/medical-disclaimer">What that means</Link>
        </p>
      </main>

      <BottomNav alertCount={unacknowledged} />
    </div>
  );
}
