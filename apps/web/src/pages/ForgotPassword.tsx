import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/endpoints.js';

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
      // address exists, and surfacing a network error here would leak timing
      // information the server works to hide.
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <main id="main" className="container" style={{ maxWidth: 440, paddingBlock: 'var(--s8)' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--s4)' }}>Reset your password</h1>

      {sent ? (
        <div className="card stack">
          <div className="alert alert-ok" role="status">
            <span aria-hidden="true">✓</span>
            <span>
              If that email has an account, a reset link is on its way. It expires in an hour.
            </span>
          </div>
          <Link className="btn btn-secondary btn-block" to="/login">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="card stack" onSubmit={handleSubmit}>
          <p className="muted">
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
          <div style={{ textAlign: 'center' }}>
            <Link to="/login">Back to sign in</Link>
          </div>
        </form>
      )}
    </main>
  );
}
