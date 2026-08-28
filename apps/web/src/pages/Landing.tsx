import { Link } from 'react-router-dom';

const FEATURES = [
  {
    icon: '⏰',
    title: 'Reminders that actually arrive',
    body: 'Notifications are scheduled on your device, so they fire on time whether or not the app is open, the phone is locked, or you have signal.',
  },
  {
    icon: '💤',
    title: 'Snooze that comes back',
    body: 'Ask for ten more minutes and the reminder returns in ten minutes. A deferred dose is never quietly dropped from the day.',
  },
  {
    icon: '📦',
    title: 'Know before you run out',
    body: 'Track how many doses you have left and get told while there is still time to order more — not the morning you take the last one.',
  },
  {
    icon: '👥',
    title: 'Caregivers, on your terms',
    body: 'Invite someone you trust and choose exactly what they can see. Withdraw it whenever you like, without asking them.',
  },
  {
    icon: '📈',
    title: 'Patterns, not scolding',
    body: 'See when doses actually slip — most people miss at a particular time of day — instead of a single number that only ever goes down.',
  },
  {
    icon: '🩺',
    title: 'Appointments and tests',
    body: 'Keep visits and lab tests alongside your medicines, with reminders the day before and an hour ahead.',
  },
];

export default function Landing() {
  return (
    <>
      <header className="site-header">
        <div className="container row-between" style={{ minHeight: 64 }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'var(--text)' }}>
            <strong style={{ fontSize: '1.125rem' }}>
              <span aria-hidden="true">💊</span> MedTrack
            </strong>
          </Link>
          <nav className="row" aria-label="Account">
            <Link className="btn btn-ghost btn-sm" to="/login">
              Sign in
            </Link>
            <Link className="btn btn-primary btn-sm" to="/signup">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="container hero">
          <p className="eyebrow">Medication adherence</p>
          <h1>Take the right medicine at the right time.</h1>
          <p className="lede" style={{ maxWidth: 620, marginInline: 'auto' }}>
            MedTrack keeps track of what you need to take and when, tells you before you run out,
            and quietly keeps the people who care about you in the loop — only as much as you want
            them to be.
          </p>
          <div
            className="row"
            style={{ justifyContent: 'center', marginTop: 'var(--s6)', flexWrap: 'wrap' }}
          >
            <Link className="btn btn-primary btn-lg" to="/signup">
              Get started — it’s free
            </Link>
            <Link className="btn btn-secondary btn-lg" to="/login">
              I already have an account
            </Link>
          </div>
          <p className="subtle" style={{ marginTop: 'var(--s4)' }}>
            No card required. Your data is yours — export or delete it whenever you want.
          </p>
        </section>

        <section className="container" style={{ paddingBottom: 'var(--s8)' }}>
          <div className="grid-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="feature-card">
                <div className="feature-icon" aria-hidden="true">
                  {feature.icon}
                </div>
                <h2 style={{ fontSize: '1.0625rem', marginBottom: 'var(--s2)' }}>{feature.title}</h2>
                <p className="muted" style={{ fontSize: '0.9375rem' }}>
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Stated plainly and early rather than buried in the terms. A tool that
            handles medication has to be clear about what it is not. */}
        <section className="container" style={{ paddingBottom: 'var(--s8)' }}>
          <div className="alert alert-warn" style={{ display: 'block', padding: 'var(--s5)' }}>
            <h2 style={{ fontSize: '1.0625rem', marginBottom: 'var(--s2)', color: 'inherit' }}>
              MedTrack is a reminder tool, not a medical device
            </h2>
            <p style={{ fontSize: '0.9375rem', color: 'inherit' }}>
              It does not give medical advice, and it should never be your only safeguard for a
              critical medication. Always follow the instructions from your doctor or pharmacist, and
              talk to them before changing anything about how you take a medicine.{' '}
              <Link to="/medical-disclaimer">Read the full disclaimer</Link>.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container stack">
          <ul className="footer-links">
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/terms">Terms of Service</Link>
            </li>
            <li>
              <Link to="/medical-disclaimer">Medical Disclaimer</Link>
            </li>
            <li>
              <Link to="/cookies">Cookies</Link>
            </li>
          </ul>
          <p className="subtle">
            © {new Date().getFullYear()} MedTrack. Built in India. Personal data is handled under the
            Digital Personal Data Protection Act, 2023.
          </p>
        </div>
      </footer>
    </>
  );
}
