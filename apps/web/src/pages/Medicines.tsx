import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTimeFor } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { medicinesApi, type MedicineWithStock } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, Modal, ScreenHeader, Spinner } from '../components/ui.js';
import { AlertTriangle, Package, Pill, Plus } from '../components/icons.js';
import { ColorDot } from '../components/recognition.js';
import { useT, type StringKey } from '../i18n/index.js';

export default function Medicines() {
  const { t, locale, date } = useT();
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
      setError(caught instanceof ApiError ? caught.message : t('meds_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(medicine: MedicineWithStock) {
    const confirmed = window.confirm(t('stop_confirm', { name: medicine.name }));
    if (!confirmed) return;

    try {
      await medicinesApi.archive(medicine.id);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('archive_failed'));
    }
  }

  if (loading) return <Spinner label={t('loading_medicines')} />;

  return (
    <div>
      <ScreenHeader
        eyebrow={medicines.length > 0 ? t('n_active', { n: medicines.length }) : undefined}
        title={t('medicines_title')}
        action={
          <Link className="btn btn-primary btn-sm" to="/app/medicines/new">
            <Plus size={16} />
            {t('add')}
          </Link>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {medicines.length === 0 ? (
        <EmptyState
          icon={<Pill size={22} />}
          title={t('meds_empty_title')}
          description={t('meds_empty_body')}
          action={
            <Link className="btn btn-primary" to="/app/medicines/new">
              {t('add_a_medicine')}
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
                    {t(`sched_${medicine.schedule.kind}` as StringKey)}
                  </span>
                  {medicine.isCritical && <span className="badge badge-danger">{t('critical')}</span>}
                </div>

                <div className="panel-body">
                  <div className="row-between">
                    <div className="flex-1">
                      <div className="row" style={{ gap: 'var(--s2)' }}>
                        <ColorDot color={medicine.pillColor} size={18} />
                        <ColorDot color={medicine.stripColor} size={18} />
                        <h2 className="t-lg truncate">
                          {medicine.person ? `${medicine.person}: ` : ''}
                          {medicine.name}
                        </h2>
                      </div>
                      <p className="subtle">
                        {[medicine.strength, medicine.purpose && t('for_purpose', { purpose: medicine.purpose })]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>

                  {medicine.schedule.times.length > 0 && (
                    <div className="row row-wrap mt-3" style={{ gap: 'var(--s2)' }}>
                      {medicine.schedule.times.map((time) => (
                        <span key={time} className="badge badge-neutral numeric">
                          {formatTimeFor(time, locale)}
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
                        <strong>
                          {t(medicine.dosesRemaining === 1 ? 'doses_left_one' : 'doses_left_other', {
                            n: medicine.dosesRemaining ?? 0,
                          })}
                        </strong>
                        {medicine.projectedRunOut && (
                          <span className="t-xs">{t('runs_out_suffix', { date: date(medicine.projectedRunOut) })}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setRefillTarget(medicine)}
                      >
                        {t('refill')}
                      </button>
                    </div>
                  )}

                  <div className="row mt-4" style={{ gap: 'var(--s2)' }}>
                    <Link className="btn btn-secondary btn-sm" to={`/app/medicines/${medicine.id}/edit`}>
                      {t('edit')}
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => archive(medicine)}
                    >
                      {t('stop_reminders')}
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
  const { t } = useT();
  const [units, setUnits] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const value = Number(units);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('enter_units'));
      return;
    }
    setBusy(true);
    try {
      await medicinesApi.refill(medicine.id, value);
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('refill_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('refill_named', { name: medicine.name })} onClose={onClose}>
      <div className="stack">
        {error && (
          <div className="alert alert-error" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="units">
            {t('how_many_added')}
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
            {t('units_hint', { n: medicine.stock?.unitsRemaining ?? 0 })}
          </span>
        </div>
        <button type="button" className="action-primary" onClick={submit} disabled={busy}>
          {t(busy ? 'saving' : 'add_to_supply')}
        </button>
      </div>
    </Modal>
  );
}
