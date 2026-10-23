/**
 * A caregiver's view of one patient.
 *
 * Read-only by design. A caregiver can see what the patient shared and be
 * alerted, but cannot mark a dose taken on their behalf — the dose record is
 * the patient's account of what they did, and letting someone else write to it
 * would quietly make the adherence history untrustworthy.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatTimeFor } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { careApi, type PatientOverview } from '../api/endpoints.js';
import { ErrorBanner, MetricStrip, ScreenHeader, SectionHead, Spinner } from '../components/ui.js';
import { AlertTriangle } from '../components/icons.js';
import { useT } from '../i18n/index.js';

function band(rate: number): string {
  if (rate >= 80) return 'badge-ok';
  if (rate >= 50) return 'badge-warn';
  return 'badge-danger';
}

export default function CarePatientDetail() {
  const { patientId } = useParams();
  const { t, locale } = useT();
  const [data, setData] = useState<PatientOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    async function load() {
      try {
        const overview = await careApi.overview(patientId!);
        if (!cancelled) setData(overview);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof ApiError ? caught.message : t('patient_load_failed'),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [patientId, t]);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <main id="main" className="app-shell" style={{ padding: '0 var(--s4)' }}>
        <div className="mt-5">
          <ErrorBanner message={error} />
          <Link className="btn btn-secondary mt-4" to="/care">
            {t('back')}
          </Link>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const doses = [...data.today.missed, ...data.today.upcoming, ...data.today.taken].sort((a, b) =>
    a.scheduledAt.localeCompare(b.scheduledAt),
  );

  return (
    <main id="main" className="app-shell" style={{ padding: '0 var(--s4)' }}>
      <ScreenHeader
        eyebrow={t('today_glance')}
        title={data.patient.name}
        action={
          <Link className="btn btn-ghost btn-sm" to="/care">
            {t('back')}
          </Link>
        }
      />

      <div className="stack">
        <MetricStrip
          items={[
            { value: `${data.summary.ratePercent}%`, label: t('metric_30_days') },
            { value: data.summary.streakDays, label: t('metric_streak') },
            { value: data.today.taken.length, label: t('taken_today') },
          ]}
        />

        {data.today.missed.length > 0 && (
          <div className="alert alert-warn" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>
                {t(data.today.missed.length === 1 ? 'missed_today_one' : 'missed_today_other', {
                  n: data.today.missed.length,
                })}
              </strong>
              <p className="t-xs mt-2">{t('worth_checking')}</p>
            </div>
          </div>
        )}

        <SectionHead title={t('today_label')} />

        {doses.length === 0 ? (
          <p className="muted t-sm">{t('nothing_today')}</p>
        ) : (
          <div>
            {doses.map((dose) => (
              <div key={dose.id} className="rail-row rail-row-static">
                <span className="rail-time">{formatTimeFor(dose.localTime, locale)}</span>
                <span className="rail-marker">
                  <span className={`rail-dot rail-dot-${dose.status}`} />
                </span>
                <span className="rail-name">
                  {dose.medicineName}{' '}
                  <span className="rail-strength">{dose.medicineStrength}</span>
                </span>
                <span className={`rail-state rail-state-${dose.status}`}>
                  {t(`state_${dose.status}`)}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.perMedicine.length > 0 && (
          <>
            <SectionHead title={t('by_medicine')} />
            <div className="list">
              {data.perMedicine.map((medicine) => (
                <div key={medicine.medicineId} className="list-row">
                  <span className="flex-1 truncate">{medicine.medicineName}</span>
                  <span className={`badge ${band(medicine.ratePercent)}`}>
                    {medicine.ratePercent}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="subtle mt-4">
          {t('only_shared', { name: data.patient.name })}
        </p>
      </div>
    </main>
  );
}
