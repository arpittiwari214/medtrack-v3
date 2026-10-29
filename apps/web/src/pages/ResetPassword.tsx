import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { authApi } from '../api/endpoints.js';
import { ErrorBanner, PasswordInput } from '../components/ui.js';
import { Pill } from '../components/icons.js';
import { useT } from '../i18n/index.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useT();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(t('passwords_differ'));
      return;
    }

    setBusy(true);
    try {
      await authApi.resetPassword({ token, password });
      navigate('/login', {
        replace: true,
        state: { message: t('password_was_reset') },
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('something_wrong'));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main id="main" className="auth-shell">
        <div className="panel panel-pad stack">
          <ErrorBanner message={t('reset_incomplete')} />
          <Link className="btn btn-primary btn-block" to="/forgot-password">
            {t('request_new_link')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="auth-shell">
      <div className="auth-head">
        <Link to="/" className="brand-mark mb-4" aria-label={t('medtrack_home')}>
          <Pill size={20} />
          MedTrack
        </Link>
        <h1 className="t-title">{t('choose_new_password')}</h1>
      </div>

      <form className="panel panel-pad stack" onSubmit={handleSubmit}>
        {error && <ErrorBanner message={error} />}

        <div className="field">
          <label className="label" htmlFor="password">
            {t('new_password')}
          </label>
          <PasswordInput
            id="password"
            className="input"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="field-hint">{t('password_min')}</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="confirm">
            {t('confirm_new_password')}
          </label>
          <PasswordInput
            id="confirm"
            className="input"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>

        <p className="field-hint">{t('reset_signs_out')}</p>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {t(busy ? 'saving' : 'set_new_password')}
        </button>
      </form>
    </main>
  );
}
