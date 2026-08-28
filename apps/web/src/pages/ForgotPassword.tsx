import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/endpoints.js';
import { SuccessBanner } from '../components/ui.js';
import { Pill } from '../components/icons.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await authApi.forgotPassword({ email });
    } catch {
      // Deliberately ignored. The server answers identically whether or not the
      // address exists, and surfacing a network error here would leak the
      // timing information the server works to hide.
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <main id="main" className="auth-shell">
      <div className="auth-head">
        <Link to="/" className="brand-mark mb-4" aria-label="MedTrack home">
          <Pill size={20} />
          MedTrack
        </Link>
        <h1 className="t-title">Reset your password</h1>
      </div>

      {sent ? (
        <div className="panel panel-pad stack">
          <SuccessBanner message="If that email has an account, a reset link is on its way. It expires in an hour." />
          <Link className="btn btn-secondary btn-block" to="/login">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="panel panel-pad stack" onSubmit={handleSubmit}>
          <p className="muted t-sm">
            Enter your email address and we’ll send you a link to choose a new password.
          </p>
          <div className="field">
            <label className="label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <div className="center">
            <Link className="t-sm" to="/login">
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
