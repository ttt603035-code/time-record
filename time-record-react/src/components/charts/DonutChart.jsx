import { useMemo } from 'react';
import { Cell, Pie, PieChart } from 'recharts';

import { ChartContainer } from '@/components/ui/chart.jsx';
import { cn } from '@/lib/utils.js';

const SIZE = 196;
const R = SIZE * 0.37;
const SW = SIZE * 0.125;

/**
 * Interactive donut, rendered with the stock shadcn/ui Chart (Recharts)
 * appearance — plain sectors, no custom geometry.
 *
 * The colours come from the app's own category palette rather than the shadcn
 * chart tokens, and the ranked legend below the chart is unchanged.
 */
export function DonutChart({
  segments, selectedKey, centerTop, centerSub, centerSmall, onPick,
}) {
  const { data, config } = useMemo(() => {
    const total = segments.reduce((s, x) => s + x.minutes, 0) || 0;
    const rows = segments
      .filter((seg) => total && seg.minutes > 0)
      .map((seg) => ({
        key: seg.key,
        name: seg.name,
        value: seg.minutes,
        fill: seg.color,
      }));

    const cfg = {};
    rows.forEach((r) => { cfg[r.key] = { label: r.name, color: r.fill }; });
    return { data: rows, config: cfg };
  }, [segments]);

  if (!data.length) return null;

  return (
    <div className="donut-wrap">
      <div className="donut-svg">
        <ChartContainer
          config={config}
          className="aspect-square w-[196px]"
          initialDimension={{ width: SIZE, height: SIZE }}
        >
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={R - SW / 2}
              outerRadius={R + SW / 2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              stroke="none"
              onClick={(entry) => {
                const seg = segments.find((s) => s.key === entry?.payload?.key);
                if (seg && onPick) onPick(seg);
              }}
            >
              {data.map((d) => {
                const isSel = selectedKey === d.key;
                return (
                  <Cell
                    key={d.key}
                    fill={d.fill}
                    role="button"
                    tabIndex={0}
                    aria-label={d.name}
                    opacity={selectedKey && !isSel ? 0.22 : 1}
                    style={{ transition: 'opacity 0.18s ease', outline: 'none', cursor: 'pointer' }}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="donut-center">
          <div className={cn('dc-top', centerSmall && 'is-small')}>{centerTop}</div>
          <div className="dc-sub">{centerSub}</div>
        </div>
      </div>
    </div>
  );
}
