import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const returnTo = (location.state as { from?: string } | null)?.from ?? '/app';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(returnTo, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="container" style={{ maxWidth: 440, paddingBlock: 'var(--s8)' }}>
      <div className="stack" style={{ textAlign: 'center', marginBottom: 'var(--s6)' }}>
        <Link to="/" style={{ textDecoration: 'none', fontSize: '2rem' }} aria-label="MedTrack home">
          💊
        </Link>
        <h1 style={{ fontSize: '1.5rem' }}>Welcome back</h1>
        <p className="muted">Sign in to see today’s doses.</p>
      </div>

      <form className="card stack" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

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

        <div className="field">
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <Link to="/forgot-password">Forgot your password?</Link>
        </div>
      </form>

      <p style={{ textAlign: 'center', marginTop: 'var(--s5)' }} className="muted">
        Don’t have an account? <Link to="/signup">Create one</Link>
      </p>
    </main>
  );
}
