import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { formatTimeFor, todayIn, type Appointment, type AppointmentKind } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { appointmentsApi } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, Modal, ScreenHeader, Spinner } from '../components/ui.js';
import { AlertTriangle, Calendar, Plus } from '../components/icons.js';
import { useT, type StringKey } from '../i18n/index.js';

const KINDS: AppointmentKind[] = ['doctor', 'lab_test', 'procedure', 'vaccination', 'other'];

const STATUS_LABEL: Record<string, StringKey> = {
  completed: 'status_completed',
  cancelled: 'status_cancelled',
  missed: 'status_missed',
};

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export default function Appointments() {
  const { t, locale, date } = useT();
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
      setError(caught instanceof ApiError ? caught.message : t('appts_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(scope);
  }, [scope, load]);

  async function markComplete(appointment: Appointment) {
    try {
      await appointmentsApi.update(appointment.id, { status: 'completed' });
      await load(scope);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('appt_update_failed'));
    }
  }

  async function remove(appointment: Appointment) {
    if (!window.confirm(t('delete_named_confirm', { title: appointment.title }))) return;
    try {
      await appointmentsApi.remove(appointment.id);
      await load(scope);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('appt_delete_failed'));
    }
  }

  return (
    <div>
      <ScreenHeader
        eyebrow={t('visits_eyebrow')}
        title={t('appointments_title')}
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            {t('add')}
          </button>
        }
      />

      <div className="segmented" role="group" aria-label={t('which_appointments')}>
        <button type="button" aria-pressed={scope === 'upcoming'} onClick={() => setScope('upcoming')}>
          {t('upcoming')}
        </button>
        <button type="button" aria-pressed={scope === 'past'} onClick={() => setScope('past')}>
          {t('past')}
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => load(scope)} />}

      <div className="mt-4">
        {loading ? (
          <Spinner label={t('loading_appointments')} />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<Calendar size={22} />}
            title={t(scope === 'upcoming' ? 'visits_empty_up' : 'visits_empty_past')}
            description={t('visits_empty_body_web')}
            action={
              scope === 'upcoming' ? (
                <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
                  {t('add_appointment_cta')}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="stack">
            {appointments.map((appointment) => {
              return (
                <article key={appointment.id} className="panel">
                  <div className="panel-head">
                    <span className="micro">
                      {KINDS.includes(appointment.kind) ? t(`kind_${appointment.kind}`) : t('appointment')}
                    </span>
                    <span className="t-xs muted numeric">
                      {date(appointment.localDate)} · {formatTimeFor(appointment.localTime, locale)}
                    </span>
                  </div>

                  <div className="panel-body">
                    <div className="row-between">
                      <h2 className="t-lg flex-1 truncate">{appointment.title}</h2>
                      {appointment.status !== 'scheduled' && (
                        <span
                          className={`badge ${appointment.status === 'completed' ? 'badge-ok' : 'badge-neutral'}`}
                        >
                          {STATUS_LABEL[appointment.status] ? t(STATUS_LABEL[appointment.status]!) : appointment.status}
                        </span>
                      )}
                    </div>

                    {appointment.provider && (
                      <p className="subtle mt-2">{t('with_provider', { provider: appointment.provider })}</p>
                    )}
                    {appointment.location && <p className="subtle">{appointment.location}</p>}

                    {appointment.requiresFasting && (
                      <div className="alert alert-warn mt-3">
                        <AlertTriangle size={18} />
                        <span>{t('fasting_required')}</span>
                      </div>
                    )}

                    {appointment.notes && <p className="subtle mt-3">{appointment.notes}</p>}

                    {appointment.status === 'scheduled' && (
                      <div className="row mt-4" style={{ gap: 'var(--s2)' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => markComplete(appointment)}
                        >
                          {t('mark_done')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => remove(appointment)}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

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
  const { t } = useT();
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
      setError(caught instanceof ApiError ? caught.message : t('appt_save_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('add_appointment_cta')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {error && <ErrorBanner message={error} />}

        <div className="field">
          <label className="label" htmlFor="kind">
            {t('type_label')}
          </label>
          <select
            id="kind"
            className="select"
            value={kind}
            onChange={(event) => setKind(event.target.value as AppointmentKind)}
          >
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {t(`kind_${option}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="title">
            {t('what_is_it')}
          </label>
          <input
            id="title"
            className="input"
            required
            placeholder={t('appt_title_example')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="split">
          <div className="field">
            <label className="label" htmlFor="date">
              {t('date_label')}
            </label>
            <input
              id="date"
              className="input numeric"
              type="date"
              required
              value={localDate}
              onChange={(event) => setLocalDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="time">
              {t('time_label')}
            </label>
            <input
              id="time"
              className="input numeric"
              type="time"
              required
              value={localTime}
              onChange={(event) => setLocalTime(event.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="provider">
            {t('who_with')}
          </label>
          <input
            id="provider"
            className="input"
            placeholder={t('provider_example')}
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="location">
            {t('where_label')}
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
            {t('notes_label')}
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
          <span className="t-sm">{t('fasting_beforehand')}</span>
        </label>

        <button className="action-primary" type="submit" disabled={busy}>
          {t(busy ? 'saving' : 'add_appointment')}
        </button>
      </form>
    </Modal>
  );
}
