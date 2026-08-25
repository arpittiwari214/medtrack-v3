import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { formatTime12h, todayIn, type Appointment, type AppointmentKind } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { appointmentsApi } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, Modal, PageHeader, Spinner } from '../components/ui.js';

const KINDS: { value: AppointmentKind; label: string; icon: string }[] = [
  { value: 'doctor', label: 'Doctor visit', icon: '🩺' },
  { value: 'lab_test', label: 'Lab test', icon: '🧪' },
  { value: 'procedure', label: 'Procedure', icon: '🏥' },
  { value: 'vaccination', label: 'Vaccination', icon: '💉' },
  { value: 'other', label: 'Other', icon: '📌' },
];

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async (which: 'upcoming' | 'past') => {
    setLoading(true);
    setError('');
    try {
      const { appointments: list } = await appointmentsApi.list(which);
      setAppointments(list);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(scope);
  }, [scope, load]);

  async function markComplete(appointment: Appointment) {
    try {
      await appointmentsApi.update(appointment.id, { status: 'completed' });
      await load(scope);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update that appointment.');
    }
  }

  async function remove(appointment: Appointment) {
    if (!window.confirm(`Delete "${appointment.title}"?`)) return;
    try {
      await appointmentsApi.remove(appointment.id);
      await load(scope);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not delete that appointment.');
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Appointments"
        subtitle="Visits and lab tests"
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormOpen(true)}>
            + Add
          </button>
        }
      />

      <div className="row" role="group" aria-label="Which appointments">
        <button
          type="button"
          className={`btn btn-sm ${scope === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
          aria-pressed={scope === 'upcoming'}
          onClick={() => setScope('upcoming')}
        >
          Upcoming
        </button>
        <button
          type="button"
          className={`btn btn-sm ${scope === 'past' ? 'btn-primary' : 'btn-secondary'}`}
          aria-pressed={scope === 'past'}
          onClick={() => setScope('past')}
        >
          Past
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => load(scope)} />}

      {loading ? (
        <Spinner label="Loading appointments" />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon="📅"
          title={scope === 'upcoming' ? 'Nothing coming up' : 'Nothing in the past'}
          description="Add a doctor visit or lab test and MedTrack will remind you the day before and an hour ahead."
          action={
            scope === 'upcoming' ? (
              <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
                Add an appointment
              </button>
            ) : undefined
          }
        />
      ) : (
        appointments.map((appointment) => {
          const kind = KINDS.find((option) => option.value === appointment.kind);
          return (
            <article key={appointment.id} className="card card-tight stack" style={{ gap: 'var(--s2)' }}>
              <div className="row-between">
                <div className="row" style={{ gap: 'var(--s3)' }}>
                  <span style={{ fontSize: '1.5rem' }} aria-hidden="true">
                    {kind?.icon ?? '📌'}
                  </span>
                  <div>
                    <h2 style={{ fontSize: '1.0625rem' }}>{appointment.title}</h2>
                    <p className="subtle">
                      {appointment.localDate} at {formatTime12h(appointment.localTime)}
                    </p>
                  </div>
                </div>
                {appointment.status !== 'scheduled' && (
                  <span
                    className={`badge ${appointment.status === 'completed' ? 'badge-ok' : 'badge-neutral'}`}
                  >
                    {appointment.status}
                  </span>
                )}
              </div>

              {appointment.provider && <p className="subtle">With {appointment.provider}</p>}
              {appointment.location && <p className="subtle">📍 {appointment.location}</p>}

              {appointment.requiresFasting && (
                <div className="alert alert-warn" style={{ padding: 'var(--s3)', fontSize: '0.875rem' }}>
                  <span aria-hidden="true">⚠</span>
                  <span>Fasting required — do not eat beforehand.</span>
                </div>
              )}

              {appointment.notes && <p className="subtle">{appointment.notes}</p>}

              {appointment.status === 'scheduled' && (
                <div className="row" style={{ gap: 'var(--s2)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => markComplete(appointment)}
                  >
                    Mark done
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(appointment)}>
                    Delete
                  </button>
                </div>
              )}
            </article>
          );
        })
      )}

      {formOpen && (
        <AppointmentModal
          onClose={() => setFormOpen(false)}
          onDone={async () => {
            setFormOpen(false);
            setScope('upcoming');
            await load('upcoming');
          }}
        />
      )}
    </div>
  );
}

function AppointmentModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<AppointmentKind>('doctor');
  const [title, setTitle] = useState('');
  const [localDate, setLocalDate] = useState(() => todayIn(browserZone()));
  const [localTime, setLocalTime] = useState('10:00');
  const [provider, setProvider] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [requiresFasting, setRequiresFasting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await appointmentsApi.create({
        kind,
        title,
        localDate,
        localTime,
        provider: provider || null,
        location: location || null,
        notes: notes || null,
        requiresFasting,
        durationMinutes: 30,
        reminderOffsetsMinutes: [1440, 60],
      });
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that appointment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add an appointment" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {error && <ErrorBanner message={error} />}

        <div className="field">
          <label className="label" htmlFor="kind">
            Type
          </label>
          <select
            id="kind"
            className="select"
            value={kind}
            onChange={(event) => setKind(event.target.value as AppointmentKind)}
          >
            {KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="title">
            What is it?
          </label>
          <input
            id="title"
            className="input"
            required
            placeholder="e.g. Blood sugar review"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="row" style={{ gap: 'var(--s3)' }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              className="input"
              type="date"
              required
              value={localDate}
              onChange={(event) => setLocalDate(event.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="label" htmlFor="time">
              Time
            </label>
            <input
              id="time"
              className="input"
              type="time"
              required
              value={localTime}
              onChange={(event) => setLocalTime(event.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="provider">
            Who with? (optional)
          </label>
          <input
            id="provider"
            className="input"
            placeholder="e.g. Dr. Rao"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="location">
            Where? (optional)
          </label>
          <input
            id="location"
            className="input"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            className="textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={requiresFasting}
            onChange={(event) => setRequiresFasting(event.target.checked)}
          />
          <span>Fasting required beforehand</span>
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Add appointment'}
        </button>
      </form>
    </Modal>
  );
}
