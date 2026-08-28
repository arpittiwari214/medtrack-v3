import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { authApi } from '../api/endpoints.js';
import { ErrorBanner } from '../components/ui.js';
import { Pill } from '../components/icons.js';

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
      <main id="main" className="auth-shell">
        <div className="panel panel-pad stack">
          <ErrorBanner message="That reset link is incomplete. Please request a new one." />
          <Link className="btn btn-primary btn-block" to="/forgot-password">
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="auth-shell">
      <div className="auth-head">
        <Link to="/" className="brand-mark mb-4" aria-label="MedTrack home">
          <Pill size={20} />
          MedTrack
        </Link>
        <h1 className="t-title">Choose a new password</h1>
      </div>

      <form className="panel panel-pad stack" onSubmit={handleSubmit}>
        {error && <ErrorBanner message={error} />}

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
