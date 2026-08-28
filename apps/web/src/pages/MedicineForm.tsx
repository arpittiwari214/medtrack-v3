/**
 * Add or edit a medicine.
 *
 * The schedule builder is the fiddly part. It is kept deliberately concrete —
 * you pick times of day explicitly rather than choosing "twice daily" and
 * hoping the app guesses 08:00 and 20:00, because when a dose fires matters
 * clinically and a wrong guess is worse than one extra tap.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { MedicineForm as MedicineFormType, ScheduleKind, Weekday } from '@medtrack/shared';
import { todayIn } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { medicinesApi } from '../api/endpoints.js';
import { ErrorBanner, ScreenHeader, Spinner } from '../components/ui.js';

const FORMS: { value: MedicineFormType; label: string }[] = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'injection', label: 'Injection' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'drops', label: 'Drops' },
  { value: 'patch', label: 'Patch' },
  { value: 'cream', label: 'Cream' },
  { value: 'other', label: 'Other' },
];

const KINDS: { value: ScheduleKind; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'interval_days', label: 'Every few days' },
  { value: 'days_of_week', label: 'Certain days of the week' },
  { value: 'cyclic', label: 'A few days on, then off' },
  { value: 'as_needed', label: 'Only when I need it' },
];

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export default function MedicineForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState<MedicineFormType>('tablet');
  const [instructions, setInstructions] = useState('');
  const [isCritical, setIsCritical] = useState(false);

  const [kind, setKind] = useState<ScheduleKind>('daily');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [startDate, setStartDate] = useState(() => todayIn(browserZone()));
  const [endDate, setEndDate] = useState('');
  const [intervalDays, setIntervalDays] = useState(2);
  const [weekdays, setWeekdays] = useState<Weekday[]>([1]);
  const [cycleOnDays, setCycleOnDays] = useState(21);
  const [cycleOffDays, setCycleOffDays] = useState(7);

  const [trackStock, setTrackStock] = useState(false);
  const [unitsRemaining, setUnitsRemaining] = useState(30);
  const [unitsPerDose, setUnitsPerDose] = useState(1);
  const [lowThreshold, setLowThreshold] = useState(7);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const { medicine } = await medicinesApi.get(id!);
        if (cancelled) return;
        setName(medicine.name);
        setStrength(medicine.strength);
        setForm(medicine.form);
        setInstructions(medicine.instructions ?? '');
        setIsCritical(medicine.isCritical);
        setKind(medicine.schedule.kind);
        setTimes(medicine.schedule.times.length > 0 ? medicine.schedule.times : ['08:00']);
        setStartDate(medicine.schedule.startDate);
        setEndDate(medicine.schedule.endDate ?? '');
        setIntervalDays(medicine.schedule.intervalDays ?? 2);
        setWeekdays((medicine.schedule.weekdays as Weekday[]) ?? [1]);
        setCycleOnDays(medicine.schedule.cycleOnDays ?? 21);
        setCycleOffDays(medicine.schedule.cycleOffDays ?? 7);
        if (medicine.stock) {
          setTrackStock(true);
          setUnitsRemaining(medicine.stock.unitsRemaining);
          setUnitsPerDose(medicine.stock.unitsPerDose);
          setLowThreshold(medicine.stock.lowThreshold);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Could not load that medicine.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateTime(index: number, value: string) {
    setTimes((previous) => previous.map((time, position) => (position === index ? value : time)));
  }

  function toggleWeekday(day: Weekday) {
    setWeekdays((previous) =>
      previous.includes(day) ? previous.filter((value) => value !== day) : [...previous, day].sort(),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setBusy(true);

    const payload = {
      name,
      strength,
      form,
      instructions,
      isCritical,
      schedule: {
        kind,
        times: kind === 'as_needed' ? [] : times,
        startDate,
        endDate: endDate || null,
        intervalDays: kind === 'interval_days' ? intervalDays : null,
        weekdays: kind === 'days_of_week' ? weekdays : null,
        cycleOnDays: kind === 'cyclic' ? cycleOnDays : null,
        cycleOffDays: kind === 'cyclic' ? cycleOffDays : null,
      },
      stock: trackStock ? { unitsRemaining, unitsPerDose, lowThreshold } : null,
    };

    try {
      if (isEdit) await medicinesApi.update(id!, payload);
      else await medicinesApi.create(payload);
      navigate('/app/medicines');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(
          Object.fromEntries(caught.issues.map((issue) => [issue.path, issue.message])),
        );
      } else {
        setError('Could not save. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading medicine" />;

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <ScreenHeader title={isEdit ? 'Edit medicine' : 'Add a medicine'} />

      {error && <ErrorBanner message={error} />}

      <section className="panel panel-pad stack">
        <div className="field">
          <label className="label" htmlFor="name">
            Medicine name
          </label>
          <input
            id="name"
            className="input"
            required
            placeholder="e.g. Metformin"
            value={name}
            aria-invalid={Boolean(fieldErrors['name'])}
            onChange={(event) => setName(event.target.value)}
          />
          {fieldErrors['name'] && <span className="field-error">{fieldErrors['name']}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="strength">
            Strength or dose
          </label>
          <input
            id="strength"
            className="input"
            required
            placeholder="e.g. 500 mg, 2 puffs"
            value={strength}
            aria-invalid={Boolean(fieldErrors['strength'])}
            onChange={(event) => setStrength(event.target.value)}
          />
          {fieldErrors['strength'] && <span className="field-error">{fieldErrors['strength']}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="form">
            Form
          </label>
          <select
            id="form"
            className="select"
            value={form}
            onChange={(event) => setForm(event.target.value as MedicineFormType)}
          >
            {FORMS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="instructions">
            Instructions (optional)
          </label>
          <input
            id="instructions"
            className="input"
            placeholder="e.g. Take with food"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </div>
      </section>

      <section className="panel panel-pad stack">
        <h2 className="t-lg">When do you take it?</h2>

        <div className="field">
          <label className="label" htmlFor="kind">
            Pattern
          </label>
          <select
            id="kind"
            className="select"
            value={kind}
            onChange={(event) => setKind(event.target.value as ScheduleKind)}
          >
            {KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {kind === 'interval_days' && (
          <div className="field">
            <label className="label" htmlFor="interval">
              Every how many days?
            </label>
            <input
              id="interval"
              className="input"
              type="number"
              min={1}
              max={365}
              value={intervalDays}
              onChange={(event) => setIntervalDays(Number(event.target.value))}
            />
          </div>
        )}

        {kind === 'days_of_week' && (
          <div className="field">
            <span className="label">Which days?</span>
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`btn btn-sm ${weekdays.includes(day.value) ? 'btn-primary' : 'btn-secondary'}`}
                  aria-pressed={weekdays.includes(day.value)}
                  onClick={() => toggleWeekday(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === 'cyclic' && (
          <div className="split">
            <div className="field flex-1">
              <label className="label" htmlFor="on-days">
                Days on
              </label>
              <input
                id="on-days"
                className="input"
                type="number"
                min={1}
                value={cycleOnDays}
                onChange={(event) => setCycleOnDays(Number(event.target.value))}
              />
            </div>
            <div className="field flex-1">
              <label className="label" htmlFor="off-days">
                Days off
              </label>
              <input
                id="off-days"
                className="input"
                type="number"
                min={0}
                value={cycleOffDays}
                onChange={(event) => setCycleOffDays(Number(event.target.value))}
              />
            </div>
          </div>
        )}

        {kind !== 'as_needed' && (
          <div className="field">
            <span className="label">Times of day</span>
            {times.map((time, index) => (
              <div key={index} className="row" style={{ gap: 'var(--s2)' }}>
                <input
                  className="input"
                  type="time"
                  required
                  value={time}
                  aria-label={`Dose time ${index + 1}`}
                  onChange={(event) => updateTime(index, event.target.value)}
                />
                {times.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`Remove dose time ${index + 1}`}
                    onClick={() => setTimes((previous) => previous.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {times.length < 12 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setTimes((previous) => [...previous, '20:00'])}
              >
                + Add another time
              </button>
            )}
            {fieldErrors['schedule.times'] && (
              <span className="field-error">{fieldErrors['schedule.times']}</span>
            )}
          </div>
        )}

        <div className="split">
          <div className="field flex-1">
            <label className="label" htmlFor="start">
              Start date
            </label>
            <input
              id="start"
              className="input"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="field flex-1">
            <label className="label" htmlFor="end">
              End date (optional)
            </label>
            <input
              id="end"
              className="input"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="panel panel-pad stack">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={isCritical}
            onChange={(event) => setIsCritical(event.target.checked)}
          />
          <span>
            <strong>This medicine is critical</strong>
            <span className="field-hint" style={{ display: 'block' }}>
              Your caregivers are alerted the first time a dose is missed, rather than after several.
            </span>
          </span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={trackStock}
            onChange={(event) => setTrackStock(event.target.checked)}
          />
          <span>
            <strong>Track how much I have left</strong>
            <span className="field-hint" style={{ display: 'block' }}>
              Get warned before you run out, while there is still time to order more.
            </span>
          </span>
        </label>

        {trackStock && (
          <div className="row" style={{ gap: 'var(--s3)', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 100px' }}>
              <label className="label" htmlFor="remaining">
                I have
              </label>
              <input
                id="remaining"
                className="input"
                type="number"
                min={0}
                value={unitsRemaining}
                onChange={(event) => setUnitsRemaining(Number(event.target.value))}
              />
            </div>
            <div className="field" style={{ flex: '1 1 100px' }}>
              <label className="label" htmlFor="per-dose">
                Per dose
              </label>
              <input
                id="per-dose"
                className="input"
                type="number"
                min={0.5}
                step={0.5}
                value={unitsPerDose}
                onChange={(event) => setUnitsPerDose(Number(event.target.value))}
              />
            </div>
            <div className="field" style={{ flex: '1 1 100px' }}>
              <label className="label" htmlFor="threshold">
                Warn me at
              </label>
              <input
                id="threshold"
                className="input"
                type="number"
                min={0}
                value={lowThreshold}
                onChange={(event) => setLowThreshold(Number(event.target.value))}
              />
            </div>
          </div>
        )}
      </section>

      <div className="stack stack-sm">
        <button className="action-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add medicine'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => navigate(-1)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
