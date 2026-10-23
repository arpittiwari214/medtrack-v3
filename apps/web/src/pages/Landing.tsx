import { Link } from 'react-router-dom';
import { formatTimeFor, type DoseStatus } from '@medtrack/shared';
import { AlertTriangle, Bell, Chart, Clock, Package, Pill, Stethoscope, Users } from '../components/icons.js';
import { useT } from '../i18n/index.js';
import './landing.css';

const FEATURES = [
  { Icon: Bell, key: 'feat_reminders' },
  { Icon: Clock, key: 'feat_snooze' },
  { Icon: Package, key: 'feat_supply' },
  { Icon: Users, key: 'feat_caregivers' },
  { Icon: Chart, key: 'feat_patterns' },
  { Icon: Stethoscope, key: 'feat_visits' },
] as const;

/** A real fragment of the app, using the same rail markup the product uses. */
const PREVIEW_DOSES: { time: string; name: string; strength: string; status: DoseStatus }[] = [
  { time: '08:00', name: 'Metformin', strength: '500 mg', status: 'taken' },
  { time: '09:00', name: 'Amlodipine', strength: '5 mg', status: 'taken' },
  { time: '14:00', name: 'Vitamin D', strength: '1000 IU', status: 'snoozed' },
  { time: '21:00', name: 'Metformin', strength: '500 mg', status: 'scheduled' },
  { time: '22:00', name: 'Atorvastatin', strength: '10 mg', status: 'scheduled' },
];

export default function Landing() {
  const { t, locale, setPreference } = useT();
  return (
    <>
      <header className="site-header">
        <div className="container row-between" style={{ minHeight: 64 }}>
          <Link to="/" className="brand-mark">
            <Pill size={20} />
            MedTrack
          </Link>
          <nav className="row" aria-label={t('nav_account')}>
            {/* Each label is written in its own language, so it can be found by someone who reads only that one. */}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label={t('switch_language')}
              lang={locale === 'hi' ? 'en' : 'hi'}
              onClick={() => setPreference(locale === 'hi' ? 'en' : 'hi')}
            >
              {locale === 'hi' ? 'English' : 'हिन्दी'}
            </button>
            <Link className="btn btn-ghost btn-sm" to="/login">
              {t('sign_in')}
            </Link>
            <Link className="btn btn-primary btn-sm" to="/signup">
              {t('create_account_btn')}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="container hero">
          <div>
            <p className="micro">{t('hero_eyebrow')}</p>
            <h1>{t('hero_title')}</h1>
            <p className="hero-lede">{t('hero_lede')}</p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/signup">
                {t('get_started')}
              </Link>
              <Link className="btn btn-secondary btn-lg" to="/login">
                {t('have_account_btn')}
              </Link>
            </div>
            <p className="subtle mt-4">{t('no_card')}</p>
          </div>

          {/* The preview is the product, not an illustration of it. */}
          <div className="preview" aria-hidden="true">
            <div className="preview-chrome">
              <span className="preview-dot" />
              <span className="preview-dot" />
              <span className="preview-dot" />
              <span className="micro" style={{ marginLeft: 'auto' }}>
                {t('today_label')}
              </span>
            </div>
            <div className="preview-body">
              <div className="day-progress" style={{ marginTop: 0 }}>
                <span className="micro">{t('today_label')}</span>
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
                  <span className="rail-time">{formatTimeFor(dose.time, locale)}</span>
                  <span className="rail-marker">
                    <span className={`rail-dot rail-dot-${dose.status}`} />
                  </span>
                  <span className="rail-name">
                    {dose.name} <span className="rail-strength">{dose.strength}</span>
                  </span>
                  <span className={`rail-state rail-state-${dose.status}`}>{t(`state_${dose.status}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container" style={{ paddingBottom: 'var(--s8)' }}>
          <div className="section-head">
            <h2 className="micro">{t('what_it_does')}</h2>
          </div>

          {FEATURES.map(({ Icon, key }) => (
            <article key={key} className="feature-row">
              <Icon size={22} />
              <h3 className="feature-name">{t(key)}</h3>
              <p className="feature-body">{t(`${key}_b`)}</p>
            </article>
          ))}
        </section>

        {/* Stated plainly and early rather than buried in the terms. A tool that
            handles medication has to be clear about what it is not. */}
        <section className="container" style={{ paddingBottom: 'var(--s8)' }}>
          <div className="alert alert-warn">
            <AlertTriangle size={20} />
            <div>
              <strong>{t('not_a_device')}</strong>
              <p className="mt-2">
                {t('not_advice')} <Link to="/medical-disclaimer">{t('read_disclaimer')}</Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container stack">
          <ul className="footer-links">
            <li>
              <Link to="/privacy">{t('privacy_policy')}</Link>
            </li>
            <li>
              <Link to="/terms">{t('terms_of_service')}</Link>
            </li>
            <li>
              <Link to="/medical-disclaimer">{t('medical_disclaimer')}</Link>
            </li>
            <li>
              <Link to="/cookies">{t('cookies')}</Link>
            </li>
          </ul>
          <p className="subtle">{t('footer_note', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </>
  );
}
