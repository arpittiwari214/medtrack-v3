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
import { SNOOZE_PRESETS, formatTime12h, type DoseEvent, type DoseStatus } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { alertsApi, dosesApi, type TodayResponse } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner, Modal, Spinner } from '../components/ui.js';
import { AlertTriangle, Check, Clock, Info, Pill, SkipForward, Undo } from '../components/icons.js';
import './today.css';

const STATE_LABEL: Record<DoseStatus, string> = {
  taken: 'Taken',
  missed: 'Missed',
  snoozed: 'Snoozed',
  skipped: 'Skipped',
  scheduled: 'Due',
};

export default function Today() {
  const { user } = useAuth();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [snoozeTarget, setSnoozeTarget] = useState<DoseEvent | null>(null);
  const [sosOpen, setSosOpen] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await dosesApi.today());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load today’s doses.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError(caught instanceof ApiError ? caught.message : 'That change did not save.');
    }
  }

  async function snooze(dose: DoseEvent, minutes: number) {
    setSnoozeTarget(null);
    try {
      await dosesApi.snooze(dose.id, minutes);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not snooze that dose.');
    }
  }

  if (loading) return <Spinner label="Loading today’s doses" />;
  if (error && !data) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return null;

  const done = data.taken.length + data.skipped.length + data.missed.length;
  const total = ordered.length;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div>
      <header className="screen-head">
        <div>
          <p className="micro numeric">{longDate(data.date)}</p>
          <h1 className="t-title mt-2">
            {greeting()}, {firstName}
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
          <h2 className="t-lg">Nothing scheduled today</h2>
          <p className="muted t-sm mt-2 mb-4">Add a medicine and your daily schedule builds itself.</p>
          <Link className="btn btn-primary" to="/app/medicines/new">
            Add a medicine
          </Link>
        </div>
      ) : focus ? (
        <NextDose
          dose={focus}
          onTake={() => act(focus, 'take')}
          onSnooze={() => setSnoozeTarget(focus)}
          onSkip={() => act(focus, 'skip')}
        />
      ) : (
        <div className="empty">
          <div className="empty-mark" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
            <Check size={22} />
          </div>
          <h2 className="t-lg">All done for today</h2>
          <p className="muted t-sm mt-2">
            {data.taken.length} of {total} doses taken.
          </p>
        </div>
      )}

      {total > 0 && (
        <>
          <div className="day-progress">
            <span className="micro">Today</span>
            <div
              className="day-segments"
              role="img"
              aria-label={`${data.taken.length} of ${total} doses taken`}
            >
              {ordered.map((dose) => (
                <span key={dose.id} className={`day-segment day-segment-${dose.status}`} />
              ))}
            </div>
            <span className="t-xs numeric muted">
              {done}/{total}
            </span>
          </div>

          <div className="section-head">
            <h2 className="micro">Schedule</h2>
          </div>

          <div>
            {ordered.map((dose) => (
              <RailRow
                key={dose.id}
                dose={dose}
                onUndo={() => act(dose, 'undo')}
                onTake={() => act(dose, 'take')}
              />
            ))}
          </div>
        </>
      )}

      {snoozeTarget && (
        <Modal title={`Snooze ${snoozeTarget.medicineName}`} onClose={() => setSnoozeTarget(null)}>
          <p className="muted t-sm mb-4">
            We’ll remind you again after this. The dose stays on today’s schedule either way.
          </p>
          <div className="snooze-grid">
            {SNOOZE_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="snooze-option"
                onClick={() => snooze(snoozeTarget, minutes)}
              >
                {minutes} min
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
  onTake,
  onSnooze,
  onSkip,
}: {
  dose: DoseEvent;
  onTake: () => void;
  onSnooze: () => void;
  onSkip: () => void;
}) {
  const overdue = dose.status === 'missed';

  return (
    <section className={`panel${dose.isCritical ? ' panel-critical' : ''}`}>
      <div className="panel-head">
        <span className="micro">{overdue ? 'Overdue' : 'Next dose'}</span>
        <span className="t-xs muted numeric">{relativeTo(dose.scheduledAt)}</span>
      </div>

      <div className="panel-pad">
        <h2 className="next-dose-name">{dose.medicineName}</h2>
        <p className="next-dose-meta">
          {dose.medicineStrength} · {formatTime12h(dose.localTime)}
          {dose.isCritical && ' · Critical'}
        </p>

        {overdue && (
          <p className="next-dose-note">
            <AlertTriangle size={16} />
            <span>This was due earlier. You can still record it if you took it.</span>
          </p>
        )}
      </div>

      <div className="next-dose-actions">
        <button type="button" className="action-primary" onClick={onTake}>
          <Check size={20} />
          Mark as taken
        </button>
        <div className="split">
          <button type="button" className="action-secondary" onClick={onSnooze}>
            <Clock size={16} />
            Snooze
          </button>
          <button type="button" className="action-secondary" onClick={onSkip}>
            <SkipForward size={16} />
            Skip
          </button>
        </div>
      </div>
    </section>
  );
}

function RailRow({
  dose,
  onUndo,
  onTake,
}: {
  dose: DoseEvent;
  onUndo: () => void;
  onTake: () => void;
}) {
  const resolved = dose.status === 'taken' || dose.status === 'skipped';
  const label = STATE_LABEL[dose.status];

  return (
    <button
      type="button"
      className="rail-row"
      onClick={resolved ? onUndo : onTake}
      aria-label={`${dose.medicineName} at ${formatTime12h(dose.localTime)} — ${label}. ${
        resolved ? 'Undo' : 'Mark as taken'
      }`}
    >
      <span className="rail-time">{formatTime12h(dose.localTime)}</span>
      <span className="rail-marker">
        <span className={`rail-dot rail-dot-${dose.status}`} />
      </span>
      <span className="rail-name">
        {dose.medicineName} <span className="rail-strength">{dose.medicineStrength}</span>
        {dose.isCritical && <span className="rail-critical" aria-label="Critical" />}
      </span>
      <span className={`rail-state rail-state-${dose.status}`}>
        {resolved ? <Undo size={15} /> : label}
      </span>
    </button>
  );
}

function SosModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const response = await alertsApi.sos(message || undefined);
      setResult(response.message);
    } catch (caught) {
      setResult(caught instanceof ApiError ? caught.message : 'Could not send the alert.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Send an emergency alert" onClose={onClose}>
      {result ? (
        <div className="stack">
          <div className="alert alert-info" role="status">
            <Info size={18} />
            <span>{result}</span>
          </div>
          {/* Said plainly: this is not an emergency service, and someone in
              trouble must not be left believing that it is. */}
          <p className="muted t-sm">
            If this is a medical emergency, call your local emergency number. MedTrack notifies your
            caregivers, but it cannot summon help.
          </p>
          <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <div className="stack">
          <p className="muted t-sm">
            This alerts every caregiver you have set up to receive alerts, by email and push.
          </p>
          <div className="field">
            <label className="label" htmlFor="sos-message">
              Anything you want to tell them? (optional)
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
            {busy ? 'Sending…' : 'Send alert now'}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            Cancel
          </button>
        </div>
      )}
    </Modal>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function longDate(localDate: string): string {
  return new Date(`${localDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** A duration is easier to act on than a clock time. */
function relativeTo(instant: string): string {
  const deltaMinutes = Math.round((new Date(instant).getTime() - Date.now()) / 60_000);
  const abs = Math.abs(deltaMinutes);
  if (abs < 1) return 'now';

  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const span = hours > 0 ? `${hours} h${minutes ? ` ${minutes} m` : ''}` : `${minutes} min`;
  return deltaMinutes > 0 ? `in ${span}` : `${span} ago`;
}
