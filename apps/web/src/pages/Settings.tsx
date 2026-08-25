/**
 * Account settings, including the data-rights controls.
 *
 * Export and deletion are given real estate here rather than being buried,
 * because a Privacy Policy that promises them is only honest if they are
 * actually findable.
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, tokens } from '../api/client.js';
import { accountApi, authApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner, Modal, PageHeader, SuccessBanner } from '../components/ui.js';

export default function Settings() {
  const { user, signOut, refresh } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
   * Download the export.
   *
   * Fetched with the auth header and turned into a blob rather than linked
   * directly, because a plain `<a href>` cannot carry a bearer token.
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
    <div className="stack">
      <PageHeader title="Settings" />

      {error && <ErrorBanner message={error} />}
      {status && <SuccessBanner message={status} />}

      <form className="card stack" onSubmit={saveProfile}>
        <h2 style={{ fontSize: '1.0625rem' }}>Your details</h2>

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
          <span className="label">Email</span>
          <p className="muted">{user?.email}</p>
        </div>

        <div className="field">
          <span className="label">Timezone</span>
          <p className="muted">{user?.timezone}</p>
          <span className="field-hint">
            Your dose times are interpreted in this zone. It updates automatically when you sign in
            from somewhere else.
          </span>
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <section className="card stack">
        <h2 style={{ fontSize: '1.0625rem' }}>Sharing</h2>
        <p className="muted" style={{ fontSize: '0.9375rem' }}>
          Manage who can see your medicines and adherence.
        </p>
        <Link className="btn btn-secondary" to="/app/caregivers">
          Manage caregivers
        </Link>
        <Link className="btn btn-secondary" to="/care">
          People I care for
        </Link>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: '1.0625rem' }}>Security</h2>
        <button type="button" className="btn btn-secondary" onClick={() => setPasswordOpen(true)}>
          Change password
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            await authApi.logoutAll();
            await signOut();
          }}
        >
          Sign out of all devices
        </button>
        <button type="button" className="btn btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: '1.0625rem' }}>Your data</h2>
        <p className="muted" style={{ fontSize: '0.9375rem' }}>
          Under India’s Digital Personal Data Protection Act you can get a copy of everything we hold
          about you, and have it erased.
        </p>
        <button type="button" className="btn btn-secondary" onClick={downloadExport}>
          Download my data
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setDeleteOpen(true)} style={{ color: 'var(--danger)' }}>
          Delete my account
        </button>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: '1.0625rem' }}>Legal</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--s2)' }}>
          <li>
            <Link to="/privacy">Privacy Policy</Link>
          </li>
          <li>
            <Link to="/terms">Terms of Service</Link>
          </li>
          <li>
            <Link to="/medical-disclaimer">Medical Disclaimer</Link>
          </li>
          <li>
            <Link to="/cookies">Cookies</Link>
          </li>
        </ul>
      </section>

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
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function DeleteAccountModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => Promise<void> }) {
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
            <span aria-hidden="true">⚠</span>
            <div>
              <strong>This erases everything.</strong>
              <p style={{ fontSize: '0.875rem', marginTop: 'var(--s1)' }}>
                Your medicines, your full dose history, appointments and caregiver links. Caregivers
                lose access immediately. There is a grace period during which you can change your
                mind by signing in again — after that it cannot be undone.
              </p>
            </div>
          </div>

          <p className="muted" style={{ fontSize: '0.9375rem' }}>
            Consider downloading your data first.
          </p>

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

          <button className="btn btn-danger btn-block" type="submit" disabled={busy}>
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
