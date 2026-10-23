import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/endpoints.js';
import { SuccessBanner } from '../components/ui.js';
import { Pill } from '../components/icons.js';
import { useT } from '../i18n/index.js';

export default function ForgotPassword() {
  const { t } = useT();
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
        <Link to="/" className="brand-mark mb-4" aria-label={t('medtrack_home')}>
          <Pill size={20} />
          MedTrack
        </Link>
        <h1 className="t-title">{t('reset_title')}</h1>
      </div>

      {sent ? (
        <div className="panel panel-pad stack">
          <SuccessBanner message={t('reset_sent')} />
          <Link className="btn btn-secondary btn-block" to="/login">
            {t('back_to_sign_in')}
          </Link>
        </div>
      ) : (
        <form className="panel panel-pad stack" onSubmit={handleSubmit}>
          <p className="muted t-sm">{t('reset_intro')}</p>
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
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {t(busy ? 'sending' : 'send_reset')}
          </button>
          <div className="center">
            <Link className="t-sm" to="/login">
              {t('back_to_sign_in')}
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
