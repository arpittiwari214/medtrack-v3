/**
 * A caregiver's view of one patient.
 *
 * Read-only by design. A caregiver can see what the patient shared and be
 * alerted, but cannot mark a dose as taken on their behalf — the dose record is
 * the patient's account of what they did, and letting someone else write to it
 * would quietly make the adherence history untrustworthy.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatTime12h } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { careApi, type PatientOverview } from '../api/endpoints.js';
import { ErrorBanner, PageHeader, Spinner, Stat, StatusBadge } from '../components/ui.js';

function rateColor(rate: number): string {
  if (rate >= 80) return 'var(--ok)';
  if (rate >= 50) return 'var(--warn)';
  return 'var(--danger)';
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
            caught instanceof ApiError
              ? caught.message
              : 'Could not load this person’s information.',
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
      <main id="main" className="app-shell" style={{ padding: 'var(--s4)' }}>
        <ErrorBanner message={error} />
        <Link className="btn btn-secondary" to="/care" style={{ marginTop: 'var(--s4)' }}>
          Back
        </Link>
      </main>
    );
  }
  if (!data) return null;

  const outstanding = data.today.upcoming.length + data.today.missed.length;

  return (
    <main id="main" className="app-shell" style={{ padding: 'var(--s4)' }}>
      <PageHeader
        title={data.patient.name}
        subtitle="Today at a glance"
        action={
          <Link className="btn btn-ghost btn-sm" to="/care">
            Back
          </Link>
        }
      />

      <div className="stack">
        <div className="row" style={{ gap: 'var(--s3)' }}>
          <div className="stat" style={{ flex: 1 }}>
            <div className="stat-value" style={{ color: rateColor(data.summary.ratePercent) }}>
              {data.summary.ratePercent}%
            </div>
            <div className="stat-label">Last 30 days</div>
          </div>
          <Stat value={data.summary.streakDays} label="Day streak" />
          <Stat value={data.today.taken.length} label="Taken today" />
        </div>

        {data.today.missed.length > 0 && (
          <div className="alert alert-warn" role="alert">
            <span aria-hidden="true">⚠</span>
            <div>
              <strong>
                {data.today.missed.length} missed{' '}
                {data.today.missed.length === 1 ? 'dose' : 'doses'} today
              </strong>
              <p style={{ fontSize: '0.875rem' }}>It may be worth checking in.</p>
            </div>
          </div>
        )}

        <section className="card">
          <div className="card-header">
            <h2 style={{ fontSize: '1.0625rem' }}>Today</h2>
            <span className="subtle">{outstanding} outstanding</span>
          </div>

          {[...data.today.missed, ...data.today.upcoming, ...data.today.taken].length === 0 ? (
            <p className="muted">Nothing scheduled today.</p>
          ) : (
            <div className="stack" style={{ gap: 'var(--s2)' }}>
              {[...data.today.missed, ...data.today.upcoming, ...data.today.taken].map((dose) => (
                <div key={dose.id} className={`dose dose-${dose.status}`}>
                  <div className="dose-time">{formatTime12h(dose.localTime)}</div>
                  <div className="dose-body">
                    <div className="dose-name">{dose.medicineName}</div>
                    <StatusBadge status={dose.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {data.perMedicine.length > 0 && (
          <section className="card">
            <div className="card-header">
              <h2 style={{ fontSize: '1.0625rem' }}>By medicine</h2>
            </div>
            <div className="stack" style={{ gap: 'var(--s3)' }}>
              {data.perMedicine.map((medicine) => (
                <div key={medicine.medicineId} className="row-between">
                  <span>{medicine.medicineName}</span>
                  <span
                    className="numeric"
                    style={{ color: rateColor(medicine.ratePercent), fontWeight: 700 }}
                  >
                    {medicine.ratePercent}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="subtle">
          You are seeing only what {data.patient.name} chose to share. They can change or withdraw
          this at any time.
        </p>
      </div>
    </main>
  );
}
