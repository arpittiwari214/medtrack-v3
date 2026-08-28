/**
 * Adherence insight.
 *
 * The tone is deliberate. Adherence dashboards easily become a scolding device —
 * one big percentage that only ever falls, which is discouraging exactly when
 * someone is already struggling.
 *
 * The chart is a **single series**, so it gets a single hue. An earlier version
 * coloured each bar green/amber/red by its own value, which spends the reserved
 * status palette on a continuum and makes an ordinary week look like an alarm
 * panel. Status colour now appears once, on the headline figure, where it is
 * paired with a word so the colour is never the only signal.
 *
 * A day with no scheduled doses renders as a hollow tick rather than a zero-height
 * bar, because "nothing was due" and "you took none of them" are different facts.
 */

import { useCallback, useEffect, useState } from 'react';
import { formatLocalDate, type DailyAdherencePoint } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { dosesApi, type AnalyticsResponse } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui.js';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

/** Status band for a rate. Always rendered with its label, never colour alone. */
function band(rate: number): { tone: string; label: string; badge: string } {
  if (rate >= 80) return { tone: 'var(--ok)', label: 'On track', badge: 'badge-ok' };
  if (rate >= 50) return { tone: 'var(--warn)', label: 'Slipping', badge: 'badge-warn' };
  return { tone: 'var(--danger)', label: 'Needs attention', badge: 'badge-danger' };
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

  const resolved = data.summary.taken + data.summary.missed;
  const hasData = resolved > 0;
  const status = band(data.summary.ratePercent);

  return (
    <div className="stack">
      <PageHeader title="Insights" subtitle={`Your last ${days} days`} />

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
          {/* The one number the screen leads with. Exactly one hero per view. */}
          <section className="card">
            <p className="eyebrow">Doses taken</p>
            <div className="row" style={{ alignItems: 'baseline', gap: 'var(--s2)' }}>
              <span className="hero-figure">{data.summary.ratePercent}</span>
              <span className="hero-unit">%</span>
              <span className={`badge ${status.badge}`} style={{ marginLeft: 'auto' }}>
                {status.label}
              </span>
            </div>
            <p className="muted" style={{ marginTop: 'var(--s2)', fontSize: '0.9375rem' }}>
              {data.summary.taken} of {resolved} doses, over {days} days.
              {data.summary.streakDays > 0 && (
                <> Currently on a {data.summary.streakDays}-day streak.</>
              )}
            </p>
          </section>

          <div className="row" style={{ gap: 'var(--s3)' }}>
            <Tile value={data.summary.streakDays} label="Day streak" />
            <Tile value={data.summary.missed} label="Missed" />
            <Tile value={data.summary.skipped} label="Skipped" />
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

          <AdherenceChart daily={data.daily} from={data.window.from} to={data.window.to} />

          <section className="card">
            <div className="card-header">
              <h2 style={{ fontSize: '1.0625rem' }}>By medicine</h2>
            </div>
            <div className="stack" style={{ gap: 'var(--s4)' }}>
              {data.perMedicine.map((medicine) => {
                const level = band(medicine.ratePercent);
                return (
                  <div key={medicine.medicineId}>
                    <div className="row-between" style={{ marginBottom: 'var(--s2)' }}>
                      <span style={{ fontWeight: 600 }}>{medicine.medicineName}</span>
                      <span className="row" style={{ gap: 'var(--s2)' }}>
                        <span className={`badge ${level.badge}`}>{level.label}</span>
                        <span className="numeric" style={{ fontWeight: 650 }}>
                          {medicine.ratePercent}%
                        </span>
                      </span>
                    </div>
                    <div
                      className="meter"
                      role="img"
                      aria-label={`${medicine.medicineName}: ${medicine.ratePercent}% taken, ${medicine.missed} missed of ${medicine.taken + medicine.missed}`}
                    >
                      <div className="meter-fill" style={{ width: `${medicine.ratePercent}%` }} />
                    </div>
                    <p className="subtle" style={{ marginTop: 'var(--s1)' }}>
                      {medicine.taken} taken · {medicine.missed} missed
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat" style={{ flex: 1 }}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/**
 * Daily adherence, one column per day.
 *
 * Single series, so there is no legend — the heading already says what is
 * plotted, and a one-swatch legend box would just restate it.
 */
function AdherenceChart({
  daily,
  from,
  to,
}: {
  daily: DailyAdherencePoint[];
  from: string;
  to: string;
}) {
  const withData = daily.filter((point) => point.ratePercent !== null);
  const average =
    withData.length > 0
      ? Math.round(
          withData.reduce((sum, point) => sum + (point.ratePercent ?? 0), 0) / withData.length,
        )
      : 0;

  return (
    <section className="card">
      <div className="card-header">
        <h2 style={{ fontSize: '1.0625rem' }}>Day by day</h2>
        <span className="subtle numeric">{average}% average</span>
      </div>

      <div
        className="chart"
        role="img"
        aria-label={`Daily adherence from ${from} to ${to}, averaging ${average}% across ${withData.length} days with scheduled doses.`}
      >
        {/* Recessive hairline gridlines at 50% and 100%. */}
        <div className="chart-grid" aria-hidden="true">
          <div className="chart-gridline" style={{ top: 0 }} />
          <div className="chart-gridline" style={{ top: '50%' }} />
        </div>

        {daily.map((point) => (
          <div key={point.localDate} className="chart-col" tabIndex={-1}>
            <span className="chart-tip">
              {point.ratePercent === null
                ? `${formatLocalDate(point.localDate)} · none due`
                : `${formatLocalDate(point.localDate)} · ${point.ratePercent}%`}
            </span>
            {point.ratePercent === null ? (
              <div className="chart-bar-empty" />
            ) : (
              <div
                className="chart-bar"
                style={{ height: `${Math.max(point.ratePercent, 2)}%` }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="chart-axis">
        <span>{formatLocalDate(from)}</span>
        <span>{formatLocalDate(to)}</span>
      </div>

      <p className="subtle" style={{ marginTop: 'var(--s3)' }}>
        A flat tick marks a day with no doses scheduled — not a day you missed.
      </p>
    </section>
  );
}
