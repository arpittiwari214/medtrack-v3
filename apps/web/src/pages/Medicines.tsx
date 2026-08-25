import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTime12h } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { medicinesApi, type MedicineWithStock } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, Modal, PageHeader, Spinner } from '../components/ui.js';

const SCHEDULE_LABEL: Record<string, string> = {
  daily: 'Every day',
  interval_days: 'Every few days',
  days_of_week: 'Certain days',
  cyclic: 'On and off',
  as_needed: 'When needed',
};

export default function Medicines() {
  const [medicines, setMedicines] = useState<MedicineWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refillTarget, setRefillTarget] = useState<MedicineWithStock | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const { medicines: list } = await medicinesApi.list();
      setMedicines(list);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your medicines.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(medicine: MedicineWithStock) {
    // Worth confirming: it changes what the app reminds them about.
    const confirmed = window.confirm(
      `Stop reminders for ${medicine.name}?\n\nYour history is kept — you can restore it later.`,
    );
    if (!confirmed) return;

    try {
      await medicinesApi.archive(medicine.id);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not archive that medicine.');
    }
  }

  if (loading) return <Spinner label="Loading medicines" />;

  return (
    <div className="stack">
      <PageHeader
        title="Medicines"
        subtitle={medicines.length > 0 ? `${medicines.length} active` : undefined}
        action={
          <Link className="btn btn-primary btn-sm" to="/app/medicines/new">
            + Add
          </Link>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {medicines.length === 0 ? (
        <EmptyState
          icon="💊"
          title="No medicines yet"
          description="Add your first medicine and MedTrack will build a daily schedule and start reminding you."
          action={
            <Link className="btn btn-primary" to="/app/medicines/new">
              Add a medicine
            </Link>
          }
        />
      ) : (
        medicines.map((medicine) => (
          <article key={medicine.id} className="card card-tight stack" style={{ gap: 'var(--s3)' }}>
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: '1.0625rem' }}>
                  {medicine.name}
                  {medicine.isCritical && (
                    <span className="badge badge-danger" style={{ marginLeft: 'var(--s2)' }}>
                      Critical
                    </span>
                  )}
                </h2>
                <p className="subtle">
                  {medicine.strength} · {SCHEDULE_LABEL[medicine.schedule.kind] ?? medicine.schedule.kind}
                </p>
              </div>
            </div>

            {medicine.schedule.times.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
                {medicine.schedule.times.map((time) => (
                  <span key={time} className="badge badge-neutral">
                    {formatTime12h(time)}
                  </span>
                ))}
              </div>
            )}

            {medicine.instructions && <p className="subtle">{medicine.instructions}</p>}

            {/* Supply is shown as doses, not units — "6 doses left" is what a
                patient can act on; "12 tablets" needs mental arithmetic. */}
            {medicine.stock && (
              <div
                className={`alert ${
                  medicine.dosesRemaining !== null && medicine.dosesRemaining <= 3
                    ? 'alert-warn'
                    : 'alert-info'
                }`}
                style={{ padding: 'var(--s3)' }}
              >
                <span aria-hidden="true">📦</span>
                <div style={{ flex: 1, fontSize: '0.875rem' }}>
                  <strong>{medicine.dosesRemaining ?? 0} doses left</strong>
                  {medicine.projectedRunOut && <> · runs out around {medicine.projectedRunOut}</>}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setRefillTarget(medicine)}
                >
                  Refill
                </button>
              </div>
            )}

            <div className="row" style={{ gap: 'var(--s2)' }}>
              <Link className="btn btn-secondary btn-sm" to={`/app/medicines/${medicine.id}/edit`}>
                Edit
              </Link>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => archive(medicine)}>
                Stop reminders
              </button>
            </div>
          </article>
        ))
      )}

      {refillTarget && (
        <RefillModal
          medicine={refillTarget}
          onClose={() => setRefillTarget(null)}
          onDone={async () => {
            setRefillTarget(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function RefillModal({
  medicine,
  onClose,
  onDone,
}: {
  medicine: MedicineWithStock;
  onClose: () => void;
  onDone: () => void;
}) {
  const [units, setUnits] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const value = Number(units);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter how many you added.');
      return;
    }
    setBusy(true);
    try {
      await medicinesApi.refill(medicine.id, value);
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not record that refill.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Refill ${medicine.name}`} onClose={onClose}>
      <div className="stack">
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label className="label" htmlFor="units">
            How many did you add?
          </label>
          <input
            id="units"
            className="input"
            type="number"
            min={1}
            inputMode="numeric"
            value={units}
            onChange={(event) => setUnits(event.target.value)}
          />
          <span className="field-hint">
            Individual tablets or units, not packs. Currently {medicine.stock?.unitsRemaining ?? 0} left.
          </span>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Add to supply'}
        </button>
      </div>
    </Modal>
  );
}
