/**
 * Adherence insight.
 *
 * The tone is deliberate. Adherence dashboards easily become a scolding device —
 * one big percentage that only ever falls, which is discouraging exactly when
 * someone is already struggling.
 *
 * The chart is a **single series**, so it gets a single hue. Colouring each bar
 * by its own value spends the reserved status palette on a continuum and makes
 * an ordinary week look like an alarm panel. Status appears once, on the
 * headline figure, paired with a word.
 */

import { useCallback, useEffect, useState } from 'react';
import { formatLocalDate, type DailyAdherencePoint } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { dosesApi, type AnalyticsResponse } from '../api/endpoints.js';
import {
  EmptyState,
  ErrorBanner,
  MetricStrip,
  ScreenHeader,
  SectionHead,
  Spinner,
} from '../components/ui.js';
import { Chart as ChartIcon, Info } from '../components/icons.js';

const RANGES = [7, 30, 90];

/** Status band for a rate. Always rendered with its label, never colour alone. */
function band(rate: number): { label: string; badge: string } {
  if (rate >= 80) return { label: 'On track', badge: 'badge-ok' };
  if (rate >= 50) return { label: 'Slipping', badge: 'badge-warn' };
  return { label: 'Needs attention', badge: 'badge-danger' };
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
  const status = band(data.summary.ratePercent);

  return (
    <div>
      <ScreenHeader
        eyebrow={`Last ${days} days`}
        title="Insights"
        action={
          <div className="segmented" role="group" aria-label="Time range">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={days === range}
                onClick={() => setDays(range)}
              >
                {range}d
              </button>
            ))}
          </div>
        }
      />

      {resolved === 0 ? (
        <EmptyState
          icon={<ChartIcon size={22} />}
          title="Not enough history yet"
          description="Once you have logged a few doses, this is where the patterns show up."
        />
      ) : (
        <div className="stack">
          {/* The one number the screen leads with. Exactly one hero per view. */}
          <section className="panel">
            <div className="panel-head">
              <span className="micro">Doses taken</span>
              <span className={`badge ${status.badge}`}>{status.label}</span>
            </div>
            <div className="panel-pad">
              <div className="row" style={{ alignItems: 'baseline', gap: 'var(--s2)' }}>
                <span className="hero-figure">{data.summary.ratePercent}</span>
                <span className="hero-unit">%</span>
              </div>
              <p className="muted t-sm mt-2">
                {data.summary.taken} of {resolved} doses over {days} days.
                {data.summary.streakDays > 0 && (
                  <> Currently on a {data.summary.streakDays}-day streak.</>
                )}
              </p>
            </div>
          </section>

          <MetricStrip
            items={[
              { value: data.summary.streakDays, label: 'Streak' },
              { value: data.summary.missed, label: 'Missed' },
              { value: data.summary.skipped, label: 'Skipped' },
            ]}
          />

          {data.insights.length > 0 && (
            <>
              <SectionHead title="What we noticed" />
              <div className="stack stack-sm">
                {data.insights.slice(0, 2).map((insight) => (
                  <div key={insight.kind} className="alert alert-info">
                    <Info size={18} />
                    <span>{insight.message}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <AdherenceChart daily={data.daily} from={data.window.from} to={data.window.to} />

          <section className="panel">
            <div className="panel-head">
              <span className="micro">By medicine</span>
            </div>
            <div className="panel-body stack">
              {data.perMedicine.map((medicine) => {
                const level = band(medicine.ratePercent);
                return (
                  <div key={medicine.medicineId}>
                    <div className="row-between mb-3">
                      <span className="t-sm" style={{ fontWeight: 600 }}>
                        {medicine.medicineName}
                      </span>
                      <span className="row" style={{ gap: 'var(--s2)' }}>
                        <span className={`badge ${level.badge}`}>{level.label}</span>
                        <span className="numeric t-sm" style={{ fontWeight: 650 }}>
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
                    <p className="subtle mt-2">
                      {medicine.taken} taken · {medicine.missed} missed
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
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
    <section className="panel">
      <div className="panel-head">
        <span className="micro">Day by day</span>
        <span className="t-xs muted numeric">{average}% average</span>
      </div>

      <div className="panel-body">
        <div
          className="chart"
          role="img"
          aria-label={`Daily adherence from ${from} to ${to}, averaging ${average}% across ${withData.length} days with scheduled doses.`}
        >
          <div className="chart-grid" aria-hidden="true">
            <div className="chart-gridline" style={{ top: 0 }} />
            <div className="chart-gridline" style={{ top: '50%' }} />
          </div>

          {daily.map((point) => (
            <div key={point.localDate} className="chart-col">
              <span className="chart-tip">
                {point.ratePercent === null
                  ? `${formatLocalDate(point.localDate)} · none due`
                  : `${formatLocalDate(point.localDate)} · ${point.ratePercent}%`}
              </span>
              {point.ratePercent === null ? (
                <div className="chart-bar-empty" />
              ) : (
                <div className="chart-bar" style={{ height: `${Math.max(point.ratePercent, 2)}%` }} />
              )}
            </div>
          ))}
        </div>

        <div className="chart-axis">
          <span>{formatLocalDate(from)}</span>
          <span>{formatLocalDate(to)}</span>
        </div>

        <p className="subtle mt-3">
          A flat tick marks a day with no doses scheduled — not a day you missed.
        </p>
      </div>
    </section>
  );
}
