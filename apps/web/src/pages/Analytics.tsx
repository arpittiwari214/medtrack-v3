/**
 * Adherence insight.
 *
 * The tone here is deliberate. Adherence dashboards easily become a scolding
 * device — one big percentage that only ever falls, which is discouraging
 * exactly when someone is already struggling. So the headline is the streak and
 * the pattern, the chart distinguishes "no data" from "zero", and the insight
 * text describes rather than admonishes.
 */

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client.js';
import { dosesApi, type AnalyticsResponse } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, PageHeader, Spinner, Stat } from '../components/ui.js';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

function rateColor(rate: number): string {
  if (rate >= 80) return 'var(--ok)';
  if (rate >= 50) return 'var(--warn)';
  return 'var(--danger)';
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError('');
    try {
      setData(await dosesApi.analytics(range));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your insights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  if (loading && !data) return <Spinner label="Loading insights" />;
  if (error && !data) return <ErrorBanner message={error} onRetry={() => load(days)} />;
  if (!data) return null;

  const hasData = data.summary.taken + data.summary.missed > 0;

  return (
    <div className="stack">
      <PageHeader title="Insights" subtitle={`Last ${days} days`} />

      <div className="row" role="group" aria-label="Time range">
        {RANGES.map((range) => (
          <button
            key={range.days}
            type="button"
            className={`btn btn-sm ${days === range.days ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={days === range.days}
            onClick={() => setDays(range.days)}
          >
            {range.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <EmptyState
          icon="📈"
          title="Not enough history yet"
          description="Once you have logged a few doses, this is where the patterns show up."
        />
      ) : (
        <>
          <div className="row" style={{ gap: 'var(--s3)' }}>
            <div className="stat" style={{ flex: 1 }}>
              <div className="stat-value" style={{ color: rateColor(data.summary.ratePercent) }}>
                {data.summary.ratePercent}%
              </div>
              <div className="stat-label">Doses taken</div>
            </div>
            <Stat value={data.summary.streakDays} label="Day streak" />
            <Stat value={data.summary.missed} label="Missed" />
          </div>

          {data.insights.length > 0 && (
            <section className="stack" style={{ gap: 'var(--s2)' }}>
              <h2 className="eyebrow">What we noticed</h2>
              {data.insights.slice(0, 2).map((insight) => (
                <div key={insight.kind} className="alert alert-info">
                  <span aria-hidden="true">💡</span>
                  <span>{insight.message}</span>
                </div>
              ))}
            </section>
          )}

          <section className="card">
            <div className="card-header">
              <h2 style={{ fontSize: '1.0625rem' }}>Day by day</h2>
            </div>
            <div className="chart" role="img" aria-label={describeChart(data)}>
              {data.daily.map((point) => (
                <div key={point.localDate} className="chart-col" title={`${point.localDate}: ${point.ratePercent ?? 'no doses'}`}>
                  {point.ratePercent === null ? (
                    <div className="chart-bar chart-bar-empty" />
                  ) : (
                    <div
                      className="chart-bar"
                      style={{
                        height: `${Math.max(point.ratePercent, 3)}%`,
                        background: rateColor(point.ratePercent),
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="row-between subtle" style={{ marginTop: 'var(--s2)' }}>
              <span>{data.window.from}</span>
              <span>{data.window.to}</span>
            </div>
            <p className="subtle" style={{ marginTop: 'var(--s3)' }}>
              A hatched tick means no doses were scheduled that day — not that you missed them.
            </p>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 style={{ fontSize: '1.0625rem' }}>By medicine</h2>
            </div>
            <div className="stack" style={{ gap: 'var(--s3)' }}>
              {data.perMedicine.map((medicine) => (
                <div key={medicine.medicineId}>
                  <div className="row-between" style={{ marginBottom: 'var(--s1)' }}>
                    <span style={{ fontWeight: 600 }}>{medicine.medicineName}</span>
                    <span className="numeric" style={{ color: rateColor(medicine.ratePercent), fontWeight: 700 }}>
                      {medicine.ratePercent}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--r-full)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${medicine.ratePercent}%`,
                        height: '100%',
                        background: rateColor(medicine.ratePercent),
                      }}
                    />
                  </div>
                  <p className="subtle" style={{ marginTop: 2 }}>
                    {medicine.taken} taken · {medicine.missed} missed
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** A text description of the chart, so it is not invisible to a screen reader. */
function describeChart(data: AnalyticsResponse): string {
  const withData = data.daily.filter((point) => point.ratePercent !== null);
  if (withData.length === 0) return 'No dose data in this period.';
  const average = Math.round(
    withData.reduce((sum, point) => sum + (point.ratePercent ?? 0), 0) / withData.length,
  );
  return `Daily adherence from ${data.window.from} to ${data.window.to}, averaging ${average}% across ${withData.length} days with scheduled doses.`;
}
