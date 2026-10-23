import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner } from '../components/ui.js';
import { Pill } from '../components/icons.js';

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
      setError('MedTrack accounts are for people aged 18 or over.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
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
      });
      navigate('/app', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(Object.fromEntries(caught.issues.map((i) => [i.path, i.message])));
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="auth-shell">
      <div className="auth-head">
        <Link to="/" className="brand-mark mb-4" aria-label="MedTrack home">
          <Pill size={20} />
          MedTrack
        </Link>
        <h1 className="t-title">Create your account</h1>
      </div>

      <form className="panel panel-pad stack" onSubmit={handleSubmit} noValidate>
        {error && <ErrorBanner message={error} />}

        <div className="field">
          <label className="label" htmlFor="name">
            Your name
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
            Email address
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
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            aria-invalid={Boolean(fieldErrors['password'])}
            onChange={(event) => update('password', event.target.value)}
          />
          {fieldErrors['password'] ? (
            <span className="field-error">{fieldErrors['password']}</span>
          ) : (
            <span className="field-hint">
              At least 10 characters. Length matters far more than symbols — a short phrase you can
              remember beats a scrambled word.
            </span>
          )}
        </div>

        <fieldset className="field">
          <legend className="label">Who will take these medicines?</legend>
          <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
            {(
              [
                ['self', 'Me'],
                ['family', 'A parent or another adult I look after'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="slot-toggle"
                aria-pressed={setupFor === value}
                onClick={() => setSetupFor(setupFor === value ? null : value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="field-hint">Optional. It helps us build for the people who use MedTrack.</span>
        </fieldset>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={confirmedAdult}
            onChange={(event) => setConfirmedAdult(event.target.checked)}
          />
          <span className="t-sm">I am 18 or older.</span>
        </label>

        {/* Never pre-ticked. Consent that was assumed is not consent. */}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          <span className="t-sm">
            I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and{' '}
            <Link to="/privacy" target="_blank">Privacy Policy</Link>, including MedTrack storing
            information about my medicines so it can remind me.
          </span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={marketingEmail}
            onChange={(event) => setMarketingEmail(event.target.checked)}
          />
          <span className="t-sm muted">
            Occasional email about new features. Entirely optional, and you can stop it any time.
          </span>
        </label>

        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p className="center muted t-sm mt-5">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
