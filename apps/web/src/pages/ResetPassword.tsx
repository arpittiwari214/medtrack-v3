import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { authApi } from '../api/endpoints.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Those two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await authApi.resetPassword({ token, password });
      navigate('/login', {
        replace: true,
        state: { message: 'Your password has been reset. Please sign in.' },
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main id="main" className="container" style={{ maxWidth: 440, paddingBlock: 'var(--s8)' }}>
        <div className="card stack">
          <div className="alert alert-error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>That reset link is incomplete. Please request a new one.</span>
          </div>
          <Link className="btn btn-primary btn-block" to="/forgot-password">
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="container" style={{ maxWidth: 440, paddingBlock: 'var(--s8)' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--s4)' }}>Choose a new password</h1>

      <form className="card stack" onSubmit={handleSubmit}>
        {error && (
          <div className="alert alert-error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="field-hint">At least 10 characters.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="confirm">
            Confirm new password
          </label>
          <input
            id="confirm"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>

        <p className="field-hint">
          Resetting your password signs you out on every device, in case someone else had access.
        </p>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </main>
  );
}
