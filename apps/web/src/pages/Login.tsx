import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner } from '../components/ui.js';
import { Pill } from '../components/icons.js';
import { interleave, useT } from '../i18n/index.js';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const returnTo = (location.state as { from?: string } | null)?.from ?? '/app';
  const notice = (location.state as { message?: string } | null)?.message;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(returnTo, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : t('server_unreachable'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="auth-shell">
      <div className="auth-head">
        <Link to="/" className="brand-mark mb-4" aria-label={t('medtrack_home')}>
          <Pill size={20} />
          MedTrack
        </Link>
        <h1 className="t-title">{t('welcome_back')}</h1>
        <p className="muted t-sm mt-2">{t('sign_in_sub')}</p>
      </div>

      {notice && (
        <div className="alert alert-ok mb-4" role="status">
          <span>{notice}</span>
        </div>
      )}

      <form className="panel panel-pad stack" onSubmit={handleSubmit} noValidate>
        {error && <ErrorBanner message={error} />}

        <div className="field">
          <label className="label" htmlFor="email">
            {t('email')}
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
            {t('password')}
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
          {t(busy ? 'signing_in' : 'sign_in')}
        </button>

        <div className="center">
          <Link className="t-sm" to="/forgot-password">
            {t('forgot_password')}
          </Link>
        </div>
      </form>

      <p className="center muted t-sm mt-5">
        {interleave(t('no_account'), { link: <Link to="/signup">{t('create_one')}</Link> })}
      </p>
    </main>
  );
}
