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
import { type DailyAdherencePoint } from '@medtrack/shared';
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
import { useT, type StringKey } from '../i18n/index.js';

const RANGES = [7, 30, 90];

/** Status band for a rate. Always rendered with its label, never colour alone. */
function band(rate: number): { label: StringKey; badge: string } {
  if (rate >= 80) return { label: 'band_ok', badge: 'badge-ok' };
  if (rate >= 50) return { label: 'band_warn', badge: 'badge-warn' };
  return { label: 'band_danger', badge: 'badge-danger' };
}

export default function Analytics() {
  const { t, locale } = useT();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError('');
    try {
      setData(await dosesApi.analytics(range, locale));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('insights_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t, locale]);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  if (loading && !data) return <Spinner label={t('loading_insights')} />;
  if (error && !data) return <ErrorBanner message={error} onRetry={() => load(days)} />;
  if (!data) return null;

  const resolved = data.summary.taken + data.summary.missed;
  const status = band(data.summary.ratePercent);

  return (
    <div>
      <ScreenHeader
        eyebrow={t('last_days', { n: days })}
        title={t('insights_title')}
        action={
          <div className="segmented" role="group" aria-label={t('time_range')}>
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={days === range}
                onClick={() => setDays(range)}
              >
                {t('range_days', { n: range })}
              </button>
            ))}
          </div>
        }
      />

      {resolved === 0 ? (
        <EmptyState
          icon={<ChartIcon size={22} />}
          title={t('insights_empty_title')}
          description={t('insights_empty_body')}
        />
      ) : (
        <div className="stack">
          {/* The one number the screen leads with. Exactly one hero per view. */}
          <section className="panel">
            <div className="panel-head">
              <span className="micro">{t('doses_taken')}</span>
              <span className={`badge ${status.badge}`}>{t(status.label)}</span>
            </div>
            <div className="panel-pad">
              <div className="row" style={{ alignItems: 'baseline', gap: 'var(--s2)' }}>
                <span className="hero-figure">{data.summary.ratePercent}</span>
                <span className="hero-unit">%</span>
              </div>
              <p className="muted t-sm mt-2">
                {t('taken_of', { taken: data.summary.taken, total: resolved, days })}
                {data.summary.streakDays > 0 && t('streak_note', { n: data.summary.streakDays })}
              </p>
            </div>
          </section>

          <MetricStrip
            items={[
              { value: data.summary.streakDays, label: t('metric_streak') },
              { value: data.summary.missed, label: t('metric_missed') },
              { value: data.summary.skipped, label: t('metric_skipped') },
            ]}
          />

          {data.insights.length > 0 && (
            <>
              <SectionHead title={t('what_we_noticed')} />
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
              <span className="micro">{t('by_medicine')}</span>
            </div>
            <div className="panel-body stack">
              {data.perMedicine.map((medicine) => {
                const level = band(medicine.ratePercent);
                // Only skipped doses so far: there is no rate to judge, and
                // "Needs attention 0%" would be wrong.
                const counted = medicine.taken + medicine.missed > 0;
                return (
                  <div key={medicine.medicineId}>
                    <div className="row-between mb-3">
                      <span className="t-sm" style={{ fontWeight: 600 }}>
                        {medicine.medicineName}
                      </span>
                      <span className="row" style={{ gap: 'var(--s2)' }}>
                        {counted && <span className={`badge ${level.badge}`}>{t(level.label)}</span>}
                        <span className="numeric t-sm" style={{ fontWeight: 650 }}>
                          {counted ? `${medicine.ratePercent}%` : '—'}
                        </span>
                      </span>
                    </div>
                    <div
                      className="meter"
                      role="img"
                      aria-label={t('a11y_med_rate', {
                        name: medicine.medicineName,
                        rate: medicine.ratePercent,
                        missed: medicine.missed,
                        total: medicine.taken + medicine.missed,
                      })}
                    >
                      <div className="meter-fill" style={{ width: `${medicine.ratePercent}%` }} />
                    </div>
                    <p className="subtle mt-2">
                      {t('taken_missed', { taken: medicine.taken, missed: medicine.missed })}
                      {medicine.skipped > 0 ? t('skipped_suffix', { n: medicine.skipped }) : ''}
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
  const { t, date } = useT();
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
        <span className="micro">{t('day_by_day')}</span>
        <span className="t-xs muted numeric">{t('average', { n: average })}</span>
      </div>

      <div className="panel-body">
        <div
          className="chart"
          role="img"
          aria-label={t('a11y_chart', { from: date(from), to: date(to), average, days: withData.length })}
        >
          <div className="chart-grid" aria-hidden="true">
            <div className="chart-gridline" style={{ top: 0 }} />
            <div className="chart-gridline" style={{ top: '50%' }} />
          </div>

          {daily.map((point) => (
            <div key={point.localDate} className="chart-col">
              <span className="chart-tip">
                {point.ratePercent === null
                  ? t('none_due', { date: date(point.localDate, 'short') })
                  : `${date(point.localDate, 'short')} · ${point.ratePercent}%`}
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
          <span>{date(from)}</span>
          <span>{date(to)}</span>
        </div>

        <p className="subtle mt-3">{t('flat_tick')}</p>
      </div>
    </section>
  );
}
