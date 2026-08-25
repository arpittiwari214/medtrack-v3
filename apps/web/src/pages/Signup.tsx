import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

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

    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setBusy(true);
    try {
      await signUp({
        ...form,
        timezone: detectTimeZone(),
        // One checkbox covers both documents, and both consents are recorded
        // server-side with the version agreed to.
        acceptedTerms: true,
        acceptedPrivacy: true,
        marketingEmail,
      });
      navigate('/app', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(
          Object.fromEntries(caught.issues.map((issue) => [issue.path, issue.message])),
        );
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="container" style={{ maxWidth: 460, paddingBlock: 'var(--s7)' }}>
      <div className="stack" style={{ textAlign: 'center', marginBottom: 'var(--s5)' }}>
        <Link to="/" style={{ textDecoration: 'none', fontSize: '2rem' }} aria-label="MedTrack home">
          💊
        </Link>
        <h1 style={{ fontSize: '1.5rem' }}>Create your account</h1>
      </div>

      <form className="card stack" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

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

        {/* Never pre-ticked. Consent that was assumed is not consent. */}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          <span style={{ fontSize: '0.9375rem' }}>
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
          <span style={{ fontSize: '0.9375rem' }} className="muted">
            Occasional email about new features. Entirely optional, and you can stop it any time.
          </span>
        </label>

        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 'var(--s5)' }} className="muted">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
