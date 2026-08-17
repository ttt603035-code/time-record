import { useMemo, useState } from 'react';

import { TrendChart } from '@/components/charts/TrendChart.jsx';
import { ChartCard, ChartEmpty } from '@/components/insights/ChartCard.jsx';
import { buildTrend, fmtTime } from '@/lib/analytics.js';
import { t } from '@/lib/i18n.js';

/** Trend card — ported from legacy `trendCard`. Tap a bucket to read its value. */
export function TrendCard({ events, range, color, nameLabel }) {
  const [info, setInfo] = useState('');
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
        <span className="trend-info">{info}</span>
      </div>
      {empty ? (
        <ChartEmpty />
      ) : (
        <TrendChart
          labels={trend.labels}
          values={trend.values}
          type={trend.kind}
          color={color}
          onPick={(i) => setInfo(`${trend.pickLabel(i)} · ${fmtTime(trend.values[i])}`)}
        />
      )}
    </ChartCard>
  );
}
