import { useMemo } from 'react';

import { TrendChart } from '@/components/charts/TrendChart.jsx';
import { ChartCard, ChartEmpty } from '@/components/insights/ChartCard.jsx';
import { buildTrend } from '@/lib/analytics.js';
import { t } from '@/lib/i18n.js';

/** Trend card — the chart only. Tap-to-readout time was removed. */
export function TrendCard({ events, range, color, nameLabel }) {
  const trend = useMemo(
    () => (events.length ? buildTrend(events, range) : null),
    [events, range],
  );

  const empty = !trend || trend.values.every((v) => v === 0);

  return (
    <ChartCard>
      <div className="chart-head">
        <span className="chart-head-title">
          <span className="chart-head-dot" style={{ background: color }} />
          {t('trend')}
          {nameLabel ? <span className="chart-head-sub">{nameLabel}</span> : null}
        </span>
      </div>
      {empty ? (
        <ChartEmpty />
      ) : (
        <TrendChart
          labels={trend.labels}
          values={trend.values}
          type={trend.kind}
          color={color}
        />
      )}
    </ChartCard>
  );
}
