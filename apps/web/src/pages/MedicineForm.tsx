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
import { todayIn, type MedicineColor } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { medicinesApi } from '../api/endpoints.js';
import { ErrorBanner, ScreenHeader, Spinner } from '../components/ui.js';
import { ColorPicker, SlotPicker } from '../components/recognition.js';
import { useT, type StringKey } from '../i18n/index.js';

const FORMS: MedicineFormType[] = [
  'tablet', 'capsule', 'liquid', 'injection', 'inhaler', 'drops', 'patch', 'cream', 'other',
];

const KINDS: ScheduleKind[] = ['daily', 'interval_days', 'days_of_week', 'cyclic', 'as_needed'];

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Short weekday name from the browser, so no table is needed: 1 Jan 2024 was a Monday. */
function weekdayName(day: Weekday, locale: string): string {
  return new Date(Date.UTC(2024, 0, day)).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-GB', {
    weekday: 'short',
    timeZone: 'UTC',
  });
}

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
  const { t, locale } = useT();
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
  const [pillColor, setPillColor] = useState<MedicineColor | null>(null);
  const [stripColor, setStripColor] = useState<MedicineColor | null>(null);
  const [purpose, setPurpose] = useState('');
  const [person, setPerson] = useState('');

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
        setPillColor(medicine.pillColor ?? null);
        setStripColor(medicine.stripColor ?? null);
        setPurpose(medicine.purpose ?? '');
        setPerson(medicine.person ?? '');
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
          setError(caught instanceof ApiError ? caught.message : t('med_load_failed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

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
      pillColor,
      stripColor,
      purpose: purpose.trim() || null,
      person: person.trim() || null,
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
        setError(t('save_failed_connection'));
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label={t('loading_medicine')} />;

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <ScreenHeader title={t(isEdit ? 'edit_medicine' : 'add_a_medicine')} />

      {error && <ErrorBanner message={error} />}

      {/* Recognition first. Most patients identify a medicine by its colour,
          not its name — see shared/recognition.ts for the evidence. */}
      <section className="panel panel-pad stack">
        <h2 className="t-lg">{t('how_recognise')}</h2>
        <ColorPicker label={t('tablet_colour')} name="pill-color" value={pillColor} onChange={setPillColor} />
        <ColorPicker label={t('strip_colour')} name="strip-color" value={stripColor} onChange={setStripColor} />
        <div className="field">
          <label className="label" htmlFor="purpose">
            {t('purpose_label')}
          </label>
          <input
            id="purpose"
            className="input"
            maxLength={40}
            placeholder={t('purpose_placeholder')}
            value={purpose}
            aria-invalid={Boolean(fieldErrors['purpose'])}
            onChange={(event) => setPurpose(event.target.value)}
          />
          {fieldErrors['purpose'] && <span className="field-error">{fieldErrors['purpose']}</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor="person">
            {t('person_label')}
          </label>
          <input
            id="person"
            className="input"
            maxLength={30}
            placeholder={t('person_placeholder')}
            value={person}
            aria-invalid={Boolean(fieldErrors['person'])}
            onChange={(event) => setPerson(event.target.value)}
          />
          <span className="field-hint">{t('person_hint')}</span>
          {fieldErrors['person'] && <span className="field-error">{fieldErrors['person']}</span>}
        </div>
      </section>

      <section className="panel panel-pad stack">
        <div className="field">
          <label className="label" htmlFor="name">
            {t('medicine_name')}
          </label>
          <input
            id="name"
            className="input"
            required
            placeholder={t('name_example')}
            value={name}
            aria-invalid={Boolean(fieldErrors['name'])}
            onChange={(event) => setName(event.target.value)}
          />
          {fieldErrors['name'] && <span className="field-error">{fieldErrors['name']}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="strength">
            {t('strength_label')}
          </label>
          <input
            id="strength"
            className="input"
            placeholder={t('strength_example')}
            value={strength}
            aria-invalid={Boolean(fieldErrors['strength'])}
            onChange={(event) => setStrength(event.target.value)}
          />
          {fieldErrors['strength'] && <span className="field-error">{fieldErrors['strength']}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="form">
            {t('form_label')}
          </label>
          <select
            id="form"
            className="select"
            value={form}
            onChange={(event) => setForm(event.target.value as MedicineFormType)}
          >
            {FORMS.map((option) => (
              <option key={option} value={option}>
                {t(`form_${option}` as StringKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="instructions">
            {t('instructions_label')}
          </label>
          <input
            id="instructions"
            className="input"
            placeholder={t('instructions_example')}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </div>
      </section>

      <section className="panel panel-pad stack">
        <h2 className="t-lg">{t('when_take')}</h2>

        <div className="field">
          <label className="label" htmlFor="kind">
            {t('pattern')}
          </label>
          <select
            id="kind"
            className="select"
            value={kind}
            onChange={(event) => setKind(event.target.value as ScheduleKind)}
          >
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {t(`sched_${option}` as StringKey)}
              </option>
            ))}
          </select>
        </div>

        {kind === 'interval_days' && (
          <div className="field">
            <label className="label" htmlFor="interval">
              {t('every_how_many')}
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
            <span className="label">{t('which_days')}</span>
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`btn btn-sm ${weekdays.includes(day) ? 'btn-primary' : 'btn-secondary'}`}
                  aria-pressed={weekdays.includes(day)}
                  onClick={() => toggleWeekday(day)}
                >
                  {weekdayName(day, locale)}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === 'cyclic' && (
          <div className="split">
            <div className="field flex-1">
              <label className="label" htmlFor="on-days">
                {t('days_on')}
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
                {t('days_off')}
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

        {kind !== 'as_needed' && <SlotPicker times={times} onChange={setTimes} />}

        {kind !== 'as_needed' && (
          <div className="field">
            <span className="label">{t('exact_times')}</span>
            {times.map((time, index) => (
              <div key={index} className="row" style={{ gap: 'var(--s2)' }}>
                <input
                  className="input"
                  type="time"
                  required
                  value={time}
                  aria-label={t('dose_time_n', { n: index + 1 })}
                  onChange={(event) => updateTime(index, event.target.value)}
                />
                {times.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={t('remove_time_n', { n: index + 1 })}
                    onClick={() => setTimes((previous) => previous.filter((_, i) => i !== index))}
                  >
                    {t('remove')}
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
                {t('add_time')}
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
              {t('start_date')}
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
              {t('end_date')}
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
            <strong>{t('critical_label')}</strong>
            <span className="field-hint" style={{ display: 'block' }}>
              {t('critical_help')}
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
            <strong>{t('track_stock')}</strong>
            <span className="field-hint" style={{ display: 'block' }}>
              {t('track_stock_help')}
            </span>
          </span>
        </label>

        {trackStock && (
          <div className="row" style={{ gap: 'var(--s3)', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 100px' }}>
              <label className="label" htmlFor="remaining">
                {t('i_have')}
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
                {t('per_dose')}
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
                {t('warn_at')}
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
          {t(busy ? 'saving' : isEdit ? 'save_changes' : 'add_medicine')}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => navigate(-1)}
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
