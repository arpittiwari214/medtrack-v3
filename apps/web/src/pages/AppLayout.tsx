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
import { interleave, useT } from '../i18n/index.js';
import { AlertTriangle } from '../components/icons.js';

export default function AppLayout() {
  const { user, refresh } = useAuth();
  const { t } = useT();
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
              <strong>{t('deletion_pending')}</strong>
              <p className="t-xs mt-2">{t('deletion_pending_body')}</p>
              <button
                type="button"
                className="btn btn-sm btn-secondary mt-3"
                onClick={cancelDeletion}
                disabled={cancelling}
              >
                {t(cancelling ? 'cancelling' : 'keep_account')}
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
          {t('not_a_device')} <Link to="/medical-disclaimer">{t('what_that_means')}</Link>
        </p>
      </main>

      <BottomNav alertCount={unacknowledged} />
    </div>
  );
}

/** Plain-language summary of the latest policy change. Rewrite it with each version bump. */
const WHAT_CHANGED = ['policy_change_1', 'policy_change_2', 'policy_change_3'] as const;

function ReconsentGate({ kinds, onDone }: { kinds: ConsentKind[]; onDone: () => Promise<void> }) {
  const { t, locale } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function agree() {
    setBusy(true);
    setError('');
    try {
      for (const kind of kinds) await accountApi.updateConsent({ kind, granted: true, language: locale });
      await onDone();
    } catch {
      setError(t('could_not_save'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-pad stack mt-4" aria-labelledby="reconsent-title">
      <h1 id="reconsent-title" className="t-title">
        {t('policy_updated')}
      </h1>
      <p className="muted t-sm">
        {t('policy_version_changed', { version: LEGAL_DOCUMENT_VERSIONS.privacy_policy })}
      </p>
      <ul className="t-sm stack stack-sm" style={{ paddingLeft: 'var(--s5)' }}>
        {WHAT_CHANGED.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <p className="t-sm">
        <Link to="/privacy" target="_blank">
          {t('read_privacy')}
        </Link>{' '}
        ·{' '}
        <Link to="/terms" target="_blank">
          {t('terms_of_service')}
        </Link>
      </p>
      {error && <ErrorBanner message={error} />}
      <button type="button" className="btn btn-primary" onClick={agree} disabled={busy}>
        {t(busy ? 'saving' : 'i_agree')}
      </button>
      <p className="muted t-xs">
        {interleave(t('policy_disagree'), {
          settings: <Link to="/app/settings">{t('tab_settings')}</Link>,
        })}
      </p>
    </section>
  );
}
