import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTime12h } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { medicinesApi, type MedicineWithStock } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, Modal, ScreenHeader, Spinner } from '../components/ui.js';
import { AlertTriangle, Package, Pill, Plus } from '../components/icons.js';

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
    <div>
      <ScreenHeader
        eyebrow={medicines.length > 0 ? `${medicines.length} active` : undefined}
        title="Medicines"
        action={
          <Link className="btn btn-primary btn-sm" to="/app/medicines/new">
            <Plus size={16} />
            Add
          </Link>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {medicines.length === 0 ? (
        <EmptyState
          icon={<Pill size={22} />}
          title="No medicines yet"
          description="Add your first medicine and MedTrack builds a daily schedule and starts reminding you."
          action={
            <Link className="btn btn-primary" to="/app/medicines/new">
              Add a medicine
            </Link>
          }
        />
      ) : (
        <div className="stack">
          {medicines.map((medicine) => {
            const low =
              medicine.stock !== null &&
              medicine.dosesRemaining !== null &&
              medicine.dosesRemaining <= 6;

            return (
              <article
                key={medicine.id}
                className={`panel${medicine.isCritical ? ' panel-critical' : ''}`}
              >
                <div className="panel-head">
                  <span className="micro truncate">
                    {SCHEDULE_LABEL[medicine.schedule.kind] ?? medicine.schedule.kind}
                  </span>
                  {medicine.isCritical && <span className="badge badge-danger">Critical</span>}
                </div>

                <div className="panel-body">
                  <div className="row-between">
                    <div className="flex-1">
                      <h2 className="t-lg truncate">{medicine.name}</h2>
                      <p className="subtle">{medicine.strength}</p>
                    </div>
                  </div>

                  {medicine.schedule.times.length > 0 && (
                    <div className="row row-wrap mt-3" style={{ gap: 'var(--s2)' }}>
                      {medicine.schedule.times.map((time) => (
                        <span key={time} className="badge badge-neutral numeric">
                          {formatTime12h(time)}
                        </span>
                      ))}
                    </div>
                  )}

                  {medicine.instructions && (
                    <p className="subtle mt-3">{medicine.instructions}</p>
                  )}

                  {/* Supply is shown in doses, not units — "6 doses left" is
                      actionable; "12 tablets" needs mental arithmetic. */}
                  {medicine.stock && (
                    <div className={`alert ${low ? 'alert-warn' : 'alert-info'} mt-3`}>
                      <Package size={18} />
                      <div className="flex-1">
                        <strong>{medicine.dosesRemaining ?? 0} doses left</strong>
                        {medicine.projectedRunOut && (
                          <span className="t-xs"> · runs out around {medicine.projectedRunOut}</span>
                        )}
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

                  <div className="row mt-4" style={{ gap: 'var(--s2)' }}>
                    <Link className="btn btn-secondary btn-sm" to={`/app/medicines/${medicine.id}/edit`}>
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => archive(medicine)}
                    >
                      Stop reminders
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
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
        {error && (
          <div className="alert alert-error" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="units">
            How many did you add?
          </label>
          <input
            id="units"
            className="input numeric"
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
        <button type="button" className="action-primary" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Add to supply'}
        </button>
      </div>
    </Modal>
  );
}
