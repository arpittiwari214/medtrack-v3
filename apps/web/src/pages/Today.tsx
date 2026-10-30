/**
 * Today's doses.
 *
 * Built around one question: *what do I take next?* That gets a single dominant
 * block; everything else is subordinate. The rest of the day is a schedule rail
 * — time down a left spine with state dots — which is the shape of a medication
 * chart rather than a stack of cards.
 *
 * Actions are optimistic and roll back on failure. Waiting on a round trip to
 * confirm something the patient physically just did feels broken.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SNOOZE_PRESETS,
  describeMedicine,
  formatTimeFor,
  isLowStock,
  type Appointment,
  type DoseEvent,
} from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import {
  alertsApi,
  appointmentsApi,
  dosesApi,
  medicinesApi,
  type MedicineWithStock,
  type TodayResponse,
} from '../api/endpoints.js';
import { ColorDot } from '../components/recognition.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner, Modal, Spinner } from '../components/ui.js';
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Info,
  Package,
  Pill,
  SkipForward,
  Undo,
} from '../components/icons.js';
import { useT, type StringKey } from '../i18n/index.js';
import './today.css';

type T = ReturnType<typeof useT>['t'];

export default function Today() {
  const { user } = useAuth();
  const { t, locale, date } = useT();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [snoozeTarget, setSnoozeTarget] = useState<DoseEvent | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [medicines, setMedicines] = useState<Map<string, MedicineWithStock>>(new Map());
  const [nextVisit, setNextVisit] = useState<Appointment | null | undefined>(undefined);

  const load = useCallback(async () => {
    setError('');
    try {
      // Doses drive the screen; medicines and visits enrich it. A failure in
      // either of those must not blank the dose list.
      const [today, meds, visits] = await Promise.allSettled([
        dosesApi.today(),
        medicinesApi.list(),
        appointmentsApi.list('upcoming'),
      ]);
      if (today.status === 'rejected') throw today.reason;
      setData(today.value);
      if (meds.status === 'fulfilled') {
        setMedicines(new Map(meds.value.medicines.map((m) => [m.id, m])));
      }
      if (visits.status === 'fulfilled') setNextVisit(visits.value.appointments[0] ?? null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('today_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const ordered = useMemo(() => {
    if (!data) return [];
    return [...data.upcoming, ...data.taken, ...data.missed, ...data.skipped].sort((a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt),
    );
  }, [data]);

  /** The earliest dose still needing action. A missed one outranks an upcoming one. */
  const focus = useMemo(() => {
    if (!data) return null;
    const byTime = (list: DoseEvent[]) =>
      [...list].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return byTime(data.missed)[0] ?? byTime(data.upcoming)[0] ?? null;
  }, [data]);

  async function act(dose: DoseEvent, action: 'take' | 'skip' | 'undo') {
    if (!data) return;
    const previous = data;

    setData({
      ...data,
      upcoming: data.upcoming.filter((d) => d.id !== dose.id),
      missed: data.missed.filter((d) => d.id !== dose.id),
      taken: action === 'take' ? [...data.taken, { ...dose, status: 'taken' }] : data.taken,
    });

    try {
      if (action === 'take') await dosesApi.take(dose.id);
      else if (action === 'skip') await dosesApi.skip(dose.id);
      else await dosesApi.undo(dose.id);
      await load();
    } catch (caught) {
      setData(previous);
      setError(caught instanceof ApiError ? caught.message : t('change_not_saved'));
    }
  }

  async function snooze(dose: DoseEvent, minutes: number) {
    setSnoozeTarget(null);
    try {
      await dosesApi.snooze(dose.id, minutes);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('snooze_failed'));
    }
  }

  if (loading) return <Spinner label={t('loading_today')} />;
  if (error && !data) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return null;

  const total = ordered.length;
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <div>
      <header className="screen-head">
        <div>
          <p className="micro numeric">{date(data.date, 'long')}</p>
          <h1 className="t-title mt-2">
            {t(greetingKey())}
            {firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <button type="button" className="sos-button" onClick={() => setSosOpen(true)}>
          <AlertTriangle size={16} />
          SOS
        </button>
      </header>

      {error && <ErrorBanner message={error} />}

      {total === 0 ? (
        <div className="empty">
          <div className="empty-mark">
            <Pill size={22} />
          </div>
          <h2 className="t-lg">{t('today_empty_title')}</h2>
          <p className="muted t-sm mt-2 mb-4">{t('today_empty_body')}</p>
          <Link className="btn btn-primary" to="/app/medicines/new">
            {t('add_a_medicine')}
          </Link>
        </div>
      ) : focus ? (
        <NextDose
          dose={focus}
          medicine={medicines.get(focus.medicineId)}
          onTake={() => act(focus, 'take')}
          onSnooze={() => setSnoozeTarget(focus)}
          onSkip={() => act(focus, 'skip')}
        />
      ) : (
        <div className="empty">
          <div className="empty-mark" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
            <Check size={22} />
          </div>
          <h2 className="t-lg">{t('today_done_title')}</h2>
          <p className="muted t-sm mt-2">{t('today_done_body', { taken: data.taken.length, total })}</p>
        </div>
      )}

      <CarePanel medicines={[...medicines.values()]} nextVisit={nextVisit} />

      {total > 0 && (
        <>
          <div className="day-progress">
            <span className="micro">{t('today_label')}</span>
            <div
              className="day-segments"
              role="img"
              aria-label={t('today_done_body', { taken: data.taken.length, total })}
            >
              {ordered.map((dose) => (
                <span key={dose.id} className={`day-segment day-segment-${dose.status}`} />
              ))}
            </div>
            <span className="t-xs numeric muted">
              {/* Taken, not "dealt with": four missed doses once read as 4/5. */}
              {data.taken.length}/{total}
            </span>
          </div>

          <div className="section-head">
            <h2 className="micro">{t('schedule')}</h2>
          </div>

          <div>
            {ordered.map((dose) => (
              <RailRow
                key={dose.id}
                dose={dose}
                medicine={medicines.get(dose.medicineId)}
                onUndo={() => act(dose, 'undo')}
                onTake={() => act(dose, 'take')}
              />
            ))}
          </div>
        </>
      )}

      {snoozeTarget && (
        <Modal title={t('snooze_named', { name: snoozeTarget.medicineName })} onClose={() => setSnoozeTarget(null)}>
          <p className="muted t-sm mb-4">{t('snooze_body_web')}</p>
          <div className="snooze-grid">
            {SNOOZE_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="snooze-option"
                onClick={() => snooze(snoozeTarget, minutes)}
              >
                {t('minutes_short', { n: minutes })}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {sosOpen && <SosModal onClose={() => setSosOpen(false)} />}
    </div>
  );
}

function NextDose({
  dose,
  medicine,
  onTake,
  onSnooze,
  onSkip,
}: {
  dose: DoseEvent;
  medicine: MedicineWithStock | undefined;
  onTake: () => void;
  onSnooze: () => void;
  onSkip: () => void;
}) {
  const { t, locale } = useT();
  const overdue = dose.status === 'missed';
  // A scheduled dose already past its time is not "next" — it is due now.
  const pastDue = !overdue && new Date(dose.scheduledAt).getTime() < Date.now();

  return (
    <section className={`panel${dose.isCritical ? ' panel-critical' : ''}`}>
      <div className="panel-head">
        <span className="micro">{t(overdue ? 'overdue' : pastDue ? 'due_now' : 'next_dose')}</span>
        <span className="t-xs muted numeric">{relativeTo(dose.scheduledAt, t)}</span>
      </div>

      <div className="panel-pad">
        {/* What the patient sees on the strip leads; the name supports it. */}
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <ColorDot color={medicine?.pillColor} size={22} />
          <ColorDot color={medicine?.stripColor} size={22} />
          <h2 className="next-dose-name">
            {medicine ? describeMedicine(medicine, locale) : dose.medicineName}
          </h2>
        </div>
        <p className="next-dose-meta">
          {medicine && describeMedicine(medicine, locale) !== dose.medicineName ? `${dose.medicineName} · ` : ''}
          {dose.medicineStrength ? `${dose.medicineStrength} · ` : ''}
          {formatTimeFor(dose.localTime, locale)}
          {dose.isCritical && ` · ${t('critical')}`}
        </p>

        {overdue && (
          <p className="next-dose-note">
            <AlertTriangle size={16} />
            <span>{t('overdue_note')}</span>
          </p>
        )}
      </div>

      <div className="next-dose-actions">
        <button type="button" className="action-primary" onClick={onTake}>
          <Check size={20} />
          {t('mark_taken')}
        </button>
        <div className="split">
          <button type="button" className="action-secondary" onClick={onSnooze}>
            <Clock size={16} />
            {t('snooze')}
          </button>
          <button type="button" className="action-secondary" onClick={onSkip}>
            <SkipForward size={16} />
            {t('skip')}
          </button>
        </div>
      </div>
    </section>
  );
}

function RailRow({
  dose,
  medicine,
  onUndo,
  onTake,
}: {
  dose: DoseEvent;
  medicine: MedicineWithStock | undefined;
  onUndo: () => void;
  onTake: () => void;
}) {
  const { t, locale } = useT();
  const resolved = dose.status === 'taken' || dose.status === 'skipped';
  const label = t(`state_${dose.status}` as StringKey);
  const time = formatTimeFor(dose.localTime, locale);

  return (
    <button
      type="button"
      className="rail-row"
      onClick={resolved ? onUndo : onTake}
      aria-label={t('rail_label', {
        name: dose.medicineName,
        time,
        state: label,
        action: t(resolved ? 'undo' : 'mark_taken'),
      })}
    >
      <span className="rail-time">{time}</span>
      <span className="rail-marker">
        <span className={`rail-dot rail-dot-${dose.status}`} />
      </span>
      <span className="rail-name">
        <ColorDot color={medicine?.pillColor} />{' '}
        {medicine?.person ? `${medicine.person}: ` : ''}
        {dose.medicineName} <span className="rail-strength">{dose.medicineStrength}</span>
        {medicine?.purpose && <span className="purpose-tag">{medicine.purpose}</span>}
        {dose.isCritical && <span className="rail-critical" aria-label={t('critical')} />}
      </span>
      <span className={`rail-state rail-state-${dose.status}`}>
        {resolved ? <Undo size={15} /> : label}
      </span>
    </button>
  );
}

function SosModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const response = await alertsApi.sos(message || undefined);
      setResult(response.message);
    } catch (caught) {
      setResult(caught instanceof ApiError ? caught.message : t('sos_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('sos_title')} onClose={onClose}>
      {result ? (
        <div className="stack">
          <div className="alert alert-info" role="status">
            <Info size={18} />
            <span>{result}</span>
          </div>
          {/* Said plainly: this is not an emergency service, and someone in
              trouble must not be left believing that it is. */}
          <p className="muted t-sm">{t('sos_not_emergency')}</p>
          <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      ) : (
        <div className="stack">
          <p className="muted t-sm">{t('sos_body')}</p>
          <div className="field">
            <label className="label" htmlFor="sos-message">
              {t('sos_message')}
            </label>
            <textarea
              id="sos-message"
              className="textarea"
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <button type="button" className="btn btn-danger btn-block btn-lg" onClick={send} disabled={busy}>
            {t(busy ? 'sending' : 'sos_send')}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      )}
    </Modal>
  );
}

/**
 * Supply and the next visit, on the home screen.
 *
 * In India the bigger failure is not a missed evening dose but falling out of
 * care: running out and not refilling, or never going back to the doctor —
 * 43% of patients in one national programme never returned for a first
 * follow-up. So these sit next to the doses rather than in a menu.
 */
function CarePanel({
  medicines,
  nextVisit,
}: {
  medicines: MedicineWithStock[];
  /** undefined while unknown, null when nothing is booked. */
  nextVisit: Appointment | null | undefined;
}) {
  const { t, locale, date } = useT();
  const running = medicines
    .filter((m) => !m.archivedAt && m.stock && isLowStock(m))
    .sort((a, b) => (a.projectedRunOut ?? '9999').localeCompare(b.projectedRunOut ?? '9999'))
    .slice(0, 3);

  if (running.length === 0 && nextVisit === undefined) return null;

  return (
    <section className="panel mt-4" aria-label={t('supply_visits')}>
      <div className="panel-head">
        <span className="micro">{t('supply_visits')}</span>
      </div>
      <div className="list" style={{ border: 'none', borderRadius: 0 }}>
        {running.map((m) => (
          <Link key={m.id} to="/app/medicines" className="list-row list-row-link">
            <Package size={18} />
            <span className="flex-1">
              <span className="list-title">
                <ColorDot color={m.pillColor} /> {m.name}
              </span>
              <span className="subtle" style={{ display: 'block' }}>
                {t(m.dosesRemaining === 1 ? 'doses_left_one' : 'doses_left_other', { n: m.dosesRemaining ?? 0 })}
                {m.projectedRunOut && t('runs_out_suffix', { date: date(m.projectedRunOut) })}
              </span>
            </span>
            <span className="badge badge-warn">{t('refill')}</span>
          </Link>
        ))}

        {nextVisit === null && (
          <Link to="/app/appointments" className="list-row list-row-link">
            <Calendar size={18} />
            <span className="flex-1">
              <span className="list-title">{t('no_visit')}</span>
              <span className="subtle" style={{ display: 'block' }}>
                {t('no_visit_body')}
              </span>
            </span>
          </Link>
        )}

        {nextVisit && (
          <Link to="/app/appointments" className="list-row list-row-link">
            <Calendar size={18} />
            <span className="flex-1">
              <span className="list-title">{nextVisit.title}</span>
              <span className="subtle numeric" style={{ display: 'block' }}>
                {date(nextVisit.localDate)} · {formatTimeFor(nextVisit.localTime, locale)}
                {nextVisit.provider && ` · ${nextVisit.provider}`}
              </span>
            </span>
            {nextVisit.requiresFasting && <span className="badge badge-warn">{t('fasting')}</span>}
          </Link>
        )}
      </div>
    </section>
  );
}

function greetingKey(): StringKey {
  const hour = new Date().getHours();
  if (hour < 12) return 'greet_morning';
  if (hour < 17) return 'greet_afternoon';
  return 'greet_evening';
}

/** A duration is easier to act on than a clock time. */
function relativeTo(instant: string, t: T): string {
  const deltaMinutes = Math.round((new Date(instant).getTime() - Date.now()) / 60_000);
  const abs = Math.abs(deltaMinutes);
  if (abs < 1) return t('rel_now');

  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h > 0 ? t(m ? 'span_hours_minutes' : 'span_hours', { h, m }) : t('span_minutes', { m });
  return t(deltaMinutes > 0 ? 'rel_in' : 'rel_ago', { span });
}
