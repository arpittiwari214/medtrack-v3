import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, Chart, Clock, Package, Pill, Stethoscope, Users } from '../components/icons.js';
import './landing.css';

const FEATURES = [
  {
    Icon: Bell,
    name: 'Reminders that arrive',
    body: 'Notifications are scheduled on your device, so they fire on time whether or not the app is open, the phone is locked, or you have signal.',
  },
  {
    Icon: Clock,
    name: 'Snooze that comes back',
    body: 'Ask for ten more minutes and the reminder returns in ten minutes. A deferred dose is never quietly dropped from the day.',
  },
  {
    Icon: Package,
    name: 'Know before you run out',
    body: 'Track how many doses you have left and get told while there is still time to order more — not on the morning you take the last one.',
  },
  {
    Icon: Users,
    name: 'Caregivers, on your terms',
    body: 'Invite someone you trust and choose exactly what they can see. Withdraw it whenever you like, without asking them first.',
  },
  {
    Icon: Chart,
    name: 'Patterns, not scolding',
    body: 'See when doses actually slip — most people miss at a particular time of day — instead of one number that only ever goes down.',
  },
  {
    Icon: Stethoscope,
    name: 'Appointments and tests',
    body: 'Keep visits and lab tests alongside your medicines, with reminders the day before and an hour ahead.',
  },
];

/** A real fragment of the app, using the same rail markup the product uses. */
const PREVIEW_DOSES = [
  { time: '8:00 AM', name: 'Metformin', strength: '500 mg', status: 'taken', state: 'Taken' },
  { time: '9:00 AM', name: 'Amlodipine', strength: '5 mg', status: 'taken', state: 'Taken' },
  { time: '2:00 PM', name: 'Vitamin D', strength: '1000 IU', status: 'snoozed', state: 'Snoozed' },
  { time: '9:00 PM', name: 'Metformin', strength: '500 mg', status: 'scheduled', state: 'Due' },
  { time: '10:00 PM', name: 'Atorvastatin', strength: '10 mg', status: 'scheduled', state: 'Due' },
];

export default function Landing() {
  return (
    <>
      <header className="site-header">
        <div className="container row-between" style={{ minHeight: 64 }}>
          <Link to="/" className="brand-mark">
            <Pill size={20} />
            MedTrack
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
          <div>
            <p className="micro">Medication adherence</p>
            <h1>Take the right medicine at the right time.</h1>
            <p className="hero-lede">
              MedTrack keeps track of what you need to take and when, tells you before you run out,
              and quietly keeps the people who care about you in the loop — only as much as you want
              them to be.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/signup">
                Get started — it’s free
              </Link>
              <Link className="btn btn-secondary btn-lg" to="/login">
                I have an account
              </Link>
            </div>
            <p className="subtle mt-4">
              No card required. Your data is yours — export or delete it whenever you want.
            </p>
          </div>

          {/* The preview is the product, not an illustration of it. */}
          <div className="preview" aria-hidden="true">
            <div className="preview-chrome">
              <span className="preview-dot" />
              <span className="preview-dot" />
              <span className="preview-dot" />
              <span className="micro" style={{ marginLeft: 'auto' }}>
                Today
              </span>
            </div>
            <div className="preview-body">
              <div className="day-progress" style={{ marginTop: 0 }}>
                <span className="micro">Today</span>
                <div className="day-segments">
                  <span className="day-segment day-segment-taken" />
                  <span className="day-segment day-segment-taken" />
                  <span className="day-segment" />
                  <span className="day-segment" />
                  <span className="day-segment" />
                </div>
                <span className="t-xs numeric muted">2/5</span>
              </div>

              {PREVIEW_DOSES.map((dose) => (
                <div key={dose.time + dose.name} className="rail-row rail-row-static">
                  <span className="rail-time">{dose.time}</span>
                  <span className="rail-marker">
                    <span className={`rail-dot rail-dot-${dose.status}`} />
                  </span>
                  <span className="rail-name">
                    {dose.name} <span className="rail-strength">{dose.strength}</span>
                  </span>
                  <span className={`rail-state rail-state-${dose.status}`}>{dose.state}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container" style={{ paddingBottom: 'var(--s8)' }}>
          <div className="section-head">
            <h2 className="micro">What it does</h2>
          </div>

          {FEATURES.map(({ Icon, name, body }) => (
            <article key={name} className="feature-row">
              <Icon size={22} />
              <h3 className="feature-name">{name}</h3>
              <p className="feature-body">{body}</p>
            </article>
          ))}
        </section>

        {/* Stated plainly and early rather than buried in the terms. A tool that
            handles medication has to be clear about what it is not. */}
        <section className="container" style={{ paddingBottom: 'var(--s8)' }}>
          <div className="alert alert-warn">
            <AlertTriangle size={20} />
            <div>
              <strong>MedTrack is a reminder tool, not a medical device.</strong>
              <p className="mt-2">
                It does not give medical advice, and it should never be your only safeguard for a
                critical medication. Always follow the instructions from your doctor or pharmacist,
                and talk to them before changing anything about how you take a medicine.{' '}
                <Link to="/medical-disclaimer">Read the full disclaimer</Link>.
              </p>
            </div>
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
