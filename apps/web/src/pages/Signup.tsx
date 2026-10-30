import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner, PasswordInput } from '../components/ui.js';
import { Pill } from '../components/icons.js';
import { interleave, useT } from '../i18n/index.js';

/** The browser's own zone is the right default and is almost always correct. */
function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  // Set by the caregiver invitation, so a new caregiver lands back on it.
  const returnTo = (useLocation().state as { from?: string } | null)?.from ?? '/app';
  const { t, locale } = useT();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [setupFor, setSetupFor] = useState<'self' | 'family' | null>(null);
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => ({ ...previous, [key]: '' }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    if (!confirmedAdult) {
      setError(t('adults_only'));
      return;
    }
    if (!acceptedTerms) {
      setError(t('accept_terms_first'));
      return;
    }

    setBusy(true);
    try {
      await signUp({
        ...form,
        timezone: detectTimeZone(),
        confirmedAdult: true,
        setupFor,
        acceptedTerms: true,
        acceptedPrivacy: true,
        marketingEmail,
        language: locale,
      });
      navigate(returnTo, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(Object.fromEntries(caught.issues.map((i) => [i.path, i.message])));
      } else {
        setError(t('server_unreachable'));
      }
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
        <h1 className="t-title">{t('create_your_account')}</h1>
      </div>

      <form className="panel panel-pad stack" onSubmit={handleSubmit} noValidate>
        {error && <ErrorBanner message={error} />}

        <div className="field">
          <label className="label" htmlFor="name">
            {t('your_name')}
          </label>
          <input
            id="name"
            className="input"
            autoComplete="name"
            required
            value={form.name}
            aria-invalid={Boolean(fieldErrors['name'])}
            onChange={(event) => update('name', event.target.value)}
          />
          {fieldErrors['name'] && <span className="field-error">{fieldErrors['name']}</span>}
        </div>

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
            value={form.email}
            aria-invalid={Boolean(fieldErrors['email'])}
            onChange={(event) => update('email', event.target.value)}
          />
          {fieldErrors['email'] && <span className="field-error">{fieldErrors['email']}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="password">
            {t('password')}
          </label>
          <PasswordInput
            id="password"
            className="input"
            autoComplete="new-password"
            required
            value={form.password}
            aria-invalid={Boolean(fieldErrors['password'])}
            onChange={(event) => update('password', event.target.value)}
          />
          {fieldErrors['password'] ? (
            <span className="field-error">{fieldErrors['password']}</span>
          ) : (
            <span className="field-hint">{t('password_hint')}</span>
          )}
        </div>

        <fieldset className="field">
          <legend className="label">{t('who_takes_these')}</legend>
          <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
            {(
              [
                ['self', 'setup_self'],
                ['family', 'setup_family'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="slot-toggle"
                aria-pressed={setupFor === value}
                onClick={() => setSetupFor(setupFor === value ? null : value)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <span className="field-hint">{t('setup_hint')}</span>
        </fieldset>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={confirmedAdult}
            onChange={(event) => setConfirmedAdult(event.target.checked)}
          />
          <span className="t-sm">{t('i_am_adult')}</span>
        </label>

        {/* Never pre-ticked. Consent that was assumed is not consent. */}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          <span className="t-sm">
            {interleave(t('agree_terms'), {
              terms: (
                <Link to="/terms" target="_blank">
                  {t('terms_of_service')}
                </Link>
              ),
              privacy: (
                <Link to="/privacy" target="_blank">
                  {t('privacy_policy')}
                </Link>
              ),
            })}
          </span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={marketingEmail}
            onChange={(event) => setMarketingEmail(event.target.checked)}
          />
          <span className="t-sm muted">
            {t('marketing_optin')}
          </span>
        </label>

        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
          {t(busy ? 'creating_account' : 'create_account_btn')}
        </button>
      </form>

      <p className="center muted t-sm mt-5">
        {interleave(t('have_account'), { link: <Link to="/login">{t('sign_in')}</Link> })}
      </p>
    </main>
  );
}
