/**
 * Today's doses — the screen that matters most.
 *
 * Optimistic updates throughout: tapping "Taken" marks it immediately and
 * reconciles with the server afterwards, rolling back on failure. Waiting on a
 * round trip to confirm something the patient physically just did feels broken.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SNOOZE_PRESETS, formatTime12h, type DoseEvent } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { alertsApi, dosesApi, type TodayResponse } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.js';
import { EmptyState, ErrorBanner, Modal, Spinner, StatusBadge } from '../components/ui.js';

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

  /**
   * Apply a dose action optimistically.
   *
   * The whole `TodayResponse` is refetched on success rather than patched in
   * place, because taking a dose moves it between buckets and can change the
   * counts — reconstructing that client-side would duplicate server logic.
   */
  async function act(dose: DoseEvent, action: 'take' | 'skip' | 'undo', minutes?: number) {
    if (!data) return;
    const previous = data;

    // Move it out of `upcoming` straight away so the tap feels instant.
    setData({
      ...data,
      upcoming: data.upcoming.filter((item) => item.id !== dose.id),
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
    void minutes;
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

  const total = data.upcoming.length + data.taken.length + data.missed.length + data.skipped.length;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="stack">
      <header className="row-between">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1 style={{ fontSize: '1.5rem' }}>{firstName}</h1>
        </div>
        <button type="button" className="btn btn-sos btn-sm" onClick={() => setSosOpen(true)}>
          SOS
        </button>
      </header>

      {error && <ErrorBanner message={error} />}

      {total === 0 ? (
        <EmptyState
          icon="💊"
          title="Nothing scheduled today"
          description="Add a medicine and MedTrack will build your daily schedule from it."
          action={
            <Link className="btn btn-primary" to="/app/medicines/new">
              Add a medicine
            </Link>
          }
        />
      ) : (
        <>
          <div className="row" style={{ gap: 'var(--s3)' }}>
            <div className="stat" style={{ flex: 1 }}>
              <div className="stat-value">
                {data.taken.length}
                <span className="muted" style={{ fontSize: '1rem' }}>
                  /{total}
                </span>
              </div>
              <div className="stat-label">Taken today</div>
            </div>
            <div className="stat" style={{ flex: 1 }}>
              <div className="stat-value">{data.upcoming.length}</div>
              <div className="stat-label">Still to take</div>
            </div>
          </div>

          {data.missed.length > 0 && (
            <div className="alert alert-warn" role="alert">
              <span aria-hidden="true">⚠</span>
              <div>
                <strong>
                  {data.missed.length} missed {data.missed.length === 1 ? 'dose' : 'doses'}
                </strong>
                <p style={{ fontSize: '0.875rem' }}>
                  You can still record these if you took them — tap the dose below.
                </p>
              </div>
            </div>
          )}

          <Section title="Still to take" doses={data.upcoming}>
            {(dose) => (
              <div className="row" style={{ gap: 'var(--s2)' }}>
                <button type="button" className="btn btn-success btn-sm" onClick={() => act(dose, 'take')}>
                  Taken
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSnoozeTarget(dose)}
                >
                  Snooze
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(dose, 'skip')}>
                  Skip
                </button>
              </div>
            )}
          </Section>

          <Section title="Missed" doses={data.missed}>
            {(dose) => (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(dose, 'take')}>
                I took this
              </button>
            )}
          </Section>

          <Section title="Done" doses={[...data.taken, ...data.skipped]}>
            {(dose) => (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(dose, 'undo')}>
                Undo
              </button>
            )}
          </Section>
        </>
      )}

      {snoozeTarget && (
        <Modal title={`Snooze ${snoozeTarget.medicineName}`} onClose={() => setSnoozeTarget(null)}>
          <p className="muted" style={{ marginBottom: 'var(--s4)' }}>
            We’ll remind you again after this. The dose stays on today’s list either way.
          </p>
          <div className="stack">
            {SNOOZE_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => snooze(snoozeTarget, minutes)}
              >
                {minutes} minutes
              </button>
            ))}
          </div>
        </Modal>
      )}

      {sosOpen && <SosModal onClose={() => setSosOpen(false)} />}
    </div>
  );
}

function Section({
  title,
  doses,
  children,
}: {
  title: string;
  doses: DoseEvent[];
  children: (dose: DoseEvent) => React.ReactNode;
}) {
  if (doses.length === 0) return null;

  return (
    <section className="stack" style={{ gap: 'var(--s2)' }}>
      <h2 className="eyebrow">{title}</h2>
      {doses.map((dose) => (
        <article key={dose.id} className={`dose dose-${dose.status}`}>
          <div className="dose-time">{formatTime12h(dose.localTime)}</div>
          <div className="dose-body">
            <div className="dose-name">
              {dose.medicineName}
              {dose.isCritical && (
                <span className="badge badge-danger" style={{ marginLeft: 'var(--s2)' }}>
                  Critical
                </span>
              )}
            </div>
            <div className="row" style={{ gap: 'var(--s2)', marginTop: 2 }}>
              <span className="subtle">{dose.medicineStrength}</span>
              <StatusBadge status={dose.status} />
            </div>
          </div>
          {children(dose)}
        </article>
      ))}
    </section>
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
            <span aria-hidden="true">ℹ</span>
            <span>{result}</span>
          </div>
          {/* Said plainly: this is not an emergency service, and someone in
              trouble should not be left believing that it is. */}
          <p className="muted" style={{ fontSize: '0.9375rem' }}>
            If this is a medical emergency, call your local emergency number. MedTrack notifies your
            caregivers, but it cannot summon help.
          </p>
          <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <div className="stack">
          <p className="muted">
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
          <button type="button" className="btn btn-sos btn-block btn-lg" onClick={send} disabled={busy}>
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
