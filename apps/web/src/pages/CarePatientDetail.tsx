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
import { formatTime12h, type DoseStatus } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { careApi, type PatientOverview } from '../api/endpoints.js';
import { ErrorBanner, MetricStrip, ScreenHeader, SectionHead, Spinner } from '../components/ui.js';
import { AlertTriangle } from '../components/icons.js';

const STATE_LABEL: Record<DoseStatus, string> = {
  taken: 'Taken',
  missed: 'Missed',
  snoozed: 'Snoozed',
  skipped: 'Skipped',
  scheduled: 'Due',
};

function band(rate: number): string {
  if (rate >= 80) return 'badge-ok';
  if (rate >= 50) return 'badge-warn';
  return 'badge-danger';
}

export default function CarePatientDetail() {
  const { patientId } = useParams();
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
            caught instanceof ApiError ? caught.message : 'Could not load this person’s information.',
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
  }, [patientId]);

  if (loading) return <Spinner label="Loading" />;

  if (error) {
    return (
      <main id="main" className="app-shell" style={{ padding: '0 var(--s4)' }}>
        <div className="mt-5">
          <ErrorBanner message={error} />
          <Link className="btn btn-secondary mt-4" to="/care">
            Back
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
        eyebrow="Today at a glance"
        title={data.patient.name}
        action={
          <Link className="btn btn-ghost btn-sm" to="/care">
            Back
          </Link>
        }
      />

      <div className="stack">
        <MetricStrip
          items={[
            { value: `${data.summary.ratePercent}%`, label: '30 days' },
            { value: data.summary.streakDays, label: 'Streak' },
            { value: data.today.taken.length, label: 'Taken today' },
          ]}
        />

        {data.today.missed.length > 0 && (
          <div className="alert alert-warn" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>
                {data.today.missed.length} missed{' '}
                {data.today.missed.length === 1 ? 'dose' : 'doses'} today
              </strong>
              <p className="t-xs mt-2">It may be worth checking in.</p>
            </div>
          </div>
        )}

        <SectionHead title="Today" />

        {doses.length === 0 ? (
          <p className="muted t-sm">Nothing scheduled today.</p>
        ) : (
          <div>
            {doses.map((dose) => (
              <div key={dose.id} className="rail-row rail-row-static">
                <span className="rail-time">{formatTime12h(dose.localTime)}</span>
                <span className="rail-marker">
                  <span className={`rail-dot rail-dot-${dose.status}`} />
                </span>
                <span className="rail-name">
                  {dose.medicineName}{' '}
                  <span className="rail-strength">{dose.medicineStrength}</span>
                </span>
                <span className={`rail-state rail-state-${dose.status}`}>
                  {STATE_LABEL[dose.status]}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.perMedicine.length > 0 && (
          <>
            <SectionHead title="By medicine" />
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
          You are seeing only what {data.patient.name} chose to share. They can change or withdraw
          this at any time.
        </p>
      </div>
    </main>
  );
}
