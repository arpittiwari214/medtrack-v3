/**
 * Account settings, including the data-rights controls.
 *
 * Export and deletion get real estate here rather than being buried, because a
 * Privacy Policy that promises them is only honest if they are findable.
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CONSENT_SCOPE, type ConsentKind } from '@medtrack/shared';
import { ApiError, tokens } from '../api/client.js';
import { accountApi, authApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner, Modal, ScreenHeader, SuccessBanner } from '../components/ui.js';
import { AlertTriangle, ChevronRight, Users } from '../components/icons.js';

export default function Settings() {
  const { user, signOut, refresh } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const OPTIONAL: ConsentKind[] = ['research_use', 'marketing_email'];
  const isGranted = (kind: ConsentKind) =>
    Boolean(user?.consents?.some((consent) => consent.kind === kind && !consent.withdrawnAt));

  /** Withdrawing must be as easy as agreeing: one click either way. */
  async function toggleConsent(kind: ConsentKind, granted: boolean) {
    setError('');
    setStatus('');
    try {
      await accountApi.updateConsent({ kind, granted });
      await refresh();
      setStatus(granted ? 'Turned on.' : 'Turned off.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that choice.');
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await authApi.updateProfile({ name });
      await refresh();
      setStatus('Saved.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save your changes.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Fetched with the auth header and turned into a blob rather than linked
   * directly — a plain `<a href>` cannot carry a bearer token.
   */
  async function downloadExport() {
    setError('');
    try {
      const response = await fetch(accountApi.exportUrl(), {
        headers: { Authorization: `Bearer ${tokens.access() ?? ''}` },
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `medtrack-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not prepare your export. Please try again.');
    }
  }

  return (
    <div>
      <ScreenHeader eyebrow={user?.email} title="Settings" />

      {error && <ErrorBanner message={error} />}
      {status && <SuccessBanner message={status} />}

      <div className="stack">
        <form className="panel" onSubmit={saveProfile}>
          <div className="panel-head">
            <span className="micro">Your details</span>
          </div>
          <div className="panel-body stack">
            <div className="field">
              <label className="label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="field">
              <span className="label">Timezone</span>
              <p className="muted t-sm">{user?.timezone}</p>
              <span className="field-hint">
                Your dose times are read in this zone. It updates automatically when you sign in
                from somewhere else.
              </span>
            </div>

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">Sharing</span>
          </div>
          <div className="list" style={{ border: 'none', borderRadius: 0 }}>
            <Link className="list-row list-row-link" to="/app/caregivers">
              <Users size={18} />
              <span className="flex-1">Manage caregivers</span>
              <ChevronRight size={16} />
            </Link>
            <Link className="list-row list-row-link" to="/care">
              <Users size={18} />
              <span className="flex-1">People I care for</span>
              <ChevronRight size={16} />
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">Security</span>
          </div>
          <div className="list" style={{ border: 'none', borderRadius: 0 }}>
            <button
              type="button"
              className="list-row list-row-link"
              onClick={() => setPasswordOpen(true)}
            >
              <span className="flex-1">Change password</span>
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="list-row list-row-link"
              onClick={async () => {
                await authApi.logoutAll();
                await signOut();
              }}
            >
              <span className="flex-1">Sign out of all devices</span>
              <ChevronRight size={16} />
            </button>
            <button type="button" className="list-row list-row-link" onClick={signOut}>
              <span className="flex-1">Sign out</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">Privacy choices</span>
          </div>
          <div className="panel-body stack">
            {OPTIONAL.map((kind) => (
              <label key={kind} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={isGranted(kind)}
                  onChange={(event) => void toggleConsent(kind, event.target.checked)}
                />
                <span className="t-sm">
                  {CONSENT_SCOPE[kind].purpose}
                  <span className="field-hint" style={{ display: 'block' }}>
                    Uses: {CONSENT_SCOPE[kind].dataItems.join(', ')}. Optional — off unless you turn it on.
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">Your data</span>
          </div>
          <div className="panel-body">
            <p className="muted t-sm mb-3">
              Under India’s Digital Personal Data Protection Act you can get a copy of everything we
              hold about you, and have it erased.
            </p>
            <div className="stack stack-sm">
              <button type="button" className="btn btn-secondary btn-block" onClick={downloadExport}>
                Download my data
              </button>
              <button
                type="button"
                className="btn btn-danger btn-block"
                onClick={() => setDeleteOpen(true)}
              >
                Delete my account
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">Legal</span>
          </div>
          <div className="list" style={{ border: 'none', borderRadius: 0 }}>
            {[
              { to: '/privacy', label: 'Privacy Policy' },
              { to: '/terms', label: 'Terms of Service' },
              { to: '/medical-disclaimer', label: 'Medical Disclaimer' },
              { to: '/cookies', label: 'Cookies' },
            ].map((item) => (
              <Link key={item.to} className="list-row list-row-link" to={item.to}>
                <span className="flex-1">{item.label}</span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} onDeleted={refresh} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await authApi.changePassword({ currentPassword, newPassword });
      tokens.set(result.accessToken, result.refreshToken);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Change password" onClose={onClose}>
      {done ? (
        <div className="stack">
          <SuccessBanner message="Password updated. Your other devices have been signed out." />
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          {error && <ErrorBanner message={error} />}
          <div className="field">
            <label className="label" htmlFor="current">
              Current password
            </label>
            <input
              id="current"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="new">
              New password
            </label>
            <input
              id="new"
              className="input"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <span className="field-hint">At least 10 characters.</span>
          </div>
          <button className="action-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function DeleteAccountModal({
  onClose,
  onDeleted,
}: {
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await accountApi.requestDeletion({ password, confirmation });
      setResult(response.message);
      await onDeleted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not process that request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Delete your account" onClose={onClose}>
      {result ? (
        <div className="stack">
          <SuccessBanner message={result} />
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          {error && <ErrorBanner message={error} />}

          <div className="alert alert-warn">
            <AlertTriangle size={18} />
            <div>
              <strong>This erases everything.</strong>
              <p className="t-xs mt-2">
                Your medicines, your full dose history, appointments and caregiver links. Caregivers
                lose access immediately. There is a grace period during which you can change your
                mind by signing in — after that it cannot be undone.
              </p>
            </div>
          </div>

          <p className="muted t-sm">Consider downloading your data first.</p>

          <div className="field">
            <label className="label" htmlFor="delete-password">
              Your password
            </label>
            <input
              id="delete-password"
              className="input"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="confirmation">
              Type <code>DELETE MY ACCOUNT</code> to confirm
            </label>
            <input
              id="confirmation"
              className="input"
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>

          <button className="btn btn-danger btn-block btn-lg" type="submit" disabled={busy}>
            {busy ? 'Processing…' : 'Delete my account'}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
            Keep my account
          </button>
        </form>
      )}
    </Modal>
  );
}
